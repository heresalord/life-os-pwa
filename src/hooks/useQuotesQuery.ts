import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'

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
  const { user } = useAuth()
  return useQuery<QuoteWithBook[]>({
    queryKey: ['quotes', user?.id, bookId ?? 'all'],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      // ── 1. Read from Dexie + manual book join (instant) ──────────────
      const localQuotes = bookId
        ? await db.quotes.where('book_id').equals(bookId).reverse().sortBy('created_at')
        : await db.quotes.orderBy('created_at').reverse().toArray()

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
            rows.map(({ book_title: _bt, book_author: _ba, ...rest }) => rest) as Parameters<typeof db.quotes.bulkPut>[0]
          )
          queryClient.setQueryData(['quotes', user!.id, bookId ?? 'all'], rows)
        })
      }

      return local
    },
  })
}
