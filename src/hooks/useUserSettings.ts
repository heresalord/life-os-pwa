import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userSettingsApi } from '../api/userSettings'
import type { UserSettingsRow, UserSettingsUpdate } from '../api/userSettings'
import { useAuth } from './useAuth'
import { db } from '../db'
import { bgSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'

export function useUserSettings(): {
  data: UserSettingsRow | null | undefined
  isLoading: boolean
  error: Error | null
  upsert: ReturnType<typeof useMutation<UserSettingsRow | undefined, Error, UserSettingsUpdate>>
} {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery<UserSettingsRow | null>({
    queryKey: ['user_settings', user?.id],
    enabled: !!user,
    // Settings almost never change — serve from Dexie forever, only sync in background.
    staleTime: Infinity,
    queryFn: async () => {
      // ── 1. Serve from Dexie immediately ─────────────────────────────
      const local = (await db.user_settings.get(user!.id)) ?? null

      // ── 2. Background sync from Supabase ────────────────────────────
      if (navigator.onLine) {
        bgSync(`user_settings-${user!.id}`, async () => {
          const fresh = await userSettingsApi.fetchByUserId(user!.id)
          if (fresh) {
            await db.user_settings.put(fresh as Parameters<typeof db.user_settings.put>[0])
            queryClient.setQueryData(['user_settings', user!.id], fresh)
          }
        })
      }

      return local as UserSettingsRow | null
    }
  })

  const upsert = useMutation<UserSettingsRow | undefined, Error, UserSettingsUpdate>({
    mutationFn: async (updates) => {
      if (!user) return undefined
      return userSettingsApi.upsert({ user_id: user.id, ...updates })
    },
    onSuccess: (data) => {
      if (data) {
        // Update the cache and local store immediately — no invalidation needed.
        qc.setQueryData(['user_settings', user?.id], data)
        db.user_settings.put(data as Parameters<typeof db.user_settings.put>[0])
      }
    }
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    upsert,
  }
}
