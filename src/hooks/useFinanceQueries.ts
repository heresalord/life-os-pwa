import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export function useWallets() {
  return useLiveQuery(() => db.wallets.toArray())
}

export function useBudgets() {
  return useLiveQuery(() => db.budgets.toArray())
}

export function useSavingsGoals() {
  return useLiveQuery(() => db.savings_goals.toArray())
}

export function useDebts() {
  return useLiveQuery(() => db.debts.toArray())
}
