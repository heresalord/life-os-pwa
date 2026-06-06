import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'

export function useGoalEventsQuery(goalIds: string[]) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['goal_events', goalIds, user?.id],
    enabled: !!user && goalIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.goal_events.where('goal_id').anyOf(goalIds).toArray()

      if (navigator.onLine) {
        const syncKey = `goal_events-${goalIds.slice().sort().join(',')}-${user!.id}`
        bgSync(syncKey, async () => {
          const { data, error } = await supabase
            .from('goal_events').select('*')
            .in('goal_id', goalIds).eq('user_id', user!.id)
            .order('created_at', { ascending: false })
          if (error) throw error
          if (data) {
            await db.goal_events.bulkPut(data as Parameters<typeof db.goal_events.bulkPut>[0])
            queryClient.setQueryData(['goal_events', goalIds, user!.id], data)
          }
        })
      }

      return local
    }
  })
}
