import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import type { Wallet } from '../db/schema'

type AnyItem = { id: string; [key: string]: unknown }

async function writeTx(op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  await enqueueSync('transactions', op, payload)
}

async function adjustWalletBalance(
  walletId: string,
  amount: number,
  type: 'income' | 'expense' | 'adjustment',
  operation: 'add' | 'remove'
) {
  const wallet = await db.wallets.get(walletId)
  if (!wallet) return

  let diff: number
  if (type === 'adjustment') {
    diff = amount
  } else {
    diff = type === 'expense' ? -amount : amount
  }
  if (operation === 'remove') diff = -diff

  const newBalance = Number(wallet.balance) + diff
  await db.wallets.update(walletId, { balance: newBalance, updated_at: new Date().toISOString() })
  const updatedWallet = await db.wallets.get(walletId)
  if (updatedWallet) {
    await enqueueSync('wallets', 'update', updatedWallet as Record<string, unknown>)
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
    qc.invalidateQueries({ queryKey: ['wallets'] })
  }

  const addTransaction = useMutation({
    mutationFn: async (payload: {
      amount: number
      type: 'income' | 'expense' | 'adjustment'
      category: string
      wallet_id?: string | null
      method?: string
      description?: string
      date: string
      time?: string
    }) => {
      if (!user) return
      const created_at = payload.time
        ? new Date(`${payload.date}T${payload.time}:00`).toISOString()
        : new Date().toISOString()

      let walletId: string | null = payload.wallet_id || null
      if (!walletId && payload.method && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.method)) {
        walletId = payload.method
      }

      let resolvedMethod = 'card'
      if (walletId) {
        const wallet = await db.wallets.get(walletId)
        if (wallet) {
          if (wallet.type === 'cash') resolvedMethod = 'cash'
          else if (wallet.type === 'credit') resolvedMethod = 'card'
          else if (wallet.type === 'bank' || wallet.type === 'savings') resolvedMethod = 'bank transfer'
        }
      } else if (payload.method && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.method)) {
        resolvedMethod = payload.method
      }

      const tx = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: payload.date,
        amount: payload.amount,
        type: payload.type,
        category: payload.category,
        method: resolvedMethod,
        description: payload.description || null,
        wallet_id: walletId,
        transfer_to_wallet_id: null,
        notes: null,
        created_at,
      }
      await db.transactions.add(tx as Parameters<typeof db.transactions.add>[0])
      await writeTx('insert', tx)

      if (tx.wallet_id) {
        await adjustWalletBalance(tx.wallet_id, tx.amount, tx.type as 'income' | 'expense' | 'adjustment', 'add')
      }
      return tx
    },
    onMutate: async (payload) => {
      // Cancel both the date-specific query and all range queries
      await qc.cancelQueries({ queryKey })
      await qc.cancelQueries({ queryKey: ['transactions_range'] })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)

      let walletId: string | null = payload.wallet_id || null
      if (!walletId && payload.method && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.method)) {
        walletId = payload.method
      }

      let resolvedMethod = 'card'
      if (walletId) {
        const cachedWallets = qc.getQueryData<Wallet[]>(['wallets']) || []
        const wallet = cachedWallets.find(w => w.id === walletId)
        if (wallet) {
          if (wallet.type === 'cash') resolvedMethod = 'cash'
          else if (wallet.type === 'credit') resolvedMethod = 'card'
          else if (wallet.type === 'bank' || wallet.type === 'savings') resolvedMethod = 'bank transfer'
        }
      } else if (payload.method && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.method)) {
        resolvedMethod = payload.method
      }

      const optimistic: AnyItem = {
        id: `opt-${Date.now()}`,
        user_id: user?.id,
        date: payload.date,
        amount: payload.amount,
        type: payload.type,
        category: payload.category,
        method: resolvedMethod,
        description: payload.description || null,
        wallet_id: walletId,
        notes: null,
        created_at: payload.time
          ? new Date(`${payload.date}T${payload.time}:00`).toISOString()
          : new Date().toISOString(),
      }

      // Optimistic update: date-specific cache
      qc.setQueryData<AnyItem[]>(queryKey, old => [...(old ?? []), optimistic])

      // Optimistic update: inject into every transactions_range cache whose
      // [from, to] window covers the transaction's date.
      // TransactionsTab reads from these range queries — without this the new
      // transaction would not appear until the background Supabase refetch.
      const previousRanges: Array<{ queryKey: readonly unknown[]; data: AnyItem[] | undefined }> = []
      qc.getQueryCache().findAll({ queryKey: ['transactions_range'] }).forEach(query => {
        const [, from, to] = query.queryKey as [string, string, string, string]
        if (from && to && payload.date >= from && payload.date <= to) {
          previousRanges.push({ queryKey: query.queryKey, data: query.state.data as AnyItem[] | undefined })
          qc.setQueryData<AnyItem[]>(query.queryKey as string[], (old) => {
            const base = old ?? []
            return [...base, optimistic].sort(
              (a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
            )
          })
        }
      })

      return { previous, previousRanges }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
      // Roll back range caches
      ctx?.previousRanges?.forEach(({ queryKey: qk, data }) => qc.setQueryData(qk, data))
    },
    onSettled: () => invalidateAll(),
  })

  const updateTransaction = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const existing = await db.transactions.get(id)
      if (!existing) return

      if (updates.date || updates.time) {
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

      if ('wallet_id' in updates) {
        const newWalletId = updates.wallet_id as string | null
        let resolvedMethod = 'card'
        if (newWalletId) {
          const wallet = await db.wallets.get(newWalletId)
          if (wallet) {
            if (wallet.type === 'cash') resolvedMethod = 'cash'
            else if (wallet.type === 'credit') resolvedMethod = 'card'
            else if (wallet.type === 'bank' || wallet.type === 'savings') resolvedMethod = 'bank transfer'
          }
        }
        updates.method = resolvedMethod
      }

      await db.transactions.update(id, updates)
      const updated = await db.transactions.get(id)
      if (updated) {
        await writeTx('update', updated as Record<string, unknown>)

        if (existing.wallet_id) {
          await adjustWalletBalance(existing.wallet_id, Number(existing.amount), existing.type as 'income' | 'expense' | 'adjustment', 'remove')
        }
        if (updated.wallet_id) {
          await adjustWalletBalance(updated.wallet_id, Number(updated.amount), updated.type as 'income' | 'expense' | 'adjustment', 'add')
        }
      }
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey: ['transactions'] })
      await qc.cancelQueries({ queryKey: ['transactions_range'] })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)

      const refinedUpdates = { ...updates }
      if ('wallet_id' in refinedUpdates) {
        const newWalletId = refinedUpdates.wallet_id as string | null
        let resolvedMethod = 'card'
        if (newWalletId) {
          const cachedWallets = qc.getQueryData<Wallet[]>(['wallets']) || []
          const wallet = cachedWallets.find(w => w.id === newWalletId)
          if (wallet) {
            if (wallet.type === 'cash') resolvedMethod = 'cash'
            else if (wallet.type === 'credit') resolvedMethod = 'card'
            else if (wallet.type === 'bank' || wallet.type === 'savings') resolvedMethod = 'bank transfer'
          }
        }
        refinedUpdates.method = resolvedMethod
      }

      qc.setQueriesData<AnyItem[]>(
        { queryKey: ['transactions'] },
        old => (old ?? []).map(t => t.id === id ? { ...t, ...refinedUpdates } : t)
      )
      qc.setQueriesData<AnyItem[]>(
        { queryKey: ['transactions_range'] },
        old => (old ?? []).map(t => t.id === id ? { ...t, ...refinedUpdates } : t)
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
      const tx = await db.transactions.get(id)
      await db.transactions.delete(id)
      await writeTx('delete', { id })

      if (tx && tx.wallet_id) {
        await adjustWalletBalance(tx.wallet_id, Number(tx.amount), tx.type as 'income' | 'expense' | 'adjustment', 'remove')
      }
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['transactions'] })
      await qc.cancelQueries({ queryKey: ['transactions_range'] })
      const previous = qc.getQueryData<AnyItem[]>(queryKey)

      // Snapshot all range caches before mutation so we can restore them on error
      const previousRanges: Array<{ queryKey: readonly unknown[]; data: AnyItem[] | undefined }> = []
      qc.getQueryCache().findAll({ queryKey: ['transactions_range'] }).forEach(query => {
        previousRanges.push({ queryKey: query.queryKey, data: query.state.data as AnyItem[] | undefined })
      })

      qc.setQueriesData<AnyItem[]>(
        { queryKey: ['transactions'] },
        old => (old ?? []).filter(t => t.id !== id)
      )
      qc.setQueriesData<AnyItem[]>(
        { queryKey: ['transactions_range'] },
        old => (old ?? []).filter(t => t.id !== id)
      )
      return { previous, previousRanges }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(queryKey, ctx.previous)
      // Restore every range cache that was modified during the optimistic delete
      ctx?.previousRanges?.forEach(({ queryKey: qk, data }) => qc.setQueryData(qk, data))
    },
    onSettled: () => invalidateAll(),
  })

  return { addTransaction, updateTransaction, deleteTransaction }
}
