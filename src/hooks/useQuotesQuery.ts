import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useDb } from '../db/DbContext'
import { useAuth } from './useAuth'
import { bgSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import { QK } from '../lib/queryKeys'

export interface QuoteWithBook {
  id: string
  user_id: string
  book_id: string
  text: string
  page: number | null
  date: string
  created_at: string
  book_title?: string | null
  book_author?: string | null
}

/**
 * Fetch quotes. If bookId is provided, only quotes for that book are returned.
 */
export function useQuotesQuery(bookId?: string | null) {
  const db = useDb()
  const { user } = useAuth()
  return useQuery<QuoteWithBook[]>({
    queryKey: QK.quotes(user?.id ?? '', bookId),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      // created_at is not a Dexie index on quotes — fetch then sort in memory
      const localQuotes = bookId
        ? (await db.quotes.where('book_id').equals(bookId).toArray()).sort(
            (a, b) => (b.created_at || '').localeCompare(a.created_at || '')
          )
        : (await db.quotes.toArray()).sort(
            (a, b) => (b.created_at || '').localeCompare(a.created_at || '')
          )

      const bookIds = [...new Set(localQuotes.map(q => q.book_id))]
      const books = await db.books.bulkGet(bookIds)
      const bookMap = Object.fromEntries(books.filter(Boolean).map(b => [b!.id, b!]))
      const local: QuoteWithBook[] = localQuotes.map(q => ({
        ...q,
        book_title:  bookMap[q.book_id]?.title  ?? null,
        book_author: bookMap[q.book_id]?.author ?? null,
      }))

      // ── 2. Background sync from Supabase ─────────────────────────────
      if (navigator.onLine) {
        bgSync(`quotes-${bookId ?? 'all'}-${user!.id}`, async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let q = (supabase as any)
            .from('quotes')
            .select('*, books(title, author)')
            .eq('user_id', user!.id)
            .order('created_at', { ascending: false })
          if (bookId) q = q.eq('book_id', bookId)

          const { data, error } = await q
          if (error) throw error

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rows: QuoteWithBook[] = (data ?? []).map((r: any) => ({
            ...r,
            book_title:  r.books?.title  ?? null,
            book_author: r.books?.author ?? null,
            books: undefined,
          }))

          await db.quotes.bulkPut(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            rows.map(({ book_title: _bt, book_author: _ba, ...rest }) => rest) as Parameters<typeof db.quotes.bulkPut>[0]
          )
          queryClient.setQueryData(QK.quotes(user!.id, bookId), rows)
        })
      }

      return local
    },
  })
}
