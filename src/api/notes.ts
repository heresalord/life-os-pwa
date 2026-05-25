import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type NotesRow = Database['public']['Tables']['notes']['Row']
export type NotesInsert = Database['public']['Tables']['notes']['Insert']
export type NotesUpdate = Database['public']['Tables']['notes']['Update']

export const notesApi = {
  async fetchAll() {
    const { data, error } = await supabase.from('notes').select('*')
    if (error) throw error
    return data
  },
  async fetchById(id: string) {
    const { data, error } = await supabase.from('notes').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async create(payload: NotesInsert) {
    const { data, error } = await supabase.from('notes').insert(payload).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: NotesUpdate) {
    const { data, error } = await supabase.from('notes').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string) {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) throw error
  }
}
