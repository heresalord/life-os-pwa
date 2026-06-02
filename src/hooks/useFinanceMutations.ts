import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import type { Wallet, Budget, SavingsGoal, Debt } from '../db/schema'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

async function write(table: string, op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  if (navigator.onLine) {
    let error = null
    if (op === 'insert')      ({ error } = await sbAny.from(table).insert([payload]))
    else if (op === 'update') ({ error } = await sbAny.from(table).update(payload).eq('id', payload.id))
    else                      ({ error } = await sbAny.from(table).delete().eq('id', payload.id))
    if (error) await enqueueSync(table, op, payload)
  } else {
    await enqueueSync(table, op, payload)
  }
}

export function useFinanceMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()

  // ── Wallets ──────────────────────────────────────────────────────────
  const addWallet = useMutation({
    mutationFn: async (wallet: Omit<Wallet, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'archived'> & { archived?: boolean }) => {
      if (!user) return
      const now = new Date().toISOString()
      const newWallet = { ...wallet, id: crypto.randomUUID(), user_id: user.id, archived: wallet.archived ?? false, created_at: now, updated_at: now } as Wallet
      await db.wallets.add(newWallet)
      await write('wallets', 'insert', newWallet as Record<string, unknown>)
      return newWallet
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['wallets'] }),
  })

  const updateWallet = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Wallet> }) => {
      const withTs = { ...updates, updated_at: new Date().toISOString() }
      await db.wallets.update(id, withTs)
      const updated = await db.wallets.get(id)
      if (updated) await write('wallets', 'update', updated as Record<string, unknown>)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['wallets'] }),
  })

  const deleteWallet = useMutation({
    mutationFn: async (id: string) => {
      await db.wallets.delete(id)
      await write('wallets', 'delete', { id })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['wallets'] }),
  })

  // ── Budgets ──────────────────────────────────────────────────────────
  const addBudget = useMutation({
    mutationFn: async (budget: Omit<Budget, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
      if (!user) return
      const now = new Date().toISOString()
      const newBudget = { ...budget, id: crypto.randomUUID(), user_id: user.id, created_at: now, updated_at: now } as Budget
      await db.budgets.add(newBudget)
      await write('budgets', 'insert', newBudget as Record<string, unknown>)
      return newBudget
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
      await db.budgets.delete(id)
      await write('budgets', 'delete', { id })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })

  const updateBudget = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pick<Budget, 'category' | 'period' | 'limit_amount'>> }) => {
      const withTs = { ...updates, updated_at: new Date().toISOString() }
      await db.budgets.update(id, withTs)
      const updated = await db.budgets.get(id)
      if (updated) await write('budgets', 'update', updated as Record<string, unknown>)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })

  // ── Savings Goals ─────────────────────────────────────────────────────
  const addSavingsGoal = useMutation({
    mutationFn: async (goal: Omit<SavingsGoal, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
      if (!user) return
      const now = new Date().toISOString()
      const newGoal = { ...goal, id: crypto.randomUUID(), user_id: user.id, created_at: now, updated_at: now } as SavingsGoal
      await db.savings_goals.add(newGoal)
      await write('savings_goals', 'insert', newGoal as Record<string, unknown>)
      return newGoal
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['savings_goals'] }),
  })

  const updateSavingsGoal = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SavingsGoal> }) => {
      const withTs = { ...updates, updated_at: new Date().toISOString() }
      await db.savings_goals.update(id, withTs)
      const updated = await db.savings_goals.get(id)
      if (updated) await write('savings_goals', 'update', updated as Record<string, unknown>)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['savings_goals'] }),
  })

  const deleteSavingsGoal = useMutation({
    mutationFn: async (id: string) => {
      await db.savings_goals.delete(id)
      await write('savings_goals', 'delete', { id })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['savings_goals'] }),
  })

  // ── Debts ─────────────────────────────────────────────────────────────
  const addDebt = useMutation({
    mutationFn: async (debt: Omit<Debt, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
      if (!user) return
      const now = new Date().toISOString()
      const newDebt = { ...debt, id: crypto.randomUUID(), user_id: user.id, created_at: now, updated_at: now } as Debt
      await db.debts.add(newDebt)
      await write('debts', 'insert', newDebt as Record<string, unknown>)
      return newDebt
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  })

  const updateDebt = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Debt> }) => {
      const withTs = { ...updates, updated_at: new Date().toISOString() }
      await db.debts.update(id, withTs)
      const updated = await db.debts.get(id)
      if (updated) await write('debts', 'update', updated as Record<string, unknown>)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  })

  const deleteDebt = useMutation({
    mutationFn: async (id: string) => {
      await db.debts.delete(id)
      await write('debts', 'delete', { id })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  })

  const toggleDebtPaid = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const withTs = { paid, updated_at: new Date().toISOString() }
      await db.debts.update(id, withTs)
      const updated = await db.debts.get(id)
      if (updated) await write('debts', 'update', updated as Record<string, unknown>)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  })

  return {
    addWallet, updateWallet, deleteWallet,
    addBudget, deleteBudget, updateBudget,
    addSavingsGoal, updateSavingsGoal, deleteSavingsGoal,
    addDebt, updateDebt, deleteDebt, toggleDebtPaid,
  }
}
