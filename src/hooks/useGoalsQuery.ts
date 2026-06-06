import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import type { Goal } from '../db/schema'

export function useGoalsQuery(state = 'active') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['goals', state, user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.goals.where('state').equals(state).toArray()
      if (navigator.onLine) {
        bgSync(`goals-${state}-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('goals').select('*')
            .eq('user_id', user!.id).eq('state', state)
            .order('created_at', { ascending: false })
          if (error) throw error
          if (data) {
            await db.goals.bulkPut(data as Goal[])
            queryClient.setQueryData(['goals', state, user!.id], data)
          }
        })
      }
      return local as Goal[]
    }
  })
}

export function useGoalQuery(id: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['goal', id, user?.id],
    enabled: !!user && !!id,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.goals.get(id)
      if (!local && navigator.onLine) {
        // Not cached yet — must block on Supabase
        const { data, error } = await supabase
          .from('goals').select('*').eq('id', id).eq('user_id', user!.id).single()
        if (error) throw error
        if (data) await db.goals.put(data as Goal)
        return (data as Goal) ?? null
      }
      if (navigator.onLine && local) {
        bgSync(`goal-${id}-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('goals').select('*').eq('id', id).eq('user_id', user!.id).single()
          if (error) throw error
          if (data) {
            await db.goals.put(data as Goal)
            queryClient.setQueryData(['goal', id, user!.id], data)
          }
        })
      }
      if (!local) throw new Error('Goal not found offline')
      return local
    }
  })
}

export function useHabitLogsQuery(goalId?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['habit_logs', goalId, user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = goalId
        ? await db.habit_logs.where('goal_id').equals(goalId).reverse().toArray()
        : await db.habit_logs.where('user_id').equals(user!.id).reverse().toArray()

      if (navigator.onLine) {
        bgSync(`habit_logs-${goalId ?? 'all'}-${user!.id}`, async () => {
          let query = supabase.from('habit_logs').select('*').eq('user_id', user!.id)
          if (goalId) query = query.eq('goal_id', goalId)
          const { data, error } = await query.order('date', { ascending: false })
          if (error) throw error
          if (data) {
            await db.habit_logs.bulkPut(data)
            queryClient.setQueryData(['habit_logs', goalId, user!.id], data)
          }
        })
      }
      return local
    }
  })
}

export function useMilestonesQuery(goalId?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['milestones', goalId, user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = goalId
        ? await db.milestones.where('goal_id').equals(goalId).toArray()
        : await db.milestones.where('user_id').equals(user!.id).toArray()

      if (navigator.onLine) {
        bgSync(`milestones-${goalId ?? 'all'}-${user!.id}`, async () => {
          let query = supabase.from('milestones').select('*').eq('user_id', user!.id)
          if (goalId) query = query.eq('goal_id', goalId)
          const { data, error } = await query.order('created_at', { ascending: true })
          if (error) throw error
          if (data) {
            await db.milestones.bulkPut(data)
            queryClient.setQueryData(['milestones', goalId, user!.id], data)
          }
        })
      }
      return local
    }
  })
}
