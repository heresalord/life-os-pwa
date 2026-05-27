import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useInboxQuery(processedOnly = false) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['inbox_items', processedOnly, user?.id],
    enabled: !!user,
    staleTime: 0,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('inbox_items').select('*')
          .eq('user_id', user!.id)
          .eq('processed', processedOnly)
          .order('captured_at', { ascending: false })
        if (error) throw error
        if (data) await db.inbox_items.bulkPut(data as Parameters<typeof db.inbox_items.bulkPut>[0])
        return data ?? []
      }
      return db.inbox_items.where('processed').equals(processedOnly ? 1 : 0).reverse().sortBy('captured_at')
    }
  })
}
