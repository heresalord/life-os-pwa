import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import type { Task } from '../db/schema'

export function useTasksQuery(date: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tasks', date, user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.tasks.where('date').equals(date).sortBy('created_at')

      if (navigator.onLine) {
        bgSync(`tasks-${date}-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('tasks').select('*')
            .eq('date', date).eq('user_id', user!.id)
            .order('created_at')
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync('tasks', data as Task[])
            await db.tasks.bulkPut(reconciled)
            queryClient.setQueryData(['tasks', date, user!.id], reconciled)
          }
        })
      }

      return local
    }
  })
}
