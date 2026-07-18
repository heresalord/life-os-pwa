import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDb } from '../db/DbContext'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { syncDayScore } from '../lib/scoreUtils'
import { QK } from '../lib/queryKeys'
import { hapticMedium, hapticSuccess } from '../lib/haptics'

type Task = { id: string; [key: string]: unknown }
type KanbanStatus = 'backlog' | 'todo' | 'in_progress' | 'done'

async function writeTask(op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  await enqueueSync('tasks', op, payload)
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
  const db = useDb()
  const { user } = useAuth()
  const qc = useQueryClient()

  const queryKey  = QK.tasks(date, user?.id ?? '')
  const invalidate = () => qc.invalidateQueries({ queryKey: QK.tasksAll() })

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
      await syncDayScore(db, user.id, task.date)
      void hapticMedium()
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
    onSettled: () => invalidate(),
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      await db.tasks.update(id, updates as Partial<Parameters<typeof db.tasks.put>[0]>)
      const updated = await db.tasks.get(id)
      if (updated && user) {
        await writeTask('update', updated as Record<string, unknown>)
        await syncDayScore(db, user.id, updated.date)
        // Fire stronger haptic when the task is being completed
        if (updates.completed === true) void hapticSuccess()
        else void hapticMedium()
      }
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey: QK.tasksAll() })
      const previous = qc.getQueryData<Task[]>(queryKey)
      qc.setQueriesData<Task[]>(
        { queryKey: QK.tasksAll() },
        old => (old ?? []).map(t => t.id === id ? { ...t, ...updates } : t)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const task = await db.tasks.get(id)
      await db.tasks.delete(id)
      await writeTask('delete', { id })
      void hapticMedium()
      if (task && user) {
        await syncDayScore(db, user.id, task.date)
      }
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QK.tasksAll() })
      const previous = qc.getQueryData<Task[]>(queryKey)
      qc.setQueriesData<Task[]>(
        { queryKey: QK.tasksAll() },
        old => (old ?? []).filter(t => t.id !== id)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  return { addTask, updateTask, deleteTask }
}
