import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchMyConversations } from '../api/messages'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

export function useConversationsQuery() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const queryKey = ['conversations', user?.id]

  const query = useQuery({
    queryKey,
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => {
      if (!user) return []
      return await fetchMyConversations()
    },
  })

  // Realtime subscription for conversation updates
  useEffect(() => {
    if (!user) return

    const channelName = `user-conversations-${user.id}-${Math.random().toString(36).slice(2)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          qc.invalidateQueries({ queryKey })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, qc, queryKey])

  const conversations = query.data ?? []
  const totalUnreadCount = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0)

  return {
    ...query,
    conversations,
    totalUnreadCount,
  }
}

