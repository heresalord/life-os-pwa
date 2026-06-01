import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useTransactionsRange(from: string, to: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions_range', from, to, user?.id],
    enabled: !!user && !!from && !!to,
    staleTime: 30_000,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user!.id)
          .gte('date', from)
          .lte('date', to)
          .order('created_at', { ascending: false })
        if (error) throw error
        if (data) await db.transactions.bulkPut(data as Parameters<typeof db.transactions.bulkPut>[0])
        return data ?? []
      }
      return db.transactions
        .where('date').between(from, to, true, true)
        .reverse()
        .sortBy('created_at')
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
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('daily_records')
          .select('*')
          .eq('user_id', user!.id)
          .gte('date', from)
          .lte('date', to)
          .order('date', { ascending: true })
        if (error) throw error
        if (data) {
          for (const r of data) {
            await db.daily_records.put(r as Parameters<typeof db.daily_records.put>[0])
          }
        }
        return data ?? []
      }
      return db.daily_records
        .where('date').between(from, to, true, true)
        .sortBy('date')
    }
  })
}
