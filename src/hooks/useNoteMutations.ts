
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'

export function useNoteMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const addNote = useMutation({
    mutationFn: async (payload: { title: string; content: string; date: string; template?: string }) => {
      if (!user) return
      const note = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: payload.date,
        title: payload.title,
        content: payload.content,
        template: payload.template || 'free',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      await db.notes.add(note as any)
      await enqueueSync('notes', 'insert', note)
      return note
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] })
  })

  const updateNote = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      updates.updated_at = new Date().toISOString()
      await db.notes.update(id, updates)
      const updated = await db.notes.get(id)
      await enqueueSync('notes', 'update', updated)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] })
  })

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      await db.notes.delete(id)
      await enqueueSync('notes', 'delete', { id })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] })
  })

  return { addNote, updateNote, deleteNote }
}
