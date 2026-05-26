import { supabase, db } from '../lib/supabase'
import type { Database } from '../types/database'

export type QuoteRow    = Database['public']['Tables']['quotes']['Row']
export type QuoteInsert = Database['public']['Tables']['quotes']['Insert']
export type QuoteUpdate = Database['public']['Tables']['quotes']['Update']

export const quotesApi = {
  async fetchByBook(bookId: string): Promise<QuoteRow[]> {
    const { data, error } = await supabase.from('quotes').select('*').eq('book_id', bookId)
    if (error) throw error
    return data ?? []
  },
  async fetchAll(userId: string): Promise<QuoteRow[]> {
    const { data, error } = await supabase.from('quotes').select('*').eq('user_id', userId)
    if (error) throw error
    return data ?? []
  },
  async create(payload: QuoteInsert): Promise<QuoteRow> {
    const { data, error } = await db.from('quotes').insert([payload]).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: QuoteUpdate): Promise<QuoteRow> {
    const { data, error } = await db.from('quotes').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('quotes').delete().eq('id', id)
    if (error) throw error
  }
}
