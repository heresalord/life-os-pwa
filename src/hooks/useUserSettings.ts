import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userSettingsApi } from '../api/userSettings'
import type { UserSettingsRow, UserSettingsUpdate } from '../api/userSettings'
import { useAuth } from './useAuth'

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
    queryFn: () => userSettingsApi.fetchByUserId(user!.id)
  })

  const upsert = useMutation<UserSettingsRow | undefined, Error, UserSettingsUpdate>({
    mutationFn: async (updates) => {
      if (!user) return undefined
      return userSettingsApi.upsert({ user_id: user.id, ...updates })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user_settings', user?.id] })
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    upsert,
  }
}
