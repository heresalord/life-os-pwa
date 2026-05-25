import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type TransactionsRow = Database['public']['Tables']['transactions']['Row']
export type TransactionsInsert = Database['public']['Tables']['transactions']['Insert']
export type TransactionsUpdate = Database['public']['Tables']['transactions']['Update']

export const transactionsApi = {
  async fetchAll() {
    const { data, error } = await supabase.from('transactions').select('*')
    if (error) throw error
    return data
  },
  async fetchById(id: string) {
    const { data, error } = await supabase.from('transactions').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async create(payload: TransactionsInsert) {
    const { data, error } = await supabase.from('transactions').insert(payload).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: TransactionsUpdate) {
    const { data, error } = await supabase.from('transactions').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string) {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
  }
}
