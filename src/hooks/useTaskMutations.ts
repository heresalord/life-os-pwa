import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

type Task = { id: string; [key: string]: unknown }
type KanbanStatus = 'backlog' | 'todo' | 'in_progress' | 'done'

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

export interface AddTaskPayload {
  title: string
  priority?: number | null
  date: string
  due_date?: string | null
  description?: string | null
  kanban_status?: KanbanStatus
  tags?: string[]
  subtasks?: { id: string; title: string; completed: boolean }[]
  time_block_start?: string | null
  time_block_end?: string | null
  project_id?: string | null
}

export function useTaskMutations(date: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const queryKey = ['tasks', date, user?.id]
  const invalidateAll = () => qc.invalidateQueries({ queryKey: ['tasks'] })

  const addTask = useMutation({
    mutationFn: async (payload: AddTaskPayload) => {
      if (!user) return
      const task = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: payload.date,
        title: payload.title,
        completed: false,
        skipped: false,
        priority: payload.priority ?? null,
        completed_at: null,
        skipped_at: null,
        carried_from: null,
        from_inbox_id: null,
        due_date: payload.due_date ?? null,
        description: payload.description ?? null,
        tags: payload.tags ?? [],
        subtasks: payload.subtasks ?? [],
        kanban_status: payload.kanban_status ?? 'todo',
        project_id: payload.project_id ?? null,
        time_block_start: payload.time_block_start ?? null,
        time_block_end: payload.time_block_end ?? null,
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
        priority: payload.priority ?? null,
        completed_at: null,
        skipped_at: null,
        carried_from: null,
        from_inbox_id: null,
        due_date: payload.due_date ?? null,
        description: payload.description ?? null,
        tags: payload.tags ?? [],
        subtasks: payload.subtasks ?? [],
        kanban_status: payload.kanban_status ?? 'todo',
        project_id: payload.project_id ?? null,
        time_block_start: payload.time_block_start ?? null,
        time_block_end: payload.time_block_end ?? null,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<Task[]>(queryKey, old => [...(old ?? []), optimistic])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidateAll(),
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      await db.tasks.update(id, updates)
      const updated = await db.tasks.get(id)
      if (updated) await writeTask('update', updated as Record<string, unknown>)
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueryData<Task[]>(queryKey)
      // Update in all cached task queries (kanban reads from a broader query)
      qc.setQueriesData<Task[]>(
        { queryKey: ['tasks'] },
        old => (old ?? []).map(t => t.id === id ? { ...t, ...updates } : t)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidateAll(),
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await db.tasks.delete(id)
      await writeTask('delete', { id })
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueryData<Task[]>(queryKey)
      qc.setQueriesData<Task[]>(
        { queryKey: ['tasks'] },
        old => (old ?? []).filter(t => t.id !== id)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidateAll(),
  })

  return { addTask, updateTask, deleteTask }
}
