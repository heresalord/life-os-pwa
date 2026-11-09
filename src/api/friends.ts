import { supabase } from '../lib/supabase'

export interface PublicUserProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

export interface FriendProfile extends PublicUserProfile {
  friendship_created_at: string
}

export interface FriendRequestItem {
  id: string
  from_user: string
  to_user: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  created_at: string
  sender?: PublicUserProfile
  recipient?: PublicUserProfile
}

export interface FriendRequestsPayload {
  incoming: FriendRequestItem[]
  outgoing: FriendRequestItem[]
}

export interface BlockedUserProfile extends PublicUserProfile {
  blocked_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supa = supabase as any

/** Exact search by username (case-insensitive) */
export async function findUserByUsername(username: string): Promise<PublicUserProfile | null> {
  const { data, error } = await supa.rpc('find_user_by_username', {
    p_username: username.trim(),
  })
  if (error) throw error
  if (!data || data.length === 0) return null
  return data[0] as PublicUserProfile
}

/** Set or update the caller's username (rate-limited to 1x per 30 days) */
export async function setUsername(username: string): Promise<string> {
  const { data, error } = await supa.rpc('set_username', {
    p_username: username.trim(),
  })
  if (error) throw error
  return data as string
}

/** Send a friend request to a target user */
export async function sendFriendRequest(toUserId: string): Promise<{
  status: string
  request_id: string
  auto_accepted: boolean
}> {
  const { data, error } = await supa.rpc('send_friend_request', {
    p_to: toUserId,
  })
  if (error) throw error
  return data
}

/** Accept or decline an incoming friend request */
export async function respondFriendRequest(
  requestId: string,
  accept: boolean
): Promise<{ status: string; request_id: string }> {
  const { data, error } = await supa.rpc('respond_friend_request', {
    p_id: requestId,
    p_accept: accept,
  })
  if (error) throw error
  return data
}

/** Cancel an outgoing friend request */
export async function cancelFriendRequest(
  requestId: string
): Promise<{ status: string; request_id: string }> {
  const { data, error } = await supa.rpc('cancel_friend_request', {
    p_id: requestId,
  })
  if (error) throw error
  return data
}

/** Remove an existing friendship */
export async function removeFriend(friendId: string): Promise<boolean> {
  const { data, error } = await supa.rpc('remove_friend', {
    p_user: friendId,
  })
  if (error) throw error
  return !!data
}

/** Block a user (removes friendship and cancels pending requests) */
export async function blockUser(userId: string): Promise<boolean> {
  const { data, error } = await supa.rpc('block_user', {
    p_user: userId,
  })
  if (error) throw error
  return !!data
}

/** Unblock a user */
export async function unblockUser(userId: string): Promise<boolean> {
  const { data, error } = await supa.rpc('unblock_user', {
    p_user: userId,
  })
  if (error) throw error
  return !!data
}

/** Get list of authenticated user's friends */
export async function fetchMyFriends(): Promise<FriendProfile[]> {
  const { data, error } = await supa.rpc('get_my_friends')
  if (error) throw error
  return (data ?? []) as FriendProfile[]
}

/** Get incoming & outgoing friend requests */
export async function fetchMyFriendRequests(): Promise<FriendRequestsPayload> {
  const { data, error } = await supa.rpc('get_my_friend_requests')
  if (error) throw error
  return data ?? { incoming: [], outgoing: [] }
}

/** Get list of blocked users */
export async function fetchMyBlocks(): Promise<BlockedUserProfile[]> {
  const { data, error } = await supa.rpc('get_my_blocks')
  if (error) throw error
  return (data ?? []) as BlockedUserProfile[]
}

