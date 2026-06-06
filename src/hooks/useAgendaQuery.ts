import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'

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
            await db.agenda_blocks.bulkPut(data as Parameters<typeof db.agenda_blocks.bulkPut>[0])
            queryClient.setQueryData(['agenda_blocks', date, user!.id], data)
          }
        })
      }

      return local
    }
  })
}
