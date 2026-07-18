import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useDb } from '../db/DbContext'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import { QK } from '../lib/queryKeys'
import type { Transaction } from '../db/schema'

export function useTransactionsQuery(date: string) {
  const db = useDb()
  const { user } = useAuth()
  return useQuery({
    queryKey: QK.transactions(date, user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.transactions
        .where('date').equals(date)
        .reverse().sortBy('created_at')

      if (navigator.onLine) {
        bgSync(`transactions-${date}-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('transactions').select('*')
            .eq('user_id', user!.id).eq('date', date)
            .order('created_at', { ascending: false })
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync(db, 'transactions', data as Transaction[])
            await db.transactions.bulkPut(reconciled)
            queryClient.setQueryData(QK.transactions(date, user!.id), reconciled)
          }
        })
      }

      return local
    }
  })
}
