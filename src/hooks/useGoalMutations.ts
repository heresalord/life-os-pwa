
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'

export function useGoalMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const addGoal = useMutation({
    mutationFn: async (payload: { name: string; target: number; frequency: string }) => {
      if (!user) return
      const goal = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: payload.name,
        target: payload.target,
        frequency: payload.frequency,
        state: 'active',
        created_at: new Date().toISOString()
      }
      await db.goals.add(goal as any)
      await enqueueSync('goals', 'insert', goal)
      return goal
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] })
  })

  const updateGoal = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      await db.goals.update(id, updates)
      const updated = await db.goals.get(id)
      await enqueueSync('goals', 'update', updated)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] })
  })

  const addEvent = useMutation({
    mutationFn: async (payload: { goal_id: string; date: string; value: number }) => {
      if (!user) return
      const event = {
        id: crypto.randomUUID(),
        user_id: user.id,
        goal_id: payload.goal_id,
        date: payload.date,
        value: payload.value,
        created_at: new Date().toISOString()
      }
      await db.goal_events.add(event as any)
      await enqueueSync('goal_events', 'insert', event)
      return event
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goal_events'] })
  })

  return { addGoal, updateGoal, addEvent }
}
