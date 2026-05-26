import { supabase, db } from '../lib/supabase'
import type { Database } from '../types/database'

export type InboxItemRow    = Database['public']['Tables']['inbox_items']['Row']
export type InboxItemInsert = Database['public']['Tables']['inbox_items']['Insert']
export type InboxItemUpdate = Database['public']['Tables']['inbox_items']['Update']

export const inboxItemsApi = {
  async fetchUnprocessed(userId: string): Promise<InboxItemRow[]> {
    const { data, error } = await supabase.from('inbox_items').select('*').eq('user_id', userId).eq('processed', false).order('captured_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
  async fetchAll(userId: string): Promise<InboxItemRow[]> {
    const { data, error } = await supabase.from('inbox_items').select('*').eq('user_id', userId).order('captured_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
  async create(payload: InboxItemInsert): Promise<InboxItemRow> {
    const { data, error } = await db.from('inbox_items').insert([payload]).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: InboxItemUpdate): Promise<InboxItemRow> {
    const { data, error } = await db.from('inbox_items').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('inbox_items').delete().eq('id', id)
    if (error) throw error
  }
}
