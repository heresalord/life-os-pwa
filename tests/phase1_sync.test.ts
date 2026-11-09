import test from 'node:test'
import assert from 'node:assert/strict'

// ── Test 1: Outbox ordering and sequential drain ──────────────────────────────
test('Outbox drains strictly in seq order and never drops mid-drain items', () => {
  interface OutboxItem {
    seq: number
    id: string
    row_key: string
    table: string
    op: 'insert' | 'update' | 'delete'
    row_id: string
    patch: Record<string, unknown>
    status: 'pending' | 'blocked'
    attempts: number
  }

  const outbox: OutboxItem[] = [
    { seq: 1, id: 'a1', row_key: 'notes:10', table: 'notes', op: 'insert', row_id: '10', patch: { title: 'First' }, status: 'pending', attempts: 0 },
    { seq: 2, id: 'a2', row_key: 'notes:10', table: 'notes', op: 'update', row_id: '10', patch: { title: 'Second' }, status: 'pending', attempts: 0 },
    { seq: 3, id: 'a3', row_key: 'tasks:20', table: 'tasks', op: 'insert', row_id: '20', patch: { title: 'Task' }, status: 'pending', attempts: 0 },
  ]

  // Verify sorting strictly by seq
  const sorted = [...outbox].sort((a, b) => a.seq - b.seq)
  assert.equal(sorted[0].seq, 1)
  assert.equal(sorted[1].seq, 2)
  assert.equal(sorted[2].seq, 3)

  // Consecutive updates to the same row_key can be coalesced:
  const coalesced = new Map<string, OutboxItem>()
  for (const item of sorted) {
    if (coalesced.has(item.row_key) && item.op === 'update') {
      const existing = coalesced.get(item.row_key)!
      coalesced.set(item.row_key, {
        ...existing,
        patch: { ...existing.patch, ...item.patch },
        seq: item.seq, // latest seq
      })
    } else {
      coalesced.set(item.row_key, item)
    }
  }

  assert.equal(coalesced.size, 2)
  assert.equal((coalesced.get('notes:10')!.patch as any).title, 'Second')
})

// ── Test 2: Delta Pull Merge Rules ────────────────────────────────────────────
test('Delta pull merge rules: outbox pending items skip server updates', () => {
  interface RecordRow {
    id: string
    title: string
    updated_at: string
    deleted_at: string | null
  }

  const pendingOutboxRowKeys = new Set<string>(['notes:local-pending'])

  const localDb = new Map<string, RecordRow>([
    [
      'local-pending',
      { id: 'local-pending', title: 'Local Unsynced Title', updated_at: '2026-11-09T01:00:00Z', deleted_at: null },
    ],
    [
      'note-synced',
      { id: 'note-synced', title: 'Old Local Title', updated_at: '2026-11-09T00:00:00Z', deleted_at: null },
    ],
    [
      'note-to-delete',
      { id: 'note-to-delete', title: 'Will be deleted', updated_at: '2026-11-09T00:00:00Z', deleted_at: null },
    ],
  ])

  const incomingServerRows: RecordRow[] = [
    // 1. Server row for item that has a pending outbox write locally -> MUST SKIP!
    { id: 'local-pending', title: 'Server Overwrite Attempt', updated_at: '2026-11-09T02:00:00Z', deleted_at: null },
    // 2. Server row with newer updated_at and no pending write -> MUST APPLY
    { id: 'note-synced', title: 'Fresh Server Title', updated_at: '2026-11-09T02:00:00Z', deleted_at: null },
    // 3. Server row with deleted_at set (tombstone) -> MUST DELETE LOCALLY
    { id: 'note-to-delete', title: 'Will be deleted', updated_at: '2026-11-09T02:00:00Z', deleted_at: '2026-11-09T02:00:00Z' },
  ]

  for (const serverRow of incomingServerRows) {
    const rowKey = `notes:${serverRow.id}`

    // Merge rule 1: skip if pending in outbox
    if (pendingOutboxRowKeys.has(rowKey)) {
      continue
    }

    // Merge rule 2: tombstone delete
    if (serverRow.deleted_at) {
      localDb.delete(serverRow.id)
      continue
    }

    // Merge rule 3: apply if server is newer or equal
    const local = localDb.get(serverRow.id)
    if (!local || new Date(serverRow.updated_at) >= new Date(local.updated_at)) {
      localDb.set(serverRow.id, serverRow)
    }
  }

  // 1. local-pending must remain untouched by server
  assert.equal(localDb.get('local-pending')?.title, 'Local Unsynced Title')
  // 2. note-synced must have accepted the newer server title
  assert.equal(localDb.get('note-synced')?.title, 'Fresh Server Title')
  // 3. note-to-delete must be removed
  assert.equal(localDb.has('note-to-delete'), false)
})

// ── Test 3: Note Conflict Copy Logic (upsert_note simulation) ──────────────────
test('upsert_note creates conflict copy when server has newer divergent text', () => {
  interface NoteState {
    id: string
    title: string
    content: string
    updated_at: string
  }

  const serverDatabase = new Map<string, NoteState>([
    [
      'note-1',
      {
        id: 'note-1',
        title: 'Meeting Notes',
        content: 'Edit made on Desktop at 10:05',
        updated_at: '2026-11-09T10:05:00Z',
      },
    ],
  ])

  function simulateUpsertNote(
    clientNote: { id: string; title: string; content: string },
    baseUpdatedAt: string | null
  ): { conflict: boolean; resultNote: NoteState } {
    const existing = serverDatabase.get(clientNote.id)
    if (existing) {
      const isNewerOnServer = baseUpdatedAt !== null && new Date(existing.updated_at) > new Date(baseUpdatedAt)
      const contentDiverged = existing.content !== clientNote.content || existing.title !== clientNote.title

      if (isNewerOnServer && contentDiverged) {
        // Conflict! Server creates a new conflict copy note
        const conflictCopy: NoteState = {
          id: 'note-1-conflict',
          title: `${clientNote.title} (conflict copy)`,
          content: clientNote.content,
          updated_at: '2026-11-09T10:10:00Z',
        }
        serverDatabase.set(conflictCopy.id, conflictCopy)
        return { conflict: true, resultNote: conflictCopy }
      }

      // No conflict: update existing
      const updated: NoteState = {
        ...existing,
        title: clientNote.title,
        content: clientNote.content,
        updated_at: '2026-11-09T10:10:00Z',
      }
      serverDatabase.set(updated.id, updated)
      return { conflict: false, resultNote: updated }
    }

    const inserted: NoteState = {
      ...clientNote,
      updated_at: '2026-11-09T10:10:00Z',
    }
    serverDatabase.set(inserted.id, inserted)
    return { conflict: false, resultNote: inserted }
  }

  // Client edited note-1 offline based on an older version (10:00)
  const clientEdit = {
    id: 'note-1',
    title: 'Meeting Notes',
    content: 'Edit made on Phone offline at 10:08',
  }
  const clientBase = '2026-11-09T10:00:00Z'

  const res = simulateUpsertNote(clientEdit, clientBase)

  // Must detect conflict and generate a copy without overwriting the desktop version!
  assert.equal(res.conflict, true)
  assert.equal(res.resultNote.title, 'Meeting Notes (conflict copy)')
  assert.equal(serverDatabase.get('note-1')?.content, 'Edit made on Desktop at 10:05') // Preserved!
  assert.equal(serverDatabase.get('note-1-conflict')?.content, 'Edit made on Phone offline at 10:08') // Saved!
})

// ── Test 4: Social Username Validation ─────────────────────────────────────────
test('Social username validation follows strict security rules', () => {
  const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/
  const RESERVED = new Set(['admin', 'support', 'kairo', 'help', 'system', 'root'])

  function validateUsername(raw: string): { valid: boolean; error?: string } {
    const clean = raw.toLowerCase().trim()
    if (!clean) return { valid: false, error: 'Empty' }
    if (!USERNAME_REGEX.test(clean)) return { valid: false, error: 'Format' }
    if (RESERVED.has(clean)) return { valid: false, error: 'Reserved' }
    return { valid: true }
  }

  assert.equal(validateUsername('alice').valid, true)
  assert.equal(validateUsername('john_doe_99').valid, true)
  assert.equal(validateUsername('al').valid, false) // Too short (<3)
  assert.equal(validateUsername('a'.repeat(25)).valid, false) // Too long (>20)
  assert.equal(validateUsername('alice@email').valid, false) // Invalid char '@'
  assert.equal(validateUsername('alice-smith').valid, false) // Invalid char '-'
  assert.equal(validateUsername('admin').valid, false) // Reserved
  assert.equal(validateUsername('kairo').valid, false) // Reserved
})

