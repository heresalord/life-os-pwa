
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useTransactionsQuery(date: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', date],
    enabled: !!user,
    queryFn: async () => {
      const local = await db.transactions.where('date').equals(date).toArray()
      if (local.length) return local
      const { data } = await supabase.from('transactions').select('*').eq('date', date).eq('user_id', user!.id)
      if (data?.length) await db.transactions.bulkPut(data as any)
      return data ?? []
    }
  })
}
