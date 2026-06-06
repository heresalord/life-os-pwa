import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import type { Wallet, Budget, SavingsGoal, Debt } from '../db/schema'

export function useWallets() {
  const { user } = useAuth()
  return useQuery<Wallet[]>({
    queryKey: ['wallets', user?.id],
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
            await db.wallets.bulkPut(data as Wallet[])
            queryClient.setQueryData(['wallets', user!.id], data)
          }
        })
      }
      return local
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
      const local = await db.budgets.toArray()
      if (navigator.onLine) {
        bgSync(`budgets-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('budgets').select('*')
            .eq('user_id', user!.id).order('created_at')
          if (error) throw error
          if (data) {
            await db.budgets.bulkPut(data as Budget[])
            queryClient.setQueryData(['budgets', user!.id], data)
          }
        })
      }
      return local
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
      const local = await db.savings_goals.toArray()
      if (navigator.onLine) {
        bgSync(`savings_goals-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('savings_goals').select('*')
            .eq('user_id', user!.id).order('created_at')
          if (error) throw error
          if (data) {
            await db.savings_goals.bulkPut(data as SavingsGoal[])
            queryClient.setQueryData(['savings_goals', user!.id], data)
          }
        })
      }
      return local
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
      const local = await db.debts.toArray()
      if (navigator.onLine) {
        bgSync(`debts-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('debts').select('*')
            .eq('user_id', user!.id).order('created_at')
          if (error) throw error
          if (data) {
            await db.debts.bulkPut(data as Debt[])
            queryClient.setQueryData(['debts', user!.id], data)
          }
        })
      }
      return local
    },
  })
}
