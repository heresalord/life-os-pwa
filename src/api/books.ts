import { supabase, db } from '../lib/supabase'
import type { Database } from '../types/database'

export type BookRow    = Database['public']['Tables']['books']['Row']
export type BookInsert = Database['public']['Tables']['books']['Insert']
export type BookUpdate = Database['public']['Tables']['books']['Update']

export const booksApi = {
  async fetchAll(userId: string): Promise<BookRow[]> {
    const { data, error } = await supabase.from('books').select('*').eq('user_id', userId)
    if (error) throw error
    return data ?? []
  },
  async fetchByStatus(userId: string, status: string): Promise<BookRow[]> {
    const { data, error } = await supabase.from('books').select('*').eq('user_id', userId).eq('status', status)
    if (error) throw error
    return data ?? []
  },
  async create(payload: BookInsert): Promise<BookRow> {
    const { data, error } = await db.from('books').insert([payload]).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: BookUpdate): Promise<BookRow> {
    const { data, error } = await db.from('books').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('books').delete().eq('id', id)
    if (error) throw error
  }
}
