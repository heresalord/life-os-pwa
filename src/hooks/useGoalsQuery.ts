import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useGoalsQuery(state = 'active') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['goals', state, user?.id],
    enabled: !!user,
    staleTime: 0,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('goals').select('*')
          .eq('user_id', user!.id).eq('state', state)
          .order('created_at', { ascending: false })
        if (error) throw error
        if (data) await db.goals.bulkPut(data as Parameters<typeof db.goals.bulkPut>[0])
        return data ?? []
      }
      return db.goals.where('state').equals(state).toArray()
    }
  })
}
