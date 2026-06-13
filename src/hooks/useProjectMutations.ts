import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'

type AnyItem = { id: string; [key: string]: unknown }

async function writeProject(op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  await enqueueSync('projects', op, payload)
}

export function useProjectMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const queryKey = ['projects', user?.id]
  const invalidate = () => qc.invalidateQueries({ queryKey: ['projects'] })

  const addProject = useMutation({
    mutationFn: async (payload: { name: string; color?: string | null; description?: string | null }) => {
      if (!user) return
      const project = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: payload.name,
        color: payload.color ?? null,
        description: payload.description ?? null,
        archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await db.projects.add(project as Parameters<typeof db.projects.add>[0])
      await writeProject('insert', project)
      return project
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      const optimistic: AnyItem = {
        id: `opt-${Date.now()}`,
        user_id: user?.id,
        name: payload.name,
        color: payload.color ?? null,
        description: payload.description ?? null,
        archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      qc.setQueryData<AnyItem[]>(queryKey, old => [...(old ?? []), optimistic])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  const updateProject = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const withTs = {
        ...updates,
        updated_at: new Date().toISOString(),
      }
      await db.projects.update(id, withTs)
      const updated = await db.projects.get(id)
      if (updated) await writeProject('update', updated as Record<string, unknown>)
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      qc.setQueryData<AnyItem[]>(queryKey, old =>
        (old ?? []).map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      await db.projects.delete(id)
      await writeProject('delete', { id })
      
      // Cascade delete / set null project_id on linked tasks
      const linkedTasks = await db.tasks.where('project_id').equals(id).toArray()
      for (const task of linkedTasks) {
        await db.tasks.update(task.id, { project_id: null })
        await enqueueSync('tasks', 'update', { id: task.id, project_id: null })
      }
      
      // Cascade set null project_id on linked goals
      const linkedGoals = await db.goals.where('project_id').equals(id).toArray()
      for (const goal of linkedGoals) {
        await db.goals.update(goal.id, { project_id: null })
        await enqueueSync('goals', 'update', { id: goal.id, project_id: null })
      }
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      qc.setQueryData<AnyItem[]>(queryKey, old => (old ?? []).filter(p => p.id !== id))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  return { addProject, updateProject, deleteProject }
}
