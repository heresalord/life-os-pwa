import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  sendMessage,
  unsendMessage,
  editMessage,
  hideConversation,
  muteConversation,
} from '../api/messages'
import { useAuth } from './useAuth'
import { useDb } from '../db/DbContext'
import { enqueueOutboxItem } from '../lib/sync'
import { haptic } from '../lib/haptic'
import type { Message, MessageAttachment } from '../db/schema'

export function useMessageMutations(conversationId?: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const db = useDb()

  const queryKey = ['messages', conversationId]

  const sendMutation = useMutation({
    mutationFn: async ({
      body,
      kind = 'text',
      attachment,
      replyTo,
    }: {
      body?: string | null
      kind?: 'text' | 'attachment' | 'system'
      attachment?: MessageAttachment | null
      replyTo?: string | null
    }) => {
      if (!conversationId || !user) throw new Error('Missing conversation or user')

      const messageId = crypto.randomUUID()
      const isOnline = navigator.onLine

      if (!isOnline) {
        // Queue in Dexie outbox for offline sending
        const offlineMsg: Message = {
          id: messageId,
          conversation_id: conversationId,
          sender_id: user.id,
          kind,
          body: body ?? null,
          attachment: attachment ? (attachment as any) : null,
          reply_to: replyTo ?? null,
          created_at: new Date().toISOString(),
          edited_at: null,
          deleted_at: null,
        }
        await enqueueOutboxItem(
          db,
          'messages',
          'insert',
          messageId,
          offlineMsg as unknown as Record<string, unknown>
        )
        return offlineMsg
      }

      return await sendMessage({
        id: messageId,
        conversationId,
        kind,
        body,
        attachment,
        replyTo,
      })
    },
    onMutate: async ({ body, kind = 'text', attachment, replyTo }) => {
      if (!conversationId || !user) return
      haptic('light')

      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<Message[]>(queryKey)

      const optimistic: Message = {
        id: `opt-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: user.id,
        kind,
        body: body ?? null,
        attachment: attachment ? (attachment as any) : null,
        reply_to: replyTo ?? null,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
      }

      qc.setQueryData<Message[]>(queryKey, (old = []) => [...old, optimistic])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKey, ctx.previous)
      }
    },
    onSuccess: (saved) => {
      qc.setQueryData<Message[]>(queryKey, (old = []) =>
        old.map(m => (m.id.startsWith('opt-') && m.body === saved.body ? saved : m))
      )
      qc.invalidateQueries({ queryKey: ['conversations', user?.id] })
    },
  })

  const unsendMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return await unsendMessage(messageId)
    },
    onSuccess: (_, messageId) => {
      qc.setQueryData<Message[]>(queryKey, (old = []) =>
        old.map(m =>
          m.id === messageId ? { ...m, deleted_at: new Date().toISOString(), body: null, attachment: null } : m
        )
      )
      qc.invalidateQueries({ queryKey: ['conversations', user?.id] })
    },
  })

  const editMutation = useMutation({
    mutationFn: async ({ messageId, newBody }: { messageId: string; newBody: string }) => {
      return await editMessage(messageId, newBody)
    },
    onSuccess: (_, { messageId, newBody }) => {
      qc.setQueryData<Message[]>(queryKey, (old = []) =>
        old.map(m =>
          m.id === messageId ? { ...m, body: newBody, edited_at: new Date().toISOString() } : m
        )
      )
    },
  })

  const hideMutation = useMutation({
    mutationFn: async (convId: string) => {
      return await hideConversation(convId, true)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations', user?.id] })
    },
  })

  const muteMutation = useMutation({
    mutationFn: async ({ convId, muted }: { convId: string; muted: boolean }) => {
      return await muteConversation(convId, muted)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations', user?.id] })
    },
  })

  return {
    sendMessage: sendMutation,
    unsendMessage: unsendMutation,
    editMessage: editMutation,
    hideConversation: hideMutation,
    muteConversation: muteMutation,
  }
}

