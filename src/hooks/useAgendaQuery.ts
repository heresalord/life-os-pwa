import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import type { AgendaBlock } from '../db/schema'

export function useAgendaQuery(date: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['agenda_blocks', date, user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.agenda_blocks.where('date').equals(date).sortBy('start_time')

      if (navigator.onLine) {
        bgSync(`agenda-${date}-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('agenda_blocks').select('*')
            .eq('user_id', user!.id).eq('date', date)
            .order('start_time')
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync('agenda_blocks', data as AgendaBlock[])
            await db.agenda_blocks.bulkPut(reconciled)
            queryClient.setQueryData(['agenda_blocks', date, user!.id], reconciled)
          }
        })
      }

      return local
    }
  })
}
