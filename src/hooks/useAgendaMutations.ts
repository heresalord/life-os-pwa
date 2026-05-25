
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'

export function useAgendaMutations(date: string) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const addBlock = useMutation({
    mutationFn: async (payload: { title: string; start_time: string; end_time: string; type: string; date: string }) => {
      if (!user) return
      const block = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: payload.date,
        title: payload.title,
        start_time: payload.start_time,
        end_time: payload.end_time,
        type: payload.type,
        created_at: new Date().toISOString()
      }
      await db.agenda_blocks.add(block as any)
      await enqueueSync('agenda_blocks', 'insert', block)
      return block
    },
    onSuccess: (_, variables) => qc.invalidateQueries({ queryKey: ['agenda_blocks', variables.date] })
  })

  const updateBlock = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      await db.agenda_blocks.update(id, updates)
      const updated = await db.agenda_blocks.get(id)
      await enqueueSync('agenda_blocks', 'update', updated)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda_blocks', date] })
  })

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      await db.agenda_blocks.delete(id)
      await enqueueSync('agenda_blocks', 'delete', { id })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda_blocks', date] })
  })

  return { addBlock, updateBlock, deleteBlock }
}
