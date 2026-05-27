import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function write(table: string, op: 'insert' | 'update' | 'delete', payload: any) {
  if (navigator.onLine) {
    let error = null
    if (op === 'insert')      ({ error } = await sbAny.from(table).insert([payload]))
    else if (op === 'update') ({ error } = await sbAny.from(table).update(payload).eq('id', payload.id))
    else                      ({ error } = await sbAny.from(table).delete().eq('id', payload.id))
    if (error) await enqueueSync(table, op, payload)
  } else {
    await enqueueSync(table, op, payload)
  }
}

export function useInboxMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inbox_items'] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const processItem = useMutation({
    mutationFn: async ({ id, updates, target }: {
      id: string
      updates: Record<string, unknown>
      target?: { type: 'task'; title: string; priority: number | null; date: string }
    }) => {
      if (!user) return
      await db.inbox_items.update(id, updates)
      const updated = await db.inbox_items.get(id)
      if (updated) await write('inbox_items', 'update', updated)

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
    onSuccess: () => invalidate()
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await db.inbox_items.delete(id)
      await write('inbox_items', 'delete', { id })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox_items'] })
  })

  return { processItem, deleteItem }
}
