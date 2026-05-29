import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

async function writeQuote(op: 'insert' | 'delete', payload: Record<string, unknown>) {
  if (navigator.onLine) {
    let error = null
    if (op === 'insert') ({ error } = await sbAny.from('quotes').insert([payload]))
    else                 ({ error } = await sbAny.from('quotes').delete().eq('id', payload.id))
    if (error) await enqueueSync('quotes', op, payload)
  } else {
    await enqueueSync('quotes', op, payload)
  }
}

export function useQuoteMutations(bookId: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['quotes', bookId] })

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
      await writeQuote('insert', quote)
      return quote
    },
    onSuccess: () => invalidate(),
  })

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      await db.quotes.delete(id)
      await writeQuote('delete', { id })
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['quotes', bookId] })
      const prev = qc.getQueryData<{ id: string }[]>(['quotes', bookId])
      qc.setQueryData(['quotes', bookId], (old: { id: string }[] = []) => old.filter(q => q.id !== id))
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['quotes', bookId], ctx.prev)
    },
    onSuccess: () => invalidate(),
  })

  return { addQuote, deleteQuote }
}
