import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'

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
            await db.tasks.bulkPut(data as Parameters<typeof db.tasks.bulkPut>[0])
            queryClient.setQueryData(['tasks', date, user!.id], data)
          }
        })
      }

      return local
    }
  })
}
