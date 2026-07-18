import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useDb } from '../db/DbContext'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import { seedRecurringTasks } from '../lib/recurringTasks'
import { getUserLocalDate } from '../lib/dateUtils'
import { useAppStore } from '../store/useAppStore'
import { QK } from '../lib/queryKeys'
import type { Task } from '../db/schema'

export function useTasksQuery(date: string) {
  const db = useDb()
  const { user } = useAuth()
  const { timezone } = useAppStore()
  const today = getUserLocalDate(timezone)

  return useQuery({
    queryKey: QK.tasks(date, user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.tasks.where('date').equals(date).sortBy('created_at')

      if (date === today && user) {
        seedRecurringTasks(db, user.id, date)
      }

      if (navigator.onLine) {
        bgSync(`tasks-${date}-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('tasks').select('*')
            .eq('date', date)
            .order('created_at')
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync(db, 'tasks', data as Task[])
            await db.tasks.bulkPut(reconciled)
            queryClient.setQueryData(QK.tasks(date, user!.id), reconciled)
          }
        })
      }

      return local
    }
  })
}
