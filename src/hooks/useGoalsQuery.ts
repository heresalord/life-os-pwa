import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import type { Goal } from '../db/schema'

export function useGoalsQuery(state = 'active') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['goals', state, user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('goals').select('*')
          .eq('user_id', user!.id).eq('state', state)
          .order('created_at', { ascending: false })
        if (error) throw error
        if (data) await db.goals.bulkPut(data as Goal[])
        return (data ?? []) as Goal[]
      }
      return db.goals.where('state').equals(state).toArray()
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
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('goals').select('*')
          .eq('id', id).eq('user_id', user!.id)
          .single()
        if (error) throw error
        if (data) await db.goals.put(data as Goal)
        return data as Goal
      }
      const local = await db.goals.get(id)
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
      if (navigator.onLine) {
        let query = supabase.from('habit_logs').select('*').eq('user_id', user!.id)
        if (goalId) query = query.eq('goal_id', goalId)
        const { data, error } = await query.order('date', { ascending: false })
        if (error) throw error
        if (data) await db.habit_logs.bulkPut(data)
        return data ?? []
      }
      if (goalId) {
        return db.habit_logs.where('goal_id').equals(goalId).reverse().toArray()
      }
      return db.habit_logs.where('user_id').equals(user!.id).reverse().toArray()
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
      if (navigator.onLine) {
        let query = supabase.from('milestones').select('*').eq('user_id', user!.id)
        if (goalId) query = query.eq('goal_id', goalId)
        const { data, error } = await query.order('created_at', { ascending: true })
        if (error) throw error
        if (data) await db.milestones.bulkPut(data)
        return data ?? []
      }
      if (goalId) {
        return db.milestones.where('goal_id').equals(goalId).toArray()
      }
      return db.milestones.where('user_id').equals(user!.id).toArray()
    }
  })
}
