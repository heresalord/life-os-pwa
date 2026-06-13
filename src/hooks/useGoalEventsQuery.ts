import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import type { GoalEvent } from '../db/schema'

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
            const reconciled = await reconcilePendingSync('goal_events', data as GoalEvent[])
            await db.goal_events.bulkPut(reconciled)
            queryClient.setQueryData(['goal_events', goalIds, user!.id], reconciled)
          }
        })
      }

      return local
    }
  })
}
