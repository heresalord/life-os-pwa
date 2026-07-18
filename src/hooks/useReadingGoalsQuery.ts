import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useDb } from '../db/DbContext'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import { QK } from '../lib/queryKeys'
import type { ReadingGoal } from '../db/schema'
import { enqueueSync } from '../db/syncQueue'

export function useReadingGoalsQuery() {
  const db = useDb()
  const { user } = useAuth()
  return useQuery({
    queryKey: QK.readingGoals(user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.reading_goals.where('user_id').equals(user!.id).toArray()

      if (navigator.onLine) {
        bgSync(`reading_goals-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('reading_goals').select('*').eq('user_id', user!.id)
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync(db, 'reading_goals', data as ReadingGoal[])
            await db.reading_goals.bulkPut(reconciled)
            queryClient.setQueryData(QK.readingGoals(user!.id), reconciled)
          }
        })
      }

      return local as ReadingGoal[]
    }
  })
}

export function useSaveReadingGoalMutation() {
  const db = useDb()
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      year: number
      target_books: number
      target_pages: number | null
    }) => {
      if (!user) return

      const existing = await db.reading_goals
        .where({ user_id: user.id, year: payload.year })
        .first()

      const goal: ReadingGoal = {
        id: existing?.id || crypto.randomUUID(),
        user_id: user.id,
        year: payload.year,
        target_books: payload.target_books,
        target_pages: payload.target_pages,
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      await db.reading_goals.put(goal)
      await enqueueSync('reading_goals', 'insert', goal)
      return goal
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QK.readingGoals(user?.id ?? '') })
    }
  })
}
