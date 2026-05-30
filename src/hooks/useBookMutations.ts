import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

type AnyItem = { id: string; [key: string]: unknown }
type BookStatus = 'reading' | 'to-read' | 'finished' | 'abandoned'

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

async function writeBook(op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  if (navigator.onLine) {
    let error = null
    const safe = op !== 'delete' ? toSupabasePayload(payload) : payload
    if (op === 'insert')      ({ error } = await sbAny.from('books').insert([safe]))
    else if (op === 'update') ({ error } = await sbAny.from('books').update(safe).eq('id', payload.id))
    else                      ({ error } = await sbAny.from('books').delete().eq('id', payload.id))
    if (error) await enqueueSync('books', op, payload)
  } else {
    await enqueueSync('books', op, payload)
  }
}

export function useBookMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const queryKey = ['books', user?.id]
  const invalidate = () => qc.invalidateQueries({ queryKey })

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
        started_at: payload.status === 'reading'  ? new Date().toISOString().split('T')[0] : null,
        finished_at: payload.status === 'finished' ? new Date().toISOString().split('T')[0] : null,
        tags: [],
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
      const withTs = { ...updates, updated_at: new Date().toISOString() }
      await db.books.update(id, withTs)
      const updated = await db.books.get(id)
      if (updated) await writeBook('update', updated as Record<string, unknown>)
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
    onSettled: () => invalidate(),
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
