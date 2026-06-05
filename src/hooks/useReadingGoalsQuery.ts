import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import type { ReadingGoal } from '../db/schema'
import { enqueueSync } from '../db/syncQueue'

const supa = supabase as any

export function useReadingGoalsQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['reading_goals', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('reading_goals')
          .select('*')
          .eq('user_id', user!.id)
        if (error) throw error
        if (data) {
          await db.reading_goals.bulkPut(data as ReadingGoal[])
          return data as ReadingGoal[]
        }
        return []
      }
      return db.reading_goals.where('user_id').equals(user!.id).toArray()
    }
  })
}

export function useSaveReadingGoalMutation() {
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
      
      if (navigator.onLine) {
        const { error } = await supa.from('reading_goals').upsert([goal], { onConflict: 'id', ignoreDuplicates: false })
        if (error) {
          await enqueueSync('reading_goals', 'insert', goal)
        }
      } else {
        await enqueueSync('reading_goals', 'insert', goal)
      }
      
      return goal
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['reading_goals', user?.id] })
    }
  })
}
