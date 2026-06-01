import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

type AnyItem = { id: string; [key: string]: unknown }

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
  const queryKey = ['transactions', date, user?.id]

  // Invalidate both the date-specific query AND all range queries
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['transactions'] })
    qc.invalidateQueries({ queryKey: ['transactions_range'] })
  }

  const addTransaction = useMutation({
    mutationFn: async (payload: {
      amount: number
      type: 'income' | 'expense'
      category: string
      method?: string
      description?: string
      date: string
      time?: string
    }) => {
      if (!user) return
      const created_at = payload.time
        ? new Date(`${payload.date}T${payload.time}:00`).toISOString()
        : new Date().toISOString()

      const tx = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: payload.date,
        amount: payload.amount,
        type: payload.type,
        category: payload.category,
        method: payload.method || 'card',
        description: payload.description || null,
        wallet_id: null,
        transfer_to_wallet_id: null,
        notes: null,
        created_at,
      }
      await db.transactions.add(tx as Parameters<typeof db.transactions.add>[0])
      await writeTx('insert', tx)
      return tx
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      const optimistic: AnyItem = {
        id: `opt-${Date.now()}`,
        user_id: user?.id,
        date: payload.date,
        amount: payload.amount,
        type: payload.type,
        category: payload.category,
        method: payload.method || 'card',
        description: payload.description || null,
        wallet_id: null,
        notes: null,
        created_at: payload.time
          ? new Date(`${payload.date}T${payload.time}:00`).toISOString()
          : new Date().toISOString(),
      }
      qc.setQueryData<AnyItem[]>(queryKey, old => [...(old ?? []), optimistic])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidateAll(),
  })

  const updateTransaction = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      if (updates.date || updates.time) {
        const existing = await db.transactions.get(id)
        const baseDate = (updates.date as string) ?? existing?.date ?? date
        const existingTime = existing?.created_at
          ? new Date(existing.created_at).toTimeString().slice(0, 5)
          : '00:00'
        const baseTime = (updates.time as string) ?? existingTime
        updates = {
          ...updates,
          created_at: new Date(`${baseDate}T${baseTime}:00`).toISOString(),
        }
        delete updates.time
      }
      await db.transactions.update(id, updates)
      const updated = await db.transactions.get(id)
      if (updated) await writeTx('update', updated as Record<string, unknown>)
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey: ['transactions'] })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      qc.setQueriesData<AnyItem[]>(
        { queryKey: ['transactions'] },
        old => (old ?? []).map(t => t.id === id ? { ...t, ...updates } : t)
      )
      qc.setQueriesData<AnyItem[]>(
        { queryKey: ['transactions_range'] },
        old => (old ?? []).map(t => t.id === id ? { ...t, ...updates } : t)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidateAll(),
  })

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      await db.transactions.delete(id)
      await writeTx('delete', { id })
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['transactions'] })
      await qc.cancelQueries({ queryKey: ['transactions_range'] })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)
      qc.setQueriesData<AnyItem[]>(
        { queryKey: ['transactions'] },
        old => (old ?? []).filter(t => t.id !== id)
      )
      qc.setQueriesData<AnyItem[]>(
        { queryKey: ['transactions_range'] },
        old => (old ?? []).filter(t => t.id !== id)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidateAll(),
  })

  return { addTransaction, updateTransaction, deleteTransaction }
}
