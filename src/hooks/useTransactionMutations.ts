
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'

export function useTransactionMutations(date: string) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const addTransaction = useMutation({
    mutationFn: async (payload: { amount: number; type: 'income' | 'expense'; category: string; description?: string; date: string }) => {
      if (!user) return
      const tx = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date: payload.date,
        amount: payload.amount,
        type: payload.type,
        category: payload.category,
        description: payload.description || null,
        created_at: new Date().toISOString()
      }
      await db.transactions.add(tx as any)
      await enqueueSync('transactions', 'insert', tx)
      return tx
    },
    onSuccess: (_, variables) => qc.invalidateQueries({ queryKey: ['transactions', variables.date] })
  })

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      await db.transactions.delete(id)
      await enqueueSync('transactions', 'delete', { id })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', date] })
  })

  return { addTransaction, deleteTransaction }
}
