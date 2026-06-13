import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import type { Book } from '../db/schema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useBooksQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['books', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      // created_at is not a Dexie index on books — sort in memory instead
      const local = (await db.books.toArray()).sort(
        (a, b) => (b.created_at || '').localeCompare(a.created_at || '')
      )

      if (navigator.onLine) {
        bgSync(`books-${user!.id}`, async () => {
          const { data: rawData, error } = await supabase
            .from('books').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
          if (error) throw error
          if (rawData) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = rawData as any[]
            const localBooks = await db.books.bulkGet(data.map(b => b.id))
            const merged = data.map((remote, i) => {
              const loc = localBooks[i]
              return (!remote.cover_url && loc?.cover_url) ? { ...remote, cover_url: loc.cover_url } : remote
            })
            const reconciled = await reconcilePendingSync('books', merged as Book[])
            await db.books.bulkPut(reconciled)
            queryClient.setQueryData(['books', user!.id], reconciled)
          }
        })
      }

      return local
    }
  })
}

export function useBookQuery(id: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['book', id, user?.id],
    enabled: !!user && !!id,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.books.get(id)

      if (!local && navigator.onLine) {
        const { data, error } = await supabase
          .from('books').select('*').eq('id', id).eq('user_id', user!.id).single()
        if (error) throw error
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data) await db.books.put(data as any)
        return data ?? null
      }

      if (navigator.onLine && local) {
        bgSync(`book-${id}-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('books').select('*').eq('id', id).eq('user_id', user!.id).single()
          if (error) throw error
          if (data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await db.books.put(data as any)
            queryClient.setQueryData(['book', id, user!.id], data)
          }
        })
      }

      return local ?? null
    }
  })
}
