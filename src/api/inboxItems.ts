import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type InboxitemsRow = Database['public']['Tables']['inbox_items']['Row']
export type InboxitemsInsert = Database['public']['Tables']['inbox_items']['Insert']
export type InboxitemsUpdate = Database['public']['Tables']['inbox_items']['Update']

export const inboxItemsApi = {
  async fetchAll() {
    const { data, error } = await supabase.from('inbox_items').select('*')
    if (error) throw error
    return data
  },
  async fetchById(id: string) {
    const { data, error } = await supabase.from('inbox_items').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async create(payload: InboxitemsInsert) {
    const { data, error } = await supabase.from('inbox_items').insert(payload).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: InboxitemsUpdate) {
    const { data, error } = await supabase.from('inbox_items').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string) {
    const { error } = await supabase.from('inbox_items').delete().eq('id', id)
    if (error) throw error
  }
}
