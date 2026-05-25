
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useNotesQuery(date?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['notes', date],
    enabled: !!user,
    queryFn: async () => {
      if (date) {
        const local = await db.notes.where('date').equals(date).toArray()
        if (local.length) return local
      }
      const q = supabase.from('notes').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
      if (date) q.eq('date', date)
      const { data } = await q
      if (data?.length) await db.notes.bulkPut(data as any)
      return data ?? []
    }
  })
}
