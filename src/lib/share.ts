import { supabase } from './supabase'

export interface SharedItem {
  id: string
  shared_by: string
  shared_with_email: string
  shared_with_id: string | null
  item_type: 'project' | 'task' | 'inbox'
  item_id: string
  code: string
  status: 'pending' | 'accepted'
  created_at: string
}

/**
 * Generate a collaborative share code for an item.
 */
export async function createShareCode(
  type: 'project' | 'task' | 'inbox',
  itemId: string,
  targetEmail: string
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Authentication required to share items')

  const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
  const code = `SHARE-${rand}`

  const { error } = await supabase
    .from('shared_items')
    .insert({
      shared_by:         user.id,
      shared_with_email: targetEmail.trim().toLowerCase(),
      item_type:         type,
      item_id:           itemId,
      code,
      status:            'pending',
    })

  if (error) {
    console.error('[share] createShareCode error:', error)
    throw error
  }

  return code
}

/**
 * Redeem / accept a collaborative share code.
 */
export async function redeemShareCode(code: string): Promise<SharedItem> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Authentication required to redeem share codes')

  const cleanCode = code.trim().toUpperCase()

  const { data: pendingShare, error: fetchError } = await supabase
    .from('shared_items')
    .select('*')
    .eq('code', cleanCode)
    .single()

  if (fetchError || !pendingShare) {
    throw new Error('Invalid or expired share code')
  }

  const { data, error } = await supabase
    .from('shared_items')
    .update({ status: 'accepted', shared_with_id: user.id })
    .eq('code', cleanCode)
    .select()
    .single()

  if (error) {
    console.error('[share] redeemShareCode error:', error)
    throw error
  }

  return data as SharedItem
}

/**
 * Fetch all shared items associated with the current user (sent + received).
 */
export async function fetchMySharedItems(): Promise<{
  sent: SharedItem[]
  received: SharedItem[]
}> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { sent: [], received: [] }

  const { data, error } = await supabase
    .from('shared_items')
    .select('*')

  if (error) {
    console.error('[share] fetchMySharedItems error:', error)
    return { sent: [], received: [] }
  }

  const items = (data ?? []) as SharedItem[]
  return {
    sent:     items.filter(i => i.shared_by === user.id),
    received: items.filter(i => i.shared_by !== user.id),
  }
}
