import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useDb } from '../db/DbContext'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import { QK } from '../lib/queryKeys'
import type { Note } from '../db/schema'

export function useNotesQuery(date?: string) {
  const db = useDb()
  const { user } = useAuth()
  return useQuery({
    queryKey: QK.notes(date, user?.id ?? ''),
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
            const reconciled = await reconcilePendingSync(db, 'notes', data as Note[])
            await db.notes.bulkPut(reconciled)
            queryClient.setQueryData(QK.notes(date, user!.id), reconciled)
          }
        })
      }

      return local
    }
  })
}
