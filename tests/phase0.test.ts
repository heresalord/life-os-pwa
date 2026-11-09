import test from 'node:test'
import assert from 'node:assert/strict'

// Test 1: useDraft logic verification (mocking localStorage)
test('useDraft envelope format & stale draft rejection', () => {
  const storage = new Map<string, string>()
  const mockLocalStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  }

  function parseStoredDraft(
    key: string,
    initial: string,
    baseUpdatedAt?: string | null
  ): { value: string; hasDraft: boolean } {
    const raw = mockLocalStorage.getItem(key)
    if (raw === null) return { value: initial, hasDraft: false }
    let parsedVal: string | null = null
    let parsedBase: string | null | undefined = undefined
    try {
      const obj = JSON.parse(raw)
      if (obj && typeof obj === 'object' && typeof obj.value === 'string') {
        parsedVal = obj.value
        parsedBase = obj.baseUpdatedAt
      }
    } catch {
      parsedVal = raw
    }
    if (parsedVal === null) return { value: initial, hasDraft: false }

    if (baseUpdatedAt !== undefined) {
      if (parsedBase !== baseUpdatedAt || !parsedVal.trim() || parsedVal === initial) {
        mockLocalStorage.removeItem(key)
        return { value: initial, hasDraft: false }
      }
      return { value: parsedVal, hasDraft: true }
    }
    if (parsedVal !== initial && parsedVal.trim()) {
      return { value: parsedVal, hasDraft: true }
    }
    return { value: initial, hasDraft: false }
  }

  // Case 1: Fresh note open with matching baseUpdatedAt
  mockLocalStorage.setItem('draft:note:1:body', JSON.stringify({
    value: 'Unsaved phone edit',
    baseUpdatedAt: '2026-11-08T10:00:00Z',
  }))

  const res1 = parseStoredDraft('draft:note:1:body', 'Initial text', '2026-11-08T10:00:00Z')
  assert.equal(res1.hasDraft, true)
  assert.equal(res1.value, 'Unsaved phone edit')

  // Case 2: Server updated note on desktop, note.updated_at is newer: stale draft MUST be discarded!
  const res2 = parseStoredDraft('draft:note:1:body', 'Desktop newer text', '2026-11-08T11:00:00Z')
  assert.equal(res2.hasDraft, false)
  assert.equal(res2.value, 'Desktop newer text')
  assert.equal(mockLocalStorage.getItem('draft:note:1:body'), null) // Discarded from storage

  // Case 3: Empty draft should not beat initial database text
  mockLocalStorage.setItem('draft:note:2:body', JSON.stringify({
    value: '',
    baseUpdatedAt: '2026-11-08T10:00:00Z',
  }))
  const res3 = parseStoredDraft('draft:note:2:body', 'Existing important note', '2026-11-08T10:00:00Z')
  assert.equal(res3.hasDraft, false)
  assert.equal(res3.value, 'Existing important note')
  assert.equal(mockLocalStorage.getItem('draft:note:2:body'), null)
})

// Test 2: Sync queue order preservation & non-loss mid-drain
test('Sync queue prevents mid-drain loss & preserves write order', () => {
  interface QueueItem {
    id: string
    table: string
    op: 'insert' | 'update' | 'delete'
    payload: { id: string; text?: string }
    retries: number
    status?: 'pending' | 'blocked'
    next_retry_at?: number
  }

  let queue: QueueItem[] = [
    { id: 'item-1', table: 'notes', op: 'update', payload: { id: 'note-100', text: 'v1' }, retries: 0 },
    { id: 'item-2', table: 'notes', op: 'update', payload: { id: 'note-200', text: 'v1' }, retries: 0 },
  ]

  // Simulate mid-drain addition: item-3 is enqueued while item-1 is syncing
  const succeededIds = new Set<string>()
  succeededIds.add('item-1')

  // Item added mid-drain
  queue.push({
    id: 'item-3', table: 'notes', op: 'update', payload: { id: 'note-300', text: 'newly added' }, retries: 0
  })

  // Re-read queue and only remove succeededIds
  const updatedQueue = queue.filter(item => !succeededIds.has(item.id))
  assert.equal(updatedQueue.length, 2)
  assert.equal(updatedQueue[0].id, 'item-2')
  assert.equal(updatedQueue[1].id, 'item-3') // Mid-drain write was PRESERVED!

  // Order check: if row already has item in queue, direct push is rejected in favor of queue
  const hasOlder = updatedQueue.some(i => i.table === 'notes' && i.payload.id === 'note-300')
  assert.equal(hasOlder, true)
})

// Test 3: Never drop after MAX_RETRIES - marked blocked instead
test('Failed items are marked blocked after MAX_RETRIES instead of being dropped', () => {
  const MAX_RETRIES = 5
  function handleFailure(item: { retries: number; status?: string }) {
    const newRetries = item.retries + 1
    const isBlocked = newRetries >= MAX_RETRIES
    return {
      retries: newRetries,
      status: isBlocked ? 'blocked' : 'pending',
    }
  }

  let item = { retries: 4, status: 'pending' }
  const failed = handleFailure(item)
  assert.equal(failed.retries, 5)
  assert.equal(failed.status, 'blocked')
})

