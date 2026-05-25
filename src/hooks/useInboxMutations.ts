
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'

export function useInboxMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const processItem = useMutation({
    mutationFn: async ({ id, updates, target }: { id: string; updates: any; target?: { type: 'task', title: string, priority: number | null, date: string } }) => {
      if (!user) return

      // Update Inbox Item
      await db.inbox_items.update(id, updates)
      const updated = await db.inbox_items.get(id)
      await enqueueSync('inbox_items', 'update', updated)

      // Create target entity if required
      if (target && target.type === 'task') {
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
          created_at: new Date().toISOString()
        }
        await db.tasks.add(task as any)
        await enqueueSync('tasks', 'insert', task)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox_items'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    }
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await db.inbox_items.delete(id)
      await enqueueSync('inbox_items', 'delete', { id })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox_items'] })
  })

  return { processItem, deleteItem }
}
