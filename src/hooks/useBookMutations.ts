import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDb } from '../db/DbContext'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'

import { QK } from '../lib/queryKeys'

type AnyItem = { id: string; [key: string]: unknown }
type BookStatus = 'reading' | 'to-read' | 'finished' | 'abandoned'

async function writeBook(op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  await enqueueSync('books', op, payload)
}

export function useBookMutations() {
  const db = useDb()
  const { user } = useAuth()
  const qc = useQueryClient()
  const queryKey = QK.books(user?.id ?? '')
  const invalidate = () => qc.invalidateQueries({ queryKey: QK.books(user?.id ?? '') })

  const addBook = useMutation({
    mutationFn: async (payload: {
      title: string;
      author?: string;
      total_pages?: number;
      status: BookStatus;
      cover_url?: string;
      genre?: string;
      isbn?: string;
      language?: string;
      source?: 'physical' | 'ebook' | 'audiobook' | 'library';
      shelves?: string[];
    }) => {
      if (!user) return
      const book = {
        id: crypto.randomUUID(),
        user_id: user.id,
        title: payload.title,
        author: payload.author || null,
        total_pages: payload.total_pages || null,
        cover_url: payload.cover_url || null,
        current_page: 0,
        status: payload.status,
        rating: null as number | null,
        reflection: null,
        abandon_reason: null,
        started_at: payload.status === 'reading'  ? new Date().toISOString().split('T')[0] : null,
        finished_at: payload.status === 'finished' ? new Date().toISOString().split('T')[0] : null,
        tags: [],
        genre: payload.genre || null,
        isbn: payload.isbn || null,
        language: payload.language || null,
        source: payload.source || null,
        reading_sessions: [] as any[],
        shelves: payload.shelves || [],
        added_at: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await db.books.add(book as Parameters<typeof db.books.add>[0])
      await writeBook('insert', book)
      return book
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      const optimistic: AnyItem = {
        id: `opt-${Date.now()}`,
        user_id: user?.id,
        title: payload.title,
        author: payload.author || null,
        total_pages: payload.total_pages || null,
        cover_url: payload.cover_url || null,
        current_page: 0,
        status: payload.status,
        rating: null,
        reflection: null,
        abandon_reason: null,
        genre: payload.genre || null,
        isbn: payload.isbn || null,
        language: payload.language || null,
        source: payload.source || null,
        reading_sessions: [] as any[],
        shelves: payload.shelves || [],
        started_at: payload.status === 'reading'  ? new Date().toISOString().split('T')[0] : null,
        finished_at: payload.status === 'finished' ? new Date().toISOString().split('T')[0] : null,
        tags: [],
        added_at: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      qc.setQueryData<AnyItem[]>(queryKey, old => [optimistic, ...(old ?? [])])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  const updateBook = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const previousBook = await db.books.get(id)
      const withTs = { ...updates, updated_at: new Date().toISOString() }
      await db.books.update(id, withTs)
      const updated = await db.books.get(id)
      if (updated) await writeBook('update', updated as Record<string, unknown>)

      // Connect to Goals module Target tracker:
      // If book status transitions to finished, search active goals for books
      if (previousBook && previousBook.status !== 'finished' && updates.status === 'finished' && user) {
        const activeGoals = await db.goals
          .where('state').equals('active')
          .and(g => g.tracker_type === 'target' && (g.name.toLowerCase().includes('book') || g.name.toLowerCase().includes('read')))
          .toArray()

        if (activeGoals.length > 0) {
          const nowStr = new Date().toISOString().split('T')[0]
          for (const g of activeGoals) {
            const event = {
              id: crypto.randomUUID(),
              user_id: user.id,
              goal_id: g.id,
              sub_goal_id: null,
              date: nowStr,
              value: 1,
              event_type: 'add',
              note: `Finished reading: ${updated?.title || 'a book'}`,
              new_state: null,
              old_target: null,
              new_target: null,
              created_at: new Date().toISOString()
            }
            await db.goal_events.add(event as any)
            await enqueueSync('goal_events', 'insert', event)
            qc.invalidateQueries({ queryKey: QK.goalEventsAll() })
            qc.invalidateQueries({ queryKey: QK.goalsAll() })
          }
        }
      }
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      qc.setQueryData<AnyItem[]>(queryKey, old =>
        (old ?? []).map(b => b.id === id ? { ...b, ...updates, updated_at: new Date().toISOString() } : b)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: (_data, _error, variables) => {
      invalidate()
      if (variables?.id) {
        qc.invalidateQueries({ queryKey: QK.book(variables.id, user?.id ?? '') })
      }
    },
  })

  const deleteBook = useMutation({
    mutationFn: async (id: string) => {
      await db.books.delete(id)
      await writeBook('delete', { id })
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      qc.setQueryData<AnyItem[]>(queryKey, old => (old ?? []).filter(b => b.id !== id))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidate(),
  })

  return { addBook, updateBook, deleteBook }
}
