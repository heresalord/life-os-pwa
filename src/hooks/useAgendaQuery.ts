
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'

export function useAgendaQuery(date: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['agenda_blocks', date],
    enabled: !!user,
    queryFn: async () => {
      const local = await db.agenda_blocks.where('date').equals(date).toArray()
      if (local.length) return local
      
      const { data } = await supabase.from('agenda_blocks').select('*').eq('date', date).eq('user_id', user!.id)
      if (data?.length) await db.agenda_blocks.bulkPut(data as any)
      return data ?? []
    }
  })
}
