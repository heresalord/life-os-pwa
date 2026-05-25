
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useGoalsQuery(state = 'active') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['goals', state],
    enabled: !!user,
    queryFn: async () => {
      const local = await db.goals.where('state').equals(state).toArray()
      if (local.length) return local
      const { data } = await supabase.from('goals').select('*').eq('user_id', user!.id).eq('state', state)
      if (data?.length) await db.goals.bulkPut(data as any)
      return data ?? []
    }
  })
}
