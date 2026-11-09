import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  setUsername,
  sendFriendRequest,
  respondFriendRequest,
  cancelFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
} from '../api/friends'
import { useAuth } from './useAuth'

export function useFriendMutations() {
  const qc = useQueryClient()
  const { refreshProfile } = useAuth()

  const invalidateSocial = () => {
    qc.invalidateQueries({ queryKey: ['social'] })
  }

  const setUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const saved = await setUsername(username)
      if (refreshProfile) {
        await refreshProfile()
      }
      return saved
    },
    onSuccess: () => invalidateSocial(),
  })

  const sendRequestMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return await sendFriendRequest(targetUserId)
    },
    onSuccess: () => invalidateSocial(),
  })

  const respondRequestMutation = useMutation({
    mutationFn: async ({ requestId, accept }: { requestId: string; accept: boolean }) => {
      return await respondFriendRequest(requestId, accept)
    },
    onSuccess: () => invalidateSocial(),
  })

  const cancelRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await cancelFriendRequest(requestId)
    },
    onSuccess: () => invalidateSocial(),
  })

  const removeFriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      return await removeFriend(friendId)
    },
    onSuccess: () => invalidateSocial(),
  })

  const blockUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await blockUser(userId)
    },
    onSuccess: () => invalidateSocial(),
  })

  const unblockUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await unblockUser(userId)
    },
    onSuccess: () => invalidateSocial(),
  })

  return {
    setUsername: setUsernameMutation,
    sendRequest: sendRequestMutation,
    respondRequest: respondRequestMutation,
    cancelRequest: cancelRequestMutation,
    removeFriend: removeFriendMutation,
    blockUser: blockUserMutation,
    unblockUser: unblockUserMutation,
  }
}
