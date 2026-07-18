import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useDb } from '../db/DbContext'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import { QK } from '../lib/queryKeys'
import type { Project } from '../db/schema'

export function useProjectsQuery() {
  const db = useDb()
  const { user } = useAuth()
  return useQuery({
    queryKey: QK.projects(user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.projects.orderBy('created_at').toArray()

      if (navigator.onLine && user) {
        bgSync(`projects-${user.id}`, async () => {
          const { data, error } = await supabase
            .from('projects').select('*')
            .order('created_at')
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync(db, 'projects', data as Project[])
            await db.projects.bulkPut(reconciled)
            queryClient.setQueryData(QK.projects(user.id), reconciled)
          }
        })
      }

      return local
    }
  })
}
