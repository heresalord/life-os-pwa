import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useDb } from '../db/DbContext'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import { QK } from '../lib/queryKeys'
import type { InboxItem } from '../db/schema'

export function useInboxQuery(processedOnly = false) {
  const db = useDb()
  const { user } = useAuth()
  return useQuery({
    queryKey: QK.inbox(processedOnly, user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.inbox_items
        .where('processed').equals(processedOnly ? 1 : 0)
        .reverse().sortBy('captured_at')

      if (navigator.onLine) {
        bgSync(`inbox-${processedOnly}-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('inbox_items').select('*')
            .eq('processed', processedOnly)
            .order('captured_at', { ascending: false })
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync(db, 'inbox_items', data as InboxItem[])
            await db.inbox_items.bulkPut(reconciled)
            queryClient.setQueryData(QK.inbox(processedOnly, user!.id), reconciled)
          }
        })
      }

      return local
    }
  })
}
