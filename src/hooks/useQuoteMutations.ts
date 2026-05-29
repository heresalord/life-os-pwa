import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

/**
 * Mutations scoped to a specific book.
 * The bookId is baked into each mutated row automatically.
 */
export function useQuoteMutations(bookId: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['quotes'] })
  }

  const addQuote = useMutation({
    mutationFn: async (payload: { text: string; page?: number | null }) => {
      if (!user) return
      const quote = {
        id: crypto.randomUUID(),
        user_id: user.id,
        book_id: bookId,
        text: payload.text.trim(),
        page: payload.page ?? null,
        date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      }
      await db.quotes.add(quote as Parameters<typeof db.quotes.add>[0])
      if (navigator.onLine) {
        const { error } = await sbAny.from('quotes').insert([quote])
        if (error) await enqueueSync('quotes', 'insert', quote)
      } else {
        await enqueueSync('quotes', 'insert', quote)
      }
      return quote
    },
    onSuccess: () => invalidate(),
  })

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      await db.quotes.delete(id)
      if (navigator.onLine) {
        await sbAny.from('quotes').delete().eq('id', id)
      } else {
        await enqueueSync('quotes', 'delete', { id })
      }
    },
    onSuccess: () => invalidate(),
  })

  return { addQuote, deleteQuote }
}
