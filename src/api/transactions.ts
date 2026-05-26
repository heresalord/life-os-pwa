import { supabase, db } from '../lib/supabase'
import type { Database } from '../types/database'

export type TransactionRow    = Database['public']['Tables']['transactions']['Row']
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update']

export const transactionsApi = {
  async fetchByDate(userId: string, date: string): Promise<TransactionRow[]> {
    const { data, error } = await supabase.from('transactions').select('*').eq('user_id', userId).eq('date', date)
    if (error) throw error
    return data ?? []
  },
  async fetchByRange(userId: string, from: string, to: string): Promise<TransactionRow[]> {
    const { data, error } = await supabase.from('transactions').select('*').eq('user_id', userId).gte('date', from).lte('date', to).order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
  async create(payload: TransactionInsert): Promise<TransactionRow> {
    const { data, error } = await db.from('transactions').insert([payload]).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: TransactionUpdate): Promise<TransactionRow> {
    const { data, error } = await db.from('transactions').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
  }
}
