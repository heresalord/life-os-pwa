import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDb } from '../db/DbContext'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'

import { QK } from '../lib/queryKeys'

type AnyItem = { id: string; [key: string]: unknown }

async function writeAgenda(op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  await enqueueSync('agenda_blocks', op, payload)
}

export function getActualBlockId(id: string): string {
  if (id.startsWith('virtual__')) {
    const parts = id.split('__')
    return parts[1] || id
  }
  // Check for legacy virtual ID formatted as uuid-YYYY-MM-DD
  const legacyMatch = id.match(/^([0-9a-fA-F-]{36})-\d{4}-\d{2}-\d{2}$/)
  if (legacyMatch) {
    return legacyMatch[1]
  }
  return id
}

export function useAgendaMutations(date: string) {
  const db = useDb()
  const { user } = useAuth()
  const qc = useQueryClient()
  const queryKey = QK.agenda(date, user?.id ?? '')
  const invalidate = () => qc.invalidateQueries({ queryKey: QK.agendaAll() })

  const addBlock = useMutation({
    mutationFn: async (payload: { description: string; start_time: string; end_time: string; date: string; all_day?: boolean; recurrence?: any }) => {
      if (!user) return
      const block = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: payload.date,
        description: payload.description,
        start_time: payload.start_time,
        end_time: payload.end_time,
        all_day: payload.all_day ?? false,
        recurrence: payload.recurrence ?? null,
        created_at: new Date().toISOString(),
      }
      await db.agenda_blocks.add(block as Parameters<typeof db.agenda_blocks.add>[0])
      await writeAgenda('insert', block)
      return block
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      const optimistic: AnyItem = {
        id: `opt-${Date.now()}`,
        user_id: user?.id,
        date: payload.date,
        description: payload.description,
        start_time: payload.start_time,
        end_time: payload.end_time,
        all_day: payload.all_day ?? false,
        recurrence: payload.recurrence ?? null,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<AnyItem[]>(queryKey, old => [...(old ?? []), optimistic])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  const updateBlock = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const originalId = getActualBlockId(id)
      await db.agenda_blocks.update(originalId, updates as Partial<Parameters<typeof db.agenda_blocks.put>[0]>)
      const updated = await db.agenda_blocks.get(originalId)
      if (updated) await writeAgenda('update', updated as Record<string, unknown>)
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      const originalId = getActualBlockId(id)
      qc.setQueryData<AnyItem[]>(queryKey, old =>
        (old ?? []).map(b => (b.id === id || getActualBlockId(b.id) === originalId) ? { ...b, ...updates } : b)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      const originalId = getActualBlockId(id)
      await db.agenda_blocks.delete(originalId)
      await writeAgenda('delete', { id: originalId })
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      const originalId = getActualBlockId(id)
      qc.setQueryData<AnyItem[]>(queryKey, old => (old ?? []).filter(b => b.id !== id && getActualBlockId(b.id) !== originalId))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  return { addBlock, updateBlock, deleteBlock }
}
