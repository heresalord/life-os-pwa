import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useQuotesQuery(bookId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['quotes', bookId],
    enabled: !!user && !!bookId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!bookId) return []
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('quotes')
          .select('*')
          .eq('book_id', bookId)
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        if (data) await db.quotes.bulkPut(data as Parameters<typeof db.quotes.bulkPut>[0])
        return data ?? []
      }
      return db.quotes.where('book_id').equals(bookId).reverse().sortBy('created_at')
    },
  })
}
