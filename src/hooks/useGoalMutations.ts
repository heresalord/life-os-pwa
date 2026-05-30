import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

type AnyItem = { id: string; [key: string]: unknown }

async function write(table: string, op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
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

export function useGoalMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()

  // Invalidate all goal-related queries (any state, any user)
  const invalidateGoals  = () => qc.invalidateQueries({ queryKey: ['goals'] })
  const invalidateEvents = () => qc.invalidateQueries({ queryKey: ['goal_events'] })
  // The active-goals query key used by useGoalsQuery('active')
  const activeKey = ['goals', 'active', user?.id]

  const addGoal = useMutation({
    mutationFn: async (payload: {
      name: string
      target: number
      goal_type?: string
      measurement_type?: string
      start_date?: string
      end_date?: string
    }) => {
      if (!user) return
      const goal = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: payload.name,
        target: payload.target,
        goal_type: payload.goal_type ?? 'general',
        measurement_type: payload.measurement_type ?? 'count',
        start_date: payload.start_date ?? null,
        end_date: payload.end_date ?? null,
        state: 'active',
        is_completed: false,
        sub_goals: [],
        currency: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await db.goals.add(goal as Parameters<typeof db.goals.add>[0])
      await write('goals', 'insert', goal)
      return goal
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: activeKey })
      const previous = qc.getQueryData<AnyItem[]>(activeKey)
      const optimistic: AnyItem = {
        id: `opt-${Date.now()}`,
        user_id: user?.id,
        name: payload.name,
        target: payload.target,
        goal_type: payload.goal_type ?? 'general',
        measurement_type: payload.measurement_type ?? 'count',
        start_date: payload.start_date ?? null,
        end_date: payload.end_date ?? null,
        state: 'active',
        is_completed: false,
        sub_goals: [],
        currency: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      qc.setQueryData<AnyItem[]>(activeKey, old => [optimistic, ...(old ?? [])])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(activeKey, ctx.previous)
    },
    onSettled: () => invalidateGoals(),
  })

  const updateGoal = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const withTs = { ...updates, updated_at: new Date().toISOString() }
      await db.goals.update(id, withTs)
      const updated = await db.goals.get(id)
      if (updated) await write('goals', 'update', updated as Record<string, unknown>)
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey: ['goals'] })
      const previous = qc.getQueryData<AnyItem[]>(activeKey)
      qc.setQueryData<AnyItem[]>(activeKey, old =>
        (old ?? []).map(g => g.id === id ? { ...g, ...updates, updated_at: new Date().toISOString() } : g)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(activeKey, ctx.previous)
    },
    onSettled: () => invalidateGoals(),
  })

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      await db.goals.delete(id)
      await write('goals', 'delete', { id })
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['goals'] })
      const previous = qc.getQueryData<AnyItem[]>(activeKey)
      qc.setQueryData<AnyItem[]>(activeKey, old => (old ?? []).filter(g => g.id !== id))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(activeKey, ctx.previous)
    },
    onSettled: () => invalidateGoals(),
  })

  const addEvent = useMutation({
    mutationFn: async (payload: {
      goal_id: string
      date: string
      value: number
      event_type?: 'add' | 'subtract'
      note?: string
    }) => {
      if (!user) return
      const now = new Date().toISOString()
      const event = {
        id: crypto.randomUUID(),
        user_id: user.id,
        goal_id: payload.goal_id,
        sub_goal_id: null,
        date: payload.date,
        value: payload.value,
        event_type: payload.event_type ?? 'add',
        note: payload.note ?? null,
        new_state: null,
        old_target: null,
        new_target: null,
        created_at: now,
      }
      await db.goal_events.add(event as Parameters<typeof db.goal_events.add>[0])
      await write('goal_events', 'insert', event)
      const tsUpdate = { updated_at: now }
      await db.goals.update(payload.goal_id, tsUpdate)
      const updatedGoal = await db.goals.get(payload.goal_id)
      if (updatedGoal) await write('goals', 'update', updatedGoal as Record<string, unknown>)
      return event
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ['goal_events'] })
      const eventsKey = ['goal_events', user?.id]
      const previous = qc.getQueryData<AnyItem[]>(eventsKey)
      const optimistic: AnyItem = {
        id: `opt-${Date.now()}`,
        user_id: user?.id,
        goal_id: payload.goal_id,
        sub_goal_id: null,
        date: payload.date,
        value: payload.value,
        event_type: payload.event_type ?? 'add',
        note: payload.note ?? null,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<AnyItem[]>(eventsKey, old => [...(old ?? []), optimistic])
      return { previous, eventsKey }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(ctx.eventsKey, ctx.previous)
    },
    onSettled: () => { invalidateEvents(); invalidateGoals() },
  })

  return { addGoal, updateGoal, deleteGoal, addEvent }
}
