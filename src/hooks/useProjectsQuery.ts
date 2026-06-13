import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync, reconcilePendingSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import type { Project } from '../db/schema'

export function useProjectsQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['projects', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = await db.projects.orderBy('created_at').toArray()

      if (navigator.onLine && user) {
        bgSync(`projects-${user.id}`, async () => {
          const { data, error } = await supabase
            .from('projects').select('*')
            .eq('user_id', user.id)
            .order('created_at')
          if (error) throw error
          if (data) {
            const reconciled = await reconcilePendingSync('projects', data as Project[])
            await db.projects.bulkPut(reconciled)
            queryClient.setQueryData(['projects', user.id], reconciled)
          }
        })
      }

      return local
    }
  })
}
