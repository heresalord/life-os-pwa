import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type BooksRow = Database['public']['Tables']['books']['Row']
export type BooksInsert = Database['public']['Tables']['books']['Insert']
export type BooksUpdate = Database['public']['Tables']['books']['Update']

export const booksApi = {
  async fetchAll() {
    const { data, error } = await supabase.from('books').select('*')
    if (error) throw error
    return data
  },
  async fetchById(id: string) {
    const { data, error } = await supabase.from('books').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async create(payload: BooksInsert) {
    const { data, error } = await supabase.from('books').insert(payload).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: BooksUpdate) {
    const { data, error } = await supabase.from('books').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string) {
    const { error } = await supabase.from('books').delete().eq('id', id)
    if (error) throw error
  }
}
