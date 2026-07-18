import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDb } from '../db/DbContext'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { QK } from '../lib/queryKeys'
import { hapticMedium } from '../lib/haptics'

type AnyItem = { id: string; [key: string]: unknown }

async function write(table: string, op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  await enqueueSync(table, op, payload)
}

export function useInboxMutations() {
  const db = useDb()
  const { user } = useAuth()
  const qc = useQueryClient()

  const queryKey = QK.inbox(false, user?.id ?? '')
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.inboxAll() })
    qc.invalidateQueries({ queryKey: QK.tasksAll() })
  }

  const addItem = useMutation({
    mutationFn: async (text: string) => {
      if (!user) return
      const item = {
        id: crypto.randomUUID(),
        user_id: user.id,
        text,
        type: 'todo' as const,
        processed: false,
        processed_at: null,
        processed_to: null,
        archived_at: null,
        captured_at: new Date().toISOString(),
      }
      await db.inbox_items.add(item as Parameters<typeof db.inbox_items.add>[0])
      await write('inbox_items', 'insert', item)
      void hapticMedium()
      return item
    },
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      const optimistic: AnyItem = {
        id: `opt-${Date.now()}`,
        user_id: user?.id,
        text,
        type: 'todo',
        processed: false,
        processed_at: null,
        processed_to: null,
        archived_at: null,
        captured_at: new Date().toISOString(),
      }
      qc.setQueryData<AnyItem[]>(queryKey, old => [optimistic, ...(old ?? [])])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QK.inboxAll() }),
  })

  const processItem = useMutation({
    mutationFn: async ({ id, updates, target }: {
      id: string
      updates: Record<string, unknown>
      target?: { type: 'task'; title: string; priority: number | null; date: string }
    }) => {
      if (!user) return
      await db.inbox_items.update(id, updates)
      const updated = await db.inbox_items.get(id)
      if (updated) await write('inbox_items', 'update', updated as Record<string, unknown>)
      void hapticMedium()

      if (target?.type === 'task') {
        const task = {
          id: crypto.randomUUID(),
          user_id: user.id,
          date: target.date,
          title: target.title,
          completed: false,
          skipped: false,
          priority: target.priority,
          completed_at: null,
          skipped_at: null,
          carried_from: null,
          from_inbox_id: id,
          created_at: new Date().toISOString(),
        }
        await db.tasks.add(task as Parameters<typeof db.tasks.add>[0])
        await write('tasks', 'insert', task)
      }
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      qc.setQueryData<AnyItem[]>(queryKey, old =>
        (old ?? []).map(item => item.id === id ? { ...item, ...updates } : item)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await db.inbox_items.delete(id)
      await write('inbox_items', 'delete', { id })
      void hapticMedium()
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      qc.setQueryData<AnyItem[]>(queryKey, old => (old ?? []).filter(item => item.id !== id))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QK.inboxAll() }),
  })

  return { addItem, processItem, deleteItem }
}
