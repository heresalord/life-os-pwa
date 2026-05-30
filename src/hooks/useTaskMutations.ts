import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

type Task = { id: string; [key: string]: unknown }

async function writeTask(op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  if (navigator.onLine) {
    let error = null
    if (op === 'insert')      ({ error } = await sbAny.from('tasks').insert([payload]))
    else if (op === 'update') ({ error } = await sbAny.from('tasks').update(payload).eq('id', payload.id))
    else                      ({ error } = await sbAny.from('tasks').delete().eq('id', payload.id))
    if (error) await enqueueSync('tasks', op, payload)
  } else {
    await enqueueSync('tasks', op, payload)
  }
}

export function useTaskMutations(date: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const queryKey = ['tasks', date, user?.id]

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
        created_at: new Date().toISOString(),
      }
      await db.tasks.add(task as Parameters<typeof db.tasks.add>[0])
      await writeTask('insert', task)
      return task
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<Task[]>(queryKey)
      const optimistic: Task = {
        id: `opt-${Date.now()}`,
        user_id: user?.id,
        date: payload.date,
        title: payload.title,
        completed: false,
        skipped: false,
        priority: payload.priority,
        completed_at: null,
        skipped_at: null,
        carried_from: null,
        from_inbox_id: null,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<Task[]>(queryKey, old => [...(old ?? []), optimistic])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      await db.tasks.update(id, updates)
      const updated = await db.tasks.get(id)
      if (updated) await writeTask('update', updated as Record<string, unknown>)
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<Task[]>(queryKey)
      qc.setQueryData<Task[]>(queryKey, old =>
        (old ?? []).map(t => t.id === id ? { ...t, ...updates } : t)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await db.tasks.delete(id)
      await writeTask('delete', { id })
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<Task[]>(queryKey)
      qc.setQueryData<Task[]>(queryKey, old => (old ?? []).filter(t => t.id !== id))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  })

  return { addTask, updateTask, deleteTask }
}
