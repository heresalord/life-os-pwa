
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useUserSettings() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['user_settings'],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user!.id)
        .single()
      return data
    }
  })

  const upsert = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!user) return
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user_settings'] })
  })

  return { ...query, upsert }
}
