import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

async function writeTx(op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  if (navigator.onLine) {
    let error = null
    if (op === 'insert')      ({ error } = await sbAny.from('transactions').insert([payload]))
    else if (op === 'update') ({ error } = await sbAny.from('transactions').update(payload).eq('id', payload.id))
    else                      ({ error } = await sbAny.from('transactions').delete().eq('id', payload.id))
    if (error) await enqueueSync('transactions', op, payload)
  } else {
    await enqueueSync('transactions', op, payload)
  }
}

export function useTransactionMutations(date: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['transactions', date, user?.id] })

  const addTransaction = useMutation({
    mutationFn: async (payload: {
      amount: number
      type: 'income' | 'expense'
      category: string
      method?: string
      description?: string
      date: string
    }) => {
      if (!user) return
      const tx = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: payload.date,
        amount: payload.amount,
        type: payload.type,
        category: payload.category,
        method: payload.method || 'card',
        description: payload.description || null,
        created_at: new Date().toISOString(),
      }
      await db.transactions.add(tx as Parameters<typeof db.transactions.add>[0])
      await writeTx('insert', tx)
      return tx
    },
    onSuccess: () => invalidate()
  })

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      await db.transactions.delete(id)
      await writeTx('delete', { id })
    },
    onSuccess: () => invalidate()
  })

  return { addTransaction, deleteTransaction }
}
