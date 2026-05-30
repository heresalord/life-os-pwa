import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

type AnyItem = { id: string; [key: string]: unknown }

async function write(op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  if (navigator.onLine) {
    let error = null
    if (op === 'insert')      ({ error } = await sbAny.from('notes').insert([payload]))
    else if (op === 'update') ({ error } = await sbAny.from('notes').update(payload).eq('id', payload.id))
    else                      ({ error } = await sbAny.from('notes').delete().eq('id', payload.id))
    if (error) await enqueueSync('notes', op, payload)
  } else {
    await enqueueSync('notes', op, payload)
  }
}

export function useNoteMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()
  // NotesPage uses useNotesQuery() with no date → key is ['notes', undefined, userId]
  const queryKey = ['notes', undefined, user?.id]
  const invalidate = () => qc.invalidateQueries({ queryKey: ['notes'] })

  const addNote = useMutation({
    mutationFn: async (payload: { title: string; content: string; date: string; template?: string | null }) => {
      if (!user) return
      const note = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: payload.date,
        title: payload.title,
        content: payload.content,
        template: payload.template ?? null,
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      // Notes are sorted newest first
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
      const withTs = { ...updates, updated_at: new Date().toISOString() }
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

  return { addNote, updateNote, deleteNote }
}
