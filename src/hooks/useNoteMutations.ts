import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function write(op: 'insert' | 'update' | 'delete', payload: any) {
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
    onSuccess: () => invalidate()
  })

  const updateNote = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const withTs = { ...updates, updated_at: new Date().toISOString() }
      await db.notes.update(id, withTs)
      const updated = await db.notes.get(id)
      if (updated) await write('update', updated as Record<string, unknown>)
    },
    onSuccess: () => invalidate()
  })

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      await db.notes.delete(id)
      await write('delete', { id })
    },
    onSuccess: () => invalidate()
  })

  return { addNote, updateNote, deleteNote }
}
