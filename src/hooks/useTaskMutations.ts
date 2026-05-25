
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'

export function useTaskMutations(date: string) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const addTask = useMutation({
    mutationFn: async (payload: { title: string; priority: number | null; date: string }) => {
      if (!user) return
      const task = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: payload.date,
        title: payload.title,
        completed: false,
        skipped: false,
        priority: payload.priority,
        completed_at: null,
        skipped_at: null,
        carried_from: null,
        from_inbox_id: null,
        created_at: new Date().toISOString()
      }
      await db.tasks.add(task as any)
      await enqueueSync('tasks', 'insert', task)
      return task
    },
    onSuccess: (_, variables) => qc.invalidateQueries({ queryKey: ['tasks', variables.date] })
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      await db.tasks.update(id, updates)
      const updated = await db.tasks.get(id)
      await enqueueSync('tasks', 'update', updated)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', date] })
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await db.tasks.delete(id)
      await enqueueSync('tasks', 'delete', { id })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', date] })
  })

  return { addTask, updateTask, deleteTask }
}
