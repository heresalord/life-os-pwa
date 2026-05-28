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

export function useGoalMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const invalidateGoals = () => qc.invalidateQueries({ queryKey: ['goals'] })
  const invalidateEvents = () => qc.invalidateQueries({ queryKey: ['goal_events'] })

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
    onSuccess: () => invalidateGoals()
  })

  const updateGoal = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const withTs = { ...updates, updated_at: new Date().toISOString() }
      await db.goals.update(id, withTs)
      const updated = await db.goals.get(id)
      if (updated) await write('goals', 'update', updated)
    },
    onSuccess: () => invalidateGoals()
  })

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      await db.goals.delete(id)
      await write('goals', 'delete', { id })
    },
    onSuccess: () => invalidateGoals()
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
      // Also bump the parent goal's updated_at so dashboard reflects recent activity
      const tsUpdate = { updated_at: now }
      await db.goals.update(payload.goal_id, tsUpdate)
      const updatedGoal = await db.goals.get(payload.goal_id)
      if (updatedGoal) await write('goals', 'update', updatedGoal)
      return event
    },
    onSuccess: () => { invalidateEvents(); invalidateGoals() }
  })

  return { addGoal, updateGoal, deleteGoal, addEvent }
}
