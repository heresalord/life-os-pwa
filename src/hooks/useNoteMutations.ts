import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { stripTags } from '../lib/noteTagUtils'

type AnyItem = { id: string; [key: string]: unknown }

function computeWordCount(content: string): number {
  const text = stripTags(content).trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

async function write(op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  await enqueueSync('notes', op, payload)
}

export function useNoteMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const queryKey = ['notes', undefined, user?.id]
  const invalidate = () => qc.invalidateQueries({ queryKey: ['notes'] })

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
      const note = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: payload.date,
        title: payload.title,
        content: payload.content,
        template: payload.template ?? null,
        folder: payload.folder ?? 'All',
        pinned: payload.pinned ?? false,
        is_template: payload.is_template ?? false,
        word_count: computeWordCount(payload.content),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await db.notes.add(note as Parameters<typeof db.notes.add>[0])
      await write('insert', note)
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
        word_count: computeWordCount(payload.content),
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
      // Recompute word_count if content is changing
      const existing = await db.notes.get(id)
      const newContent = (updates.content as string | undefined) ?? existing?.content ?? ''
      const withTs = {
        ...updates,
        word_count: computeWordCount(newContent),
        updated_at: new Date().toISOString(),
      }
      await db.notes.update(id, withTs)
      const updated = await db.notes.get(id)
      if (updated) await write('update', updated as Record<string, unknown>)
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

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      await db.notes.delete(id)
      await write('delete', { id })
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

  const pinNote = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      await db.notes.update(id, { pinned, updated_at: new Date().toISOString() })
      const updated = await db.notes.get(id)
      if (updated) await write('update', updated as Record<string, unknown>)
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
      await db.notes.update(id, { folder, updated_at: new Date().toISOString() })
      const updated = await db.notes.get(id)
      if (updated) await write('update', updated as Record<string, unknown>)
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

  return { addNote, updateNote, deleteNote, pinNote, moveToFolder }
}
