import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useBooksQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['books', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data: rawData, error } = await supabase
          .from('books').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
        if (error) throw error
        if (rawData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = rawData as any[]
          const localBooks = await db.books.bulkGet(data.map(b => b.id))
          const merged = data.map((remote, i) => {
            const local = localBooks[i]
            return (!remote.cover_url && local?.cover_url) ? { ...remote, cover_url: local.cover_url } : remote
          })
          await db.books.bulkPut(merged as Parameters<typeof db.books.bulkPut>[0])
          return merged
        }
        return []
      }
      return db.books.orderBy('created_at').reverse().toArray()
    }
  })
}
