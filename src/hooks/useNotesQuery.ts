import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useNotesQuery(date?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['notes', date, user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (navigator.onLine) {
        let q = supabase.from('notes').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
        if (date) q = q.eq('date', date)
        const { data, error } = await q
        if (error) throw error
        if (data) await db.notes.bulkPut(data as Parameters<typeof db.notes.bulkPut>[0])
        return data ?? []
      }
      if (date) return db.notes.where('date').equals(date).reverse().sortBy('created_at')
      return db.notes.orderBy('created_at').reverse().toArray()
    }
  })
}
