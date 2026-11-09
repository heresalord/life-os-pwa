import { useQuery } from '@tanstack/react-query'
import { fetchMyFriends, fetchMyFriendRequests, fetchMyBlocks } from '../api/friends'
import { useAuth } from './useAuth'

export function useFriendsQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['social', 'friends', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return []
      return await fetchMyFriends()
    },
  })
}

export function useFriendRequestsQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['social', 'requests', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user) return { incoming: [], outgoing: [] }
      return await fetchMyFriendRequests()
    },
  })
}

export function useBlocksQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['social', 'blocks', user?.id],
    enabled: !!user,
    staleTime: 120_000,
    queryFn: async () => {
      if (!user) return []
      return await fetchMyBlocks()
    },
  })
}

