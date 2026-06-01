import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import type { Wallet, Budget, SavingsGoal, Debt } from '../db/schema'

export function useWallets() {
  const { user } = useAuth()
  return useQuery<Wallet[]>({
    queryKey: ['wallets', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('wallets').select('*')
          .eq('user_id', user!.id)
          .order('created_at')
        if (error) throw error
        if (data) await db.wallets.bulkPut(data as Wallet[])
        return (data ?? []) as Wallet[]
      }
      return db.wallets.toArray()
    },
  })
}

export function useBudgets() {
  const { user } = useAuth()
  return useQuery<Budget[]>({
    queryKey: ['budgets', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('budgets').select('*')
          .eq('user_id', user!.id)
          .order('created_at')
        if (error) throw error
        if (data) await db.budgets.bulkPut(data as Budget[])
        return (data ?? []) as Budget[]
      }
      return db.budgets.toArray()
    },
  })
}

export function useSavingsGoals() {
  const { user } = useAuth()
  return useQuery<SavingsGoal[]>({
    queryKey: ['savings_goals', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('savings_goals').select('*')
          .eq('user_id', user!.id)
          .order('created_at')
        if (error) throw error
        if (data) await db.savings_goals.bulkPut(data as SavingsGoal[])
        return (data ?? []) as SavingsGoal[]
      }
      return db.savings_goals.toArray()
    },
  })
}

export function useDebts() {
  const { user } = useAuth()
  return useQuery<Debt[]>({
    queryKey: ['debts', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('debts').select('*')
          .eq('user_id', user!.id)
          .order('created_at')
        if (error) throw error
        if (data) await db.debts.bulkPut(data as Debt[])
        return (data ?? []) as Debt[]
      }
      return db.debts.toArray()
    },
  })
}
