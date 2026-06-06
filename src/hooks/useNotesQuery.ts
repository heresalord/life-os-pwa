import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'

export function useNotesQuery(date?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['notes', date, user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      // updated_at is not a Dexie index — always fetch all and sort in JS
      const all = await (date
        ? db.notes.where('date').equals(date).toArray()
        : db.notes.toArray()
      )
      const local = all.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )

      if (navigator.onLine) {
        bgSync(`notes-${date ?? 'all'}-${user!.id}`, async () => {
          let q = supabase.from('notes').select('*').eq('user_id', user!.id).order('updated_at', { ascending: false })
          if (date) q = q.eq('date', date)
          const { data, error } = await q
          if (error) throw error
          if (data) {
            await db.notes.bulkPut(data as Parameters<typeof db.notes.bulkPut>[0])
            queryClient.setQueryData(['notes', date, user!.id], data)
          }
        })
      }

      return local
    }
  })
}
