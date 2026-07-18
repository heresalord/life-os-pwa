import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useDb } from '../db/DbContext'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import { QK } from '../lib/queryKeys'
import type { Wallet, Budget, SavingsGoal, Debt } from '../db/schema'

export function useWallets() {
  const db = useDb()
  const { user } = useAuth()
  return useQuery<Wallet[]>({
    queryKey: QK.wallets(user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.wallets.toArray()
      if (navigator.onLine) {
        bgSync(`wallets-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('wallets').select('*')
            .eq('user_id', user!.id).order('created_at')
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync(db, 'wallets', data as Wallet[])
            await db.wallets.bulkPut(reconciled)
            queryClient.setQueryData(QK.wallets(user!.id), reconciled)
          }
        })
      }
      return local
    },
  })
}

export function useBudgets() {
  const db = useDb()
  const { user } = useAuth()
  return useQuery<Budget[]>({
    queryKey: QK.budgets(user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.budgets.toArray()
      if (navigator.onLine) {
        bgSync(`budgets-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('budgets').select('*')
            .eq('user_id', user!.id).order('created_at')
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync(db, 'budgets', data as Budget[])
            await db.budgets.bulkPut(reconciled)
            queryClient.setQueryData(QK.budgets(user!.id), reconciled)
          }
        })
      }
      return local
    },
  })
}

export function useSavingsGoals() {
  const db = useDb()
  const { user } = useAuth()
  return useQuery<SavingsGoal[]>({
    queryKey: QK.savingsGoals(user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.savings_goals.toArray()
      if (navigator.onLine) {
        bgSync(`savings_goals-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('savings_goals').select('*')
            .eq('user_id', user!.id).order('created_at')
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync(db, 'savings_goals', data as SavingsGoal[])
            await db.savings_goals.bulkPut(reconciled)
            queryClient.setQueryData(QK.savingsGoals(user!.id), reconciled)
          }
        })
      }
      return local
    },
  })
}

export function useDebts() {
  const db = useDb()
  const { user } = useAuth()
  return useQuery<Debt[]>({
    queryKey: QK.debts(user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.debts.toArray()
      if (navigator.onLine) {
        bgSync(`debts-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('debts').select('*')
            .eq('user_id', user!.id).order('created_at')
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync(db, 'debts', data as Debt[])
            await db.debts.bulkPut(reconciled)
            queryClient.setQueryData(QK.debts(user!.id), reconciled)
          }
        })
      }
      return local
    },
  })
}
