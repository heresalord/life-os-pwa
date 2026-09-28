import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useDb } from '../db/DbContext'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import { QK } from '../lib/queryKeys'
import type { AgendaBlock } from '../db/schema'

export function doesBlockRecurOnDate(block: AgendaBlock, targetDate: string): boolean {
  if (!block.recurrence) return false
  if (targetDate < block.date) return false

  const rec = block.recurrence as any
  if (rec.end_date && targetDate > rec.end_date) return false

  const targetDt = new Date(targetDate + 'T12:00:00')
  const targetDay = targetDt.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat

  switch (rec.type) {
    case 'daily':
      return true
    case 'weekdays':
      return targetDay >= 1 && targetDay <= 5
    case 'weekly': {
      // If user specified specific days array (e.g., [1] for Monday, or [1, 3, 5])
      if (Array.isArray(rec.days) && rec.days.length > 0) {
        return rec.days.includes(targetDay)
      }
      // Fallback: match day-of-week of the original block date
      const originalDay = new Date(block.date + 'T12:00:00').getDay()
      return targetDay === originalDay
    }
    case 'monthly': {
      const originalDayOfMonth = new Date(block.date + 'T12:00:00').getDate()
      return targetDt.getDate() === originalDayOfMonth
    }
    case 'yearly': {
      const orig = new Date(block.date + 'T12:00:00')
      return targetDt.getMonth() === orig.getMonth() && targetDt.getDate() === orig.getDate()
    }
    default:
      return false
  }
}

function expandRecurringBlocks(allBlocks: AgendaBlock[], date: string): AgendaBlock[] {
  const recurring = allBlocks.filter(b => b.recurrence && b.date !== date)
  return recurring.filter(b => doesBlockRecurOnDate(b, date)).map(b => ({
    ...b,
    date,
    id: `virtual__${b.id}__${date}`,
  }))
}

export function useAgendaQuery(date: string) {
  const db = useDb()
  const { user } = useAuth()
  return useQuery({
    queryKey: QK.agenda(date, user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.agenda_blocks.where('date').equals(date).toArray()

      // Fetch all recurring blocks and merge them if they apply to this date
      const allBlocks = await db.agenda_blocks.toArray()
      const expandedRecurring = expandRecurringBlocks(allBlocks, date)

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
            const reconciled = await reconcilePendingSync(db, 'agenda_blocks', data as AgendaBlock[])
            await db.agenda_blocks.bulkPut(reconciled)

            const localReconciled = reconciled.filter(b => b.date === date)
            const allLocalBlocks = await db.agenda_blocks.toArray()
            const exp = expandRecurringBlocks(allLocalBlocks, date)

            const finalMerged = [...localReconciled, ...exp].sort((a, b) => {
              if (a.all_day && !b.all_day) return -1
              if (!a.all_day && b.all_day) return 1
              return a.start_time.localeCompare(b.start_time)
            })

            queryClient.setQueryData(QK.agenda(date, user!.id), finalMerged)
          }
        })
      }

      return merged
    }
  })
}
