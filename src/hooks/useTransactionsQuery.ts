import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useTransactionsQuery(date: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', date, user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('transactions').select('*')
          .eq('user_id', user!.id).eq('date', date)
          .order('created_at', { ascending: false })
        if (error) throw error
        if (data) await db.transactions.bulkPut(data as Parameters<typeof db.transactions.bulkPut>[0])
        return data ?? []
      }
      return db.transactions.where('date').equals(date).reverse().sortBy('created_at')
    }
  })
}
