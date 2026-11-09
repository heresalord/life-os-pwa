import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchConversationMessages, markConversationRead } from '../api/messages'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import type { Message } from '../db/schema'

export function useMessagesQuery(conversationId?: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const queryKey = ['messages', conversationId]

  const query = useQuery({
    queryKey,
    enabled: !!user && !!conversationId,
    staleTime: 10_000,
    queryFn: async () => {
      if (!conversationId) return []
      const list = await fetchConversationMessages(conversationId, 100)
      // Sort ascending (chronological) for the chat view
      return [...list].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    },
  })

  // Mark read on mount or when new messages arrive
  useEffect(() => {
    if (!conversationId || !user) return
    void markConversationRead(conversationId).then(() => {
      qc.invalidateQueries({ queryKey: ['conversations', user.id] })
    })
  }, [conversationId, user, query.data?.length, qc])

  // Realtime subscription for live messages in this conversation
  useEffect(() => {
    if (!conversationId || !user) return

    const channelName = `chat-${conversationId}-${Math.random().toString(36).slice(2)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message
            qc.setQueryData<Message[]>(queryKey, (old = []) => {
              if (old.some(m => m.id === newMsg.id)) return old
              return [...old, newMsg]
            })
            // Mark read if it's from the other person
            if (newMsg.sender_id !== user.id) {
              void markConversationRead(conversationId)
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message
            qc.setQueryData<Message[]>(queryKey, (old = []) =>
              old.map(m => (m.id === updatedMsg.id ? updatedMsg : m))
            )
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            qc.setQueryData<Message[]>(queryKey, (old = []) =>
              old.filter(m => m.id !== deleted.id)
            )
          }
          qc.invalidateQueries({ queryKey: ['conversations', user.id] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, user, qc, queryKey])

  return {
    ...query,
    messages: query.data ?? [],
  }
}

