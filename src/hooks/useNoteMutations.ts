import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDb } from '../db/DbContext'
import { useAuth } from './useAuth'
import { stripTags } from '../lib/noteTagUtils'
import { QK } from '../lib/queryKeys'
import { enqueueOutboxItem } from '../lib/sync'
import type { Note } from '../db/schema'

type AnyItem = { id: string; [key: string]: unknown }

function computeWordCount(content: string): number {
  const text = stripTags(content).trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

/** SHA-256 hash a PIN string — plain PIN is never stored. */
export async function hashPin(pin: string): Promise<string> {
  const encoded = new TextEncoder().encode(pin)
  const buffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Verify a plain PIN against a stored hash. */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const computed = await hashPin(pin)
  return computed === hash
}

export function useNoteMutations() {
  const db = useDb()
  const { user } = useAuth()
  const qc = useQueryClient()
  const queryKey = QK.notes(undefined, user?.id ?? '')
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.notesAll() })
    qc.invalidateQueries({ queryKey: ['trash', 'notes'] })
  }

  const addNote = useMutation({
    mutationFn: async (payload: {
      title: string
      content: string
      date: string
      template?: string | null
      folder?: string
      pinned?: boolean
      is_template?: boolean
    }) => {
      if (!user) return
      const note: Note = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: payload.date,
        title: payload.title,
        content: payload.content,
        template: (payload.template as any) ?? null,
        folder: payload.folder ?? 'All',
        pinned: payload.pinned ?? false,
        is_template: payload.is_template ?? false,
        pin_hash: null,
        word_count: computeWordCount(payload.content),
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      // Single Dexie transaction: row + outbox entry written atomically
      await db.transaction('rw', [db.notes, db.outbox], async () => {
        await db.notes.add(note)
        await enqueueOutboxItem(db, 'notes', 'insert', note.id, note as unknown as Record<string, unknown>, null)
      })
      return note
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      const optimistic: AnyItem = {
        id: `opt-${Date.now()}`,
        user_id: user?.id,
        date: payload.date,
        title: payload.title,
        content: payload.content,
        template: payload.template ?? null,
        folder: payload.folder ?? 'All',
        pinned: payload.pinned ?? false,
        is_template: payload.is_template ?? false,
        pin_hash: null,
        word_count: computeWordCount(payload.content),
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      qc.setQueryData<AnyItem[]>(queryKey, old => [optimistic, ...(old ?? [])])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  const updateNote = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const existing = await db.notes.get(id)
      const baseUpdatedAt = existing?.updated_at || null
      const newContent = (updates.content as string | undefined) ?? existing?.content ?? ''
      const withTs = {
        ...updates,
        word_count: computeWordCount(newContent),
        updated_at: new Date().toISOString(),
      }

      await db.transaction('rw', [db.notes, db.outbox], async () => {
        await db.notes.update(id, withTs)
        const updated = await db.notes.get(id)
        if (updated) {
          await enqueueOutboxItem(
            db,
            'notes',
            'update',
            id,
            updated as unknown as Record<string, unknown>,
            baseUpdatedAt
          )
        }
      })
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      qc.setQueryData<AnyItem[]>(queryKey, old =>
        (old ?? []).map(n => n.id === id ? { ...n, ...updates, updated_at: new Date().toISOString() } : n)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  // Soft delete (tombstone) — moves note to Trash
  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const now = new Date().toISOString()
      await db.transaction('rw', [db.notes, db.outbox], async () => {
        await db.notes.update(id, { deleted_at: now, updated_at: now })
        await enqueueOutboxItem(db, 'notes', 'delete', id, { id, deleted_at: now, updated_at: now })
      })
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      qc.setQueryData<AnyItem[]>(queryKey, old => (old ?? []).filter(n => n.id !== id))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  // Restore soft-deleted note from Trash
  const restoreNote = useMutation({
    mutationFn: async (id: string) => {
      const now = new Date().toISOString()
      await db.transaction('rw', [db.notes, db.outbox], async () => {
        await db.notes.update(id, { deleted_at: null, updated_at: now })
        const updated = await db.notes.get(id)
        if (updated) {
          await enqueueOutboxItem(db, 'notes', 'update', id, updated as unknown as Record<string, unknown>)
        }
      })
    },
    onSettled: () => invalidate(),
  })

  // Permanent hard delete
  const permanentDeleteNote = useMutation({
    mutationFn: async (id: string) => {
      await db.transaction('rw', [db.notes, db.outbox], async () => {
        await db.notes.delete(id)
        await enqueueOutboxItem(db, 'notes', 'delete', id, { id, permanent: true })
      })
    },
    onSettled: () => invalidate(),
  })

  const pinNote = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const now = new Date().toISOString()
      await db.transaction('rw', [db.notes, db.outbox], async () => {
        await db.notes.update(id, { pinned, updated_at: now })
        const updated = await db.notes.get(id)
        if (updated) {
          await enqueueOutboxItem(db, 'notes', 'update', id, updated as unknown as Record<string, unknown>)
        }
      })
    },
    onMutate: async ({ id, pinned }) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      qc.setQueryData<AnyItem[]>(queryKey, old =>
        (old ?? []).map(n => n.id === id ? { ...n, pinned } : n)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  const moveToFolder = useMutation({
    mutationFn: async ({ id, folder }: { id: string; folder: string }) => {
      const now = new Date().toISOString()
      await db.transaction('rw', [db.notes, db.outbox], async () => {
        await db.notes.update(id, { folder, updated_at: now })
        const updated = await db.notes.get(id)
        if (updated) {
          await enqueueOutboxItem(db, 'notes', 'update', id, updated as unknown as Record<string, unknown>)
        }
      })
    },
    onMutate: async ({ id, folder }) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      qc.setQueryData<AnyItem[]>(queryKey, old =>
        (old ?? []).map(n => n.id === id ? { ...n, folder } : n)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  /** Set a PIN on a note — stores SHA-256 hash in DB. */
  const setPinHash = useMutation({
    mutationFn: async ({ id, pin }: { id: string; pin: string }) => {
      const pin_hash = await hashPin(pin)
      const now = new Date().toISOString()
      await db.transaction('rw', [db.notes, db.outbox], async () => {
        await db.notes.update(id, { pin_hash, updated_at: now })
        const updated = await db.notes.get(id)
        if (updated) {
          await enqueueOutboxItem(db, 'notes', 'update', id, updated as unknown as Record<string, unknown>)
        }
      })
      return { id, pin_hash }
    },
    onMutate: async ({ id, pin }) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      const pin_hash = await hashPin(pin)
      qc.setQueryData<AnyItem[]>(queryKey, old =>
        (old ?? []).map(n => n.id === id ? { ...n, pin_hash } : n)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  /** Remove PIN lock from a note. */
  const clearPinHash = useMutation({
    mutationFn: async (id: string) => {
      const now = new Date().toISOString()
      await db.transaction('rw', [db.notes, db.outbox], async () => {
        await db.notes.update(id, { pin_hash: null, updated_at: now })
        const updated = await db.notes.get(id)
        if (updated) {
          await enqueueOutboxItem(db, 'notes', 'update', id, updated as unknown as Record<string, unknown>)
        }
      })
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      qc.setQueryData<AnyItem[]>(queryKey, old =>
        (old ?? []).map(n => n.id === id ? { ...n, pin_hash: null } : n)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  return {
    addNote,
    updateNote,
    deleteNote,
    restoreNote,
    permanentDeleteNote,
    pinNote,
    moveToFolder,
    setPinHash,
    clearPinHash,
  }
}

