import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useDb } from '../db/DbContext'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import { QK } from '../lib/queryKeys'
import type { Goal, HabitLog, Milestone } from '../db/schema'

export function useGoalsQuery(state = 'active') {
  const db = useDb()
  const { user } = useAuth()
  return useQuery({
    queryKey: QK.goals(state, user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.goals.where('state').equals(state).toArray()
      if (navigator.onLine) {
        bgSync(`goals-${state}-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('goals').select('*')
            .eq('user_id', user!.id).eq('state', state as 'active' | 'paused' | 'completed' | 'abandoned')
            .order('created_at', { ascending: false })
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync(db, 'goals', data as Goal[])
            await db.goals.bulkPut(reconciled)
            queryClient.setQueryData(QK.goals(state, user!.id), reconciled)
          }
        })
      }
      return local as Goal[]
    }
  })
}

export function useGoalQuery(id: string) {
  const db = useDb()
  const { user } = useAuth()
  return useQuery({
    queryKey: QK.goal(id, user?.id ?? ''),
    enabled: !!user && !!id,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.goals.get(id)
      if (!local && navigator.onLine) {
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
            queryClient.setQueryData(QK.goal(id, user!.id), data)
          }
        })
      }
      if (!local) throw new Error('Goal not found offline')
      return local
    }
  })
}

export function useHabitLogsQuery(goalId?: string) {
  const db = useDb()
  const { user } = useAuth()
  return useQuery({
    queryKey: QK.habitLogs(goalId, user?.id ?? ''),
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
            const reconciled = await reconcilePendingSync(db, 'habit_logs', data as HabitLog[])
            await db.habit_logs.bulkPut(reconciled)
            queryClient.setQueryData(QK.habitLogs(goalId, user!.id), reconciled)
          }
        })
      }
      return local
    }
  })
}

export function useMilestonesQuery(goalId?: string) {
  const db = useDb()
  const { user } = useAuth()
  return useQuery({
    queryKey: QK.milestones(goalId, user?.id ?? ''),
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
            const reconciled = await reconcilePendingSync(db, 'milestones', data as Milestone[])
            await db.milestones.bulkPut(reconciled)
            queryClient.setQueryData(QK.milestones(goalId, user!.id), reconciled)
          }
        })
      }
      return local
    }
  })
}
