
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useInboxQuery(processedOnly = false) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['inbox_items', processedOnly],
    enabled: !!user,
    queryFn: async () => {
      const local = await db.inbox_items.where('processed').equals(processedOnly ? 1 : 0).toArray()
      if (local.length) return local
      const { data } = await supabase.from('inbox_items').select('*').eq('user_id', user!.id).eq('processed', processedOnly).order('captured_at', { ascending: false })
      if (data?.length) await db.inbox_items.bulkPut(data as any)
      return data ?? []
    }
  })
}
