import { supabase } from '../lib/supabase'
import type { Message, MessageAttachment } from '../db/schema'

export interface ConversationSummary {
  conversation_id: string
  kind: 'direct' | 'group'
  peer_id: string
  peer_username: string
  peer_display_name: string | null
  peer_avatar_url: string | null
  peer_last_read_at: string | null
  my_last_read_at: string | null
  muted: boolean
  last_message_at: string | null
  latest_body: string | null
  latest_kind: string | null
  latest_sender_id: string | null
  unread_count: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supa = supabase as any

/** Get or create a 1:1 direct chat with a friend */
export async function getOrCreateDirectConversation(friendId: string): Promise<string> {
  const { data, error } = await supa.rpc('get_or_create_direct_conversation', {
    p_friend_id: friendId,
  })
  if (error) throw error
  return data as string
}

/** Send a message into a conversation */
export async function sendMessage(params: {
  id?: string
  conversationId: string
  kind: 'text' | 'attachment' | 'system'
  body?: string | null
  attachment?: MessageAttachment | null
  replyTo?: string | null
}): Promise<Message> {
  const messageId = params.id || crypto.randomUUID()
  const { data, error } = await supa.rpc('send_message', {
    p_id: messageId,
    p_conversation_id: params.conversationId,
    p_kind: params.kind,
    p_body: params.body ?? null,
    p_attachment: params.attachment ?? null,
    p_reply_to: params.replyTo ?? null,
  })
  if (error) throw error
  return data as Message
}

/** Fetch all active conversations with previews and unread counts */
export async function fetchMyConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await supa.rpc('get_my_conversations')
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    unread_count: Number(row.unread_count || 0),
  })) as ConversationSummary[]
}

/** Fetch paginated messages for a conversation */
export async function fetchConversationMessages(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<Message[]> {
  const { data, error } = await supa.rpc('get_conversation_messages', {
    p_conversation_id: conversationId,
    p_limit: limit,
    p_before: before || null,
  })
  if (error) throw error
  return (data ?? []) as Message[]
}

/** Mark conversation as read */
export async function markConversationRead(conversationId: string): Promise<boolean> {
  const { data, error } = await supa.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  })
  if (error) {
    console.warn('[messages] markConversationRead error:', error.message)
    return false
  }
  return !!data
}

/** Unsend a message (sender only) */
export async function unsendMessage(messageId: string): Promise<boolean> {
  const { data, error } = await supa.rpc('unsend_message', {
    p_message_id: messageId,
  })
  if (error) throw error
  return !!data
}

/** Edit a message within 15 minutes (sender only) */
export async function editMessage(messageId: string, newBody: string): Promise<boolean> {
  const { data, error } = await supa.rpc('edit_message', {
    p_message_id: messageId,
    p_new_body: newBody,
  })
  if (error) throw error
  return !!data
}

/** Hide conversation from list */
export async function hideConversation(conversationId: string, hidden = true): Promise<boolean> {
  const { data, error } = await supa.rpc('hide_conversation', {
    p_conversation_id: conversationId,
    p_hidden: hidden,
  })
  if (error) throw error
  return !!data
}

/** Mute conversation notifications */
export async function muteConversation(conversationId: string, muted = true): Promise<boolean> {
  const { data, error } = await supa.rpc('mute_conversation', {
    p_conversation_id: conversationId,
    p_muted: muted,
  })
  if (error) throw error
  return !!data
}

