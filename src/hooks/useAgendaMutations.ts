import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeAgenda(op: 'insert' | 'update' | 'delete', payload: any) {
  if (navigator.onLine) {
    let error = null
    if (op === 'insert')      ({ error } = await sbAny.from('agenda_blocks').insert([payload]))
    else if (op === 'update') ({ error } = await sbAny.from('agenda_blocks').update(payload).eq('id', payload.id))
    else                      ({ error } = await sbAny.from('agenda_blocks').delete().eq('id', payload.id))
    if (error) await enqueueSync('agenda_blocks', op, payload)
  } else {
    await enqueueSync('agenda_blocks', op, payload)
  }
}

export function useAgendaMutations(date: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['agenda_blocks', date, user?.id] })

  const addBlock = useMutation({
    mutationFn: async (payload: { description: string; start_time: string; end_time: string; date: string }) => {
      if (!user) return
      const block = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: payload.date,
        description: payload.description,
        start_time: payload.start_time,
        end_time: payload.end_time,
        created_at: new Date().toISOString(),
      }
      await db.agenda_blocks.add(block as Parameters<typeof db.agenda_blocks.add>[0])
      await writeAgenda('insert', block)
      return block
    },
    onSuccess: () => invalidate()
  })

  const updateBlock = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      await db.agenda_blocks.update(id, updates)
      const updated = await db.agenda_blocks.get(id)
      if (updated) await writeAgenda('update', updated)
    },
    onSuccess: () => invalidate()
  })

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      await db.agenda_blocks.delete(id)
      await writeAgenda('delete', { id })
    },
    onSuccess: () => invalidate()
  })

  return { addBlock, updateBlock, deleteBlock }
}
