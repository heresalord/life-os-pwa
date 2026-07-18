import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDb } from '../db/DbContext'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'

import { QK } from '../lib/queryKeys'

/**
 * Mutations scoped to a specific book.
 * The bookId is baked into each mutated row automatically.
 */
export function useQuoteMutations(bookId: string) {
  const db = useDb()
  const { user } = useAuth()
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.quotes(user?.id ?? '', bookId) })
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
      await enqueueSync('quotes', 'insert', quote)
      return quote
    },
    onSuccess: () => invalidate(),
  })

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      await db.quotes.delete(id)
      await enqueueSync('quotes', 'delete', { id })
    },
    onSuccess: () => invalidate(),
  })

  return { addQuote, deleteQuote }
}
