import { useMutation } from '@tanstack/react-query'
import { db } from '../db'
import type { Wallet, Budget, SavingsGoal, Debt } from '../db/schema'
import { enqueueSync } from '../db/syncQueue'

export function useFinanceMutations() {
  const addWallet = useMutation({
    mutationFn: async (wallet: Omit<Wallet, 'id' | 'created_at' | 'updated_at'>) => {
      const id = crypto.randomUUID()
      const newWallet = {
        ...wallet,
        id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Wallet
      await db.wallets.add(newWallet)
      await enqueueSync('wallets', 'insert', newWallet)
      return newWallet
    }
  })

  const addBudget = useMutation({
    mutationFn: async (budget: Omit<Budget, 'id' | 'created_at' | 'updated_at'>) => {
      const id = crypto.randomUUID()
      const newBudget = {
        ...budget,
        id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Budget
      await db.budgets.add(newBudget)
      await enqueueSync('budgets', 'insert', newBudget)
      return newBudget
    }
  })

  const addSavingsGoal = useMutation({
    mutationFn: async (goal: Omit<SavingsGoal, 'id' | 'created_at' | 'updated_at'>) => {
      const id = crypto.randomUUID()
      const newGoal = {
        ...goal,
        id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as SavingsGoal
      await db.savings_goals.add(newGoal)
      await enqueueSync('savings_goals', 'insert', newGoal)
      return newGoal
    }
  })

  const addDebt = useMutation({
    mutationFn: async (debt: Omit<Debt, 'id' | 'created_at' | 'updated_at'>) => {
      const id = crypto.randomUUID()
      const newDebt = {
        ...debt,
        id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Debt
      await db.debts.add(newDebt)
      await enqueueSync('debts', 'insert', newDebt)
      return newDebt
    }
  })

  const toggleDebtPaid = useMutation({
    mutationFn: async ({ id, paid }: { id: string, paid: boolean }) => {
      await db.debts.update(id, { paid, updated_at: new Date().toISOString() })
      const debt = await db.debts.get(id)
      await enqueueSync('debts', 'update', debt)
    }
  })

  const updateSavingsGoal = useMutation({
    mutationFn: async ({ id, current }: { id: string, current: number }) => {
      await db.savings_goals.update(id, { current, updated_at: new Date().toISOString() })
      const goal = await db.savings_goals.get(id)
      await enqueueSync('savings_goals', 'update', goal)
    }
  })

  return { addWallet, addBudget, addSavingsGoal, addDebt, toggleDebtPaid, updateSavingsGoal }
}
