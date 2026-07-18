import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useDb } from '../db/DbContext'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import { QK } from '../lib/queryKeys'
import type { Transaction } from '../db/schema'

export function useTransactionsRange(from: string, to: string) {
  const db = useDb()
  const { user } = useAuth()
  return useQuery({
    queryKey: QK.transactionsRange(from, to, user?.id ?? ''),
    enabled: !!user && !!from && !!to,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.transactions
        .where('date').between(from, to, true, true)
        .toArray()
        .then(txns => txns.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ))

      if (navigator.onLine) {
        bgSync(`transactions_range-${from}-${to}-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('transactions').select('*')
            .eq('user_id', user!.id)
            .gte('date', from).lte('date', to)
            .order('created_at', { ascending: false })
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync(db, 'transactions', data as Transaction[])
            await db.transactions.bulkPut(reconciled)
            queryClient.setQueryData(QK.transactionsRange(from, to, user!.id), reconciled)
          }
        })
      }

      return local
    }
  })
}

export function useDailyRecordsRange(from: string, to: string) {
  const db = useDb()
  const { user } = useAuth()
  return useQuery({
    queryKey: QK.dailyRecordsRange(from, to, user?.id ?? ''),
    enabled: !!user && !!from && !!to,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.daily_records
        .where('date').between(from, to, true, true)
        .sortBy('date')

      if (navigator.onLine) {
        bgSync(`daily_records_range-${from}-${to}-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('daily_records').select('*')
            .eq('user_id', user!.id)
            .gte('date', from).lte('date', to)
            .order('date', { ascending: true })
          if (error) throw error
          if (data) {
            await db.daily_records.bulkPut(data as Parameters<typeof db.daily_records.bulkPut>[0])
            queryClient.setQueryData(QK.dailyRecordsRange(from, to, user!.id), data)
          }
        })
      }

      return local
    }
  })
}
