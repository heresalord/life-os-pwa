
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useTasksQuery(date: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tasks', date],
    enabled: !!user,
    queryFn: async () => {
      const local = await db.tasks.where('date').equals(date).toArray()
      if (local.length) return local
      const { data } = await supabase.from('tasks').select('*').eq('date', date).eq('user_id', user!.id)
      if (data?.length) await db.tasks.bulkPut(data as any)
      return data ?? []
    }
  })
}
