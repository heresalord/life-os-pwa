import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useTasksQuery(date: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tasks', date, user?.id],
    enabled: !!user,
    staleTime: 0, // always consider stale so it refetches on focus/mount
    queryFn: async () => {
      if (navigator.onLine) {
        // Online: fetch from Supabase, update local cache
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('date', date)
          .eq('user_id', user!.id)
          .order('created_at')
        if (error) throw error
        if (data) await db.tasks.bulkPut(data as Parameters<typeof db.tasks.bulkPut>[0])
        return data ?? []
      } else {
        // Offline: read from IndexedDB
        return db.tasks.where('date').equals(date).sortBy('created_at')
      }
    }
  })
}
