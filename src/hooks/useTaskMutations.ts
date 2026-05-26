import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { supabase as supa } from '../lib/supabase'
const supabaseAny = supa as any

export function useTaskMutations(date: string) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tasks', date, user?.id] })

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
      // Always write to local first (instant UI)
      await db.tasks.add(task as Parameters<typeof db.tasks.add>[0])

      if (navigator.onLine) {
        // Online: write directly to Supabase
        const { error } = await supabaseAny.from('tasks').insert([task])
        if (error) {
          // Failed — queue for retry
          await enqueueSync('tasks', 'insert', task)
        }
      } else {
        // Offline: queue for later
        await enqueueSync('tasks', 'insert', task)
      }
      return task
    },
    onSuccess: () => invalidate()
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      await db.tasks.update(id, updates)
      const updated = await db.tasks.get(id)

      if (navigator.onLine) {
        const { error } = await supabaseAny.from('tasks').update(updates).eq('id', id)
        if (error) await enqueueSync('tasks', 'update', updated)
      } else {
        await enqueueSync('tasks', 'update', updated)
      }
    },
    onSuccess: () => invalidate()
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await db.tasks.delete(id)

      if (navigator.onLine) {
        const { error } = await supabaseAny.from('tasks').delete().eq('id', id)
        if (error) await enqueueSync('tasks', 'delete', { id })
      } else {
        await enqueueSync('tasks', 'delete', { id })
      }
    },
    onSuccess: () => invalidate()
  })

  return { addTask, updateTask, deleteTask }
}
