
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useGoalEventsQuery(goalIds: string[]) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['goal_events', goalIds],
    enabled: !!user && goalIds.length > 0,
    queryFn: async () => {
      const local = await db.goal_events.where('goal_id').anyOf(goalIds).toArray()
      if (local.length) return local
      
      const { data } = await supabase.from('goal_events').select('*').in('goal_id', goalIds).eq('user_id', user!.id)
      if (data?.length) await db.goal_events.bulkPut(data as any)
      return data ?? []
    }
  })
}
