import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createNoteAttachment,
  createTaskAttachment,
  createInboxAttachment,
} from '../src/lib/attachmentUtils.ts'

// ── Test 1: Snapshot creation strips unsafe fields and enforces privacy ──────
test('createNoteAttachment enforces no pin_hash, no Journal notes, and strips IDs', () => {
  // 1. PIN-locked notes are strictly rejected
  assert.throws(
    () => {
      createNoteAttachment({
        id: 'note-1',
        title: 'Secret Vault',
        content: 'Password123',
        pin_hash: 'abc123hash',
      } as any)
    },
    { message: /PIN-locked notes cannot be attached/ }
  )

  // 2. Journal notes are strictly rejected
  assert.throws(
    () => {
      createNoteAttachment({
        id: 'note-2',
        title: 'Personal Reflections',
        content: 'Dear diary...',
        folder: 'Journal',
      } as any)
    },
    { message: /Journal notes are private and cannot be shared/ }
  )

  // 3. Valid note creates clean snapshot with only safe fields
  const safeAttachment = createNoteAttachment({
    id: 'note-3',
    user_id: 'user-xyz',
    title: 'Project Roadmap',
    content: '# Roadmap\n- Item 1\n- Item 2',
    folder: 'Work',
    date: '2026-11-09',
    tags: ['work', 'planning'],
    created_at: '2026-11-01T00:00:00Z',
  } as any)

  assert.equal(safeAttachment.type, 'note')
  assert.equal(safeAttachment.schema_version, 1)
  assert.equal(safeAttachment.snapshot.title, 'Project Roadmap')
  assert.equal(safeAttachment.snapshot.content, '# Roadmap\n- Item 1\n- Item 2')
  assert.deepEqual(safeAttachment.snapshot.tags, ['work', 'planning'])
  assert.equal(safeAttachment.snapshot.word_count, 8)

  // Ensure forbidden fields are not present on snapshot
  assert.equal((safeAttachment.snapshot as any).id, undefined)
  assert.equal((safeAttachment.snapshot as any).user_id, undefined)
  assert.equal((safeAttachment.snapshot as any).folder, undefined)
  assert.equal((safeAttachment.snapshot as any).pin_hash, undefined)
  assert.equal((safeAttachment.snapshot as any).date, undefined)
})

// ── Test 2: Size limit checks on attachments (< 100 KB) ───────────────────────
test('createNoteAttachment enforces 100 KB payload cap', () => {
  // Generate 120 KB of text
  const hugeText = 'A'.repeat(120 * 1024)

  assert.throws(
    () => {
      createNoteAttachment({
        title: 'Huge Note',
        content: hugeText,
      })
    },
    { message: /exceeds 100 KB attachment limit/ }
  )
})

// ── Test 3: Task & Inbox attachment snapshots ────────────────────────────────
test('createTaskAttachment and createInboxAttachment produce immutable snapshots', () => {
  const taskAttachment = createTaskAttachment({
    id: 'task-100',
    title: 'Buy groceries',
    priority: 1,
    date: '2026-11-15',
    completed: false,
    user_id: 'user-xyz',
  } as any)

  assert.equal(taskAttachment.type, 'task')
  assert.equal(taskAttachment.schema_version, 1)
  assert.equal(taskAttachment.snapshot.title, 'Buy groceries')
  assert.equal(taskAttachment.snapshot.priority, 1)
  assert.equal(taskAttachment.snapshot.date, '2026-11-15')
  assert.equal((taskAttachment.snapshot as any).id, undefined)
  assert.equal((taskAttachment.snapshot as any).completed, undefined)

  const inboxAttachment = createInboxAttachment({
    id: 'inbox-50',
    text: 'Read article on CRDTs',
    type: 'url',
    processed: false,
  } as any)

  assert.equal(inboxAttachment.type, 'inbox_item')
  assert.equal(inboxAttachment.schema_version, 1)
  assert.equal(inboxAttachment.snapshot.text, 'Read article on CRDTs')
  assert.equal(inboxAttachment.snapshot.type, 'url')
  assert.equal((inboxAttachment.snapshot as any).id, undefined)
})

// ── Test 4: Idempotent message deduplication simulation ───────────────────────
test('Client-generated UUID idempotency prevents duplicates', () => {
  const messagesStore = new Map<string, any>()

  const receiveMessageRPC = (params: {
    id: string
    conversation_id: string
    sender_id: string
    body: string
  }) => {
    // Mimics Postgres "ON CONFLICT (id) DO NOTHING"
    if (messagesStore.has(params.id)) {
      return { inserted: false, message: messagesStore.get(params.id) }
    }
    messagesStore.set(params.id, { ...params, created_at: new Date().toISOString() })
    return { inserted: true, message: messagesStore.get(params.id) }
  }

  const clientId = 'msg-uuid-1234-5678'

  // Attempt 1 (online or offline queue push)
  const res1 = receiveMessageRPC({
    id: clientId,
    conversation_id: 'conv-1',
    sender_id: 'user-1',
    body: 'Hello World',
  })
  assert.equal(res1.inserted, true)
  assert.equal(messagesStore.size, 1)

  // Attempt 2 (network retry or reconnected sync replay)
  const res2 = receiveMessageRPC({
    id: clientId,
    conversation_id: 'conv-1',
    sender_id: 'user-1',
    body: 'Hello World',
  })
  assert.equal(res2.inserted, false)
  assert.equal(messagesStore.size, 1)
  assert.equal(res2.message.id, clientId)
})

// ── Test 5: 15-minute edit window rule ───────────────────────────────────────
test('Message editing enforces 15-minute window', () => {
  const canEdit = (createdAtISO: string, senderId: string, currentUserId: string): boolean => {
    if (senderId !== currentUserId) return false
    const ageMs = Date.now() - new Date(createdAtISO).getTime()
    return ageMs < 15 * 60 * 1000
  }

  const myId = 'user-alex'
  const otherId = 'user-bob'

  // 5 minutes old
  const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  assert.equal(canEdit(recent, myId, myId), true)
  assert.equal(canEdit(recent, otherId, myId), false) // Can't edit other's msg

  // 20 minutes old
  const expired = new Date(Date.now() - 20 * 60 * 1000).toISOString()
  assert.equal(canEdit(expired, myId, myId), false)
})
