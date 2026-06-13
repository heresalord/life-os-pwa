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
      const local = await db.agenda_blocks.where('date').equals(date).toArray()

      // Fetch all recurring blocks and merge them if they apply to this date
      const allBlocks = await db.agenda_blocks.toArray()
      const recurring = allBlocks.filter(b => b.recurrence && b.date !== date)

      const expandedRecurring = recurring.filter(b => {
        if (date < b.date) return false
        const rec = b.recurrence as any
        if (rec.type === 'daily') return true
        if (rec.type === 'weekly') {
          const targetDay = new Date(date + 'T12:00:00').getDay()
          const originalDay = new Date(b.date + 'T12:00:00').getDay()
          return targetDay === originalDay
        }
        return false
      }).map(b => ({
        ...b,
        date, // Override virtual date to match display date
        id: `${b.id}-${date}` // Make ID unique per virtual instance so key is unique
      }))

      const merged = [...local, ...expandedRecurring].sort((a, b) => {
        if (a.all_day && !b.all_day) return -1
        if (!a.all_day && b.all_day) return 1
        return a.start_time.localeCompare(b.start_time)
      })

      if (navigator.onLine) {
        bgSync(`agenda-${date}-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('agenda_blocks').select('*')
            .eq('user_id', user!.id)
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync('agenda_blocks', data as AgendaBlock[])
            await db.agenda_blocks.bulkPut(reconciled)

            const localReconciled = reconciled.filter(b => b.date === date)
            const allLocalBlocks = await db.agenda_blocks.toArray()
            const rec = allLocalBlocks.filter(b => b.recurrence && b.date !== date)
            const exp = rec.filter(b => {
              if (date < b.date) return false
              const r = b.recurrence as any
              if (r.type === 'daily') return true
              if (r.type === 'weekly') {
                const targetDay = new Date(date + 'T12:00:00').getDay()
                const originalDay = new Date(b.date + 'T12:00:00').getDay()
                return targetDay === originalDay
              }
              return false
            }).map(b => ({
              ...b,
              date,
              id: `${b.id}-${date}`
            }))

            const finalMerged = [...localReconciled, ...exp].sort((a, b) => {
              if (a.all_day && !b.all_day) return -1
              if (!a.all_day && b.all_day) return 1
              return a.start_time.localeCompare(b.start_time)
            })

            queryClient.setQueryData(['agenda_blocks', date, user!.id], finalMerged)
          }
        })
      }

      return merged
    }
  })
}
