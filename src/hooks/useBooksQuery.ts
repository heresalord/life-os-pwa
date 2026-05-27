import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useBooksQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['books', user?.id],
    enabled: !!user,
    staleTime: 0,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('books').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
        if (error) throw error
        if (data) await db.books.bulkPut(data as Parameters<typeof db.books.bulkPut>[0])
        return data ?? []
      }
      return db.books.orderBy('created_at').reverse().toArray()
    }
  })
}
