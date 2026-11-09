import type { MessageAttachment, Note, Task, InboxItem } from '../db/schema'

/**
 * Creates an immutable snapshot for a Note.
 * Strictly strips pin_hash, folder, id, user_id, dates to prevent leakage.
 * Rejects PIN-locked notes or Journal notes.
 */
export function createNoteAttachment(note: Partial<Note>): MessageAttachment {
  if (note.pin_hash) {
    throw new Error('PIN-locked notes cannot be attached or shared')
  }
  if (note.folder === 'Journal') {
    throw new Error('Journal notes are private and cannot be shared')
  }

  const title = (note.title || 'Untitled Note').trim()
  const content = (note.content || '').trim()

  const snapshot = {
    title,
    content,
    word_count: note.word_count ?? (content ? content.split(/\s+/).length : 0),
    tags: Array.isArray((note as Record<string, unknown>).tags)
      ? ((note as Record<string, unknown>).tags as string[])
      : [],
  }

  // Ensure byte size is within 100 KB limit
  const jsonStr = JSON.stringify(snapshot)
  if (new TextEncoder().encode(jsonStr).length > 100 * 1024) {
    throw new Error('Note content exceeds 100 KB attachment limit')
  }

  return {
    type: 'note',
    schema_version: 1,
    snapshot,
  }
}

/**
 * Creates an immutable snapshot for a Task.
 */
export function createTaskAttachment(task: Partial<Task>): MessageAttachment {
  const title = (task.title || 'Untitled Task').trim()
  const snapshot = {
    title,
    priority: task.priority ?? 4,
    date: task.due_date || task.date || null,
  }

  return {
    type: 'task',
    schema_version: 1,
    snapshot,
  }
}

/**
 * Creates an immutable snapshot for an Inbox item.
 */
export function createInboxAttachment(item: Partial<InboxItem>): MessageAttachment {
  const text = (item.text || '').trim()
  const snapshot = {
    text,
    type: item.type || 'text',
  }

  return {
    type: 'inbox_item',
    schema_version: 1,
    snapshot,
  }
}

