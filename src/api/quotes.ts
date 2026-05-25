import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type QuotesRow = Database['public']['Tables']['quotes']['Row']
export type QuotesInsert = Database['public']['Tables']['quotes']['Insert']
export type QuotesUpdate = Database['public']['Tables']['quotes']['Update']

export const quotesApi = {
  async fetchAll() {
    const { data, error } = await supabase.from('quotes').select('*')
    if (error) throw error
    return data
  },
  async fetchById(id: string) {
    const { data, error } = await supabase.from('quotes').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async create(payload: QuotesInsert) {
    const { data, error } = await supabase.from('quotes').insert(payload).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: QuotesUpdate) {
    const { data, error } = await supabase.from('quotes').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string) {
    const { error } = await supabase.from('quotes').delete().eq('id', id)
    if (error) throw error
  }
}
