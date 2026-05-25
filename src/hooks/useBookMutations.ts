
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'

export function useBookMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const addBook = useMutation({
    mutationFn: async (payload: { title: string; author?: string; total_pages?: number; status: string }) => {
      if (!user) return
      const book = {
        id: crypto.randomUUID(),
        user_id: user.id,
        title: payload.title,
        author: payload.author || null,
        total_pages: payload.total_pages || null,
        current_page: 0,
        status: payload.status,
        rating: null,
        review: null,
        finished_at: payload.status === 'completed' ? new Date().toISOString() : null,
        created_at: new Date().toISOString()
      }
      await db.books.add(book as any)
      await enqueueSync('books', 'insert', book)
      return book
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['books'] })
  })

  const updateBook = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      await db.books.update(id, updates)
      const updated = await db.books.get(id)
      await enqueueSync('books', 'update', updated)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['books'] })
  })

  const deleteBook = useMutation({
    mutationFn: async (id: string) => {
      await db.books.delete(id)
      await enqueueSync('books', 'delete', { id })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['books'] })
  })

  return { addBook, updateBook, deleteBook }
}
