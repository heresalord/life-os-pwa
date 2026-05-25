
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useBooksQuery(status?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['books', status],
    enabled: !!user,
    queryFn: async () => {
      const local = status ? await db.books.where('status').equals(status).toArray() : await db.books.toArray()
      if (local.length) return local
      const q = supabase.from('books').select('*').eq('user_id', user!.id)
      if (status) q.eq('status', status)
      const { data } = await q
      if (data?.length) await db.books.bulkPut(data as any)
      return data ?? []
    }
  })
}
