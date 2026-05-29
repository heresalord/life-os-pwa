import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { supabase as supa } from '../lib/supabase'
const sbAny = supa as any

type BookStatus = 'reading' | 'to-read' | 'finished' | 'abandoned'

// Columns that exist in the Supabase books table.
// cover_url lives only in local IndexedDB until a migration adds it remotely.
const SUPABASE_BOOK_COLUMNS = [
  'id','user_id','title','author','status','started_at','finished_at',
  'current_page','total_pages','tags','reflection','abandon_reason',
  'added_at','created_at','updated_at','cover_url','rating',
] as const

function toSupabasePayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([k]) => (SUPABASE_BOOK_COLUMNS as readonly string[]).includes(k))
  )
}

async function writeBook(table: string, op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  if (navigator.onLine) {
    let error = null
    const safePayload = op !== 'delete' ? toSupabasePayload(payload) : payload
    if (op === 'insert')       ({ error } = await sbAny.from(table).insert([safePayload]))
    else if (op === 'update')  ({ error } = await sbAny.from(table).update(safePayload).eq('id', payload.id))
    else                       ({ error } = await sbAny.from(table).delete().eq('id', payload.id))
    if (error) await enqueueSync(table, op, payload)
  } else {
    await enqueueSync(table, op, payload)
  }
}

export function useBookMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['books'] })

  const addBook = useMutation({
    mutationFn: async (payload: {
      title: string; author?: string; total_pages?: number; status: BookStatus; cover_url?: string;
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
        started_at: payload.status === 'reading' ? new Date().toISOString().split('T')[0] : null,
        finished_at: payload.status === 'finished' ? new Date().toISOString().split('T')[0] : null,
        tags: [],
        added_at: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await db.books.add(book as Parameters<typeof db.books.add>[0])
      await writeBook('books', 'insert', book)
      return book
    },
    onSuccess: () => invalidate()
  })

  const updateBook = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const withTimestamp = { ...updates, updated_at: new Date().toISOString() }
      await db.books.update(id, withTimestamp)
      const updated = await db.books.get(id)
      if (updated) await writeBook('books', 'update', updated as Record<string, unknown>)
    },
    onSuccess: () => invalidate()
  })

  const deleteBook = useMutation({
    mutationFn: async (id: string) => {
      await db.books.delete(id)
      await writeBook('books', 'delete', { id })
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['books'] })
      const previous = qc.getQueryData<unknown[]>(['books', user?.id])
      qc.setQueryData(['books', user?.id], (old: unknown[] = []) =>
        (old as { id: string }[]).filter(b => b.id !== id)
      )
      return { previous }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(['books', user?.id], ctx.previous)
    },
    onSuccess: () => invalidate()
  })

  return { addBook, updateBook, deleteBook }
}
