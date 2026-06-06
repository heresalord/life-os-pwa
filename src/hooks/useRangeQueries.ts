import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'

export function useTransactionsRange(from: string, to: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions_range', from, to, user?.id],
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
            await db.transactions.bulkPut(data as Parameters<typeof db.transactions.bulkPut>[0])
            queryClient.setQueryData(['transactions_range', from, to, user!.id], data)
          }
        })
      }

      return local
    }
  })
}

export function useDailyRecordsRange(from: string, to: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['daily_records_range', from, to, user?.id],
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
            queryClient.setQueryData(['daily_records_range', from, to, user!.id], data)
          }
        })
      }

      return local
    }
  })
}
