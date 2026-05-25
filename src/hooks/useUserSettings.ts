
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useUserSettings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['user_settings'],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', user!.id).single()
      return data
    }
  })
}
