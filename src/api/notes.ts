import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type NoteRow    = Database['public']['Tables']['notes']['Row']
export type NoteInsert = Database['public']['Tables']['notes']['Insert']
export type NoteUpdate = Database['public']['Tables']['notes']['Update']

export const notesApi = {
  async fetchByDate(userId: string, date: string): Promise<NoteRow[]> {
    const { data, error } = await supabase.from('notes').select('*').eq('user_id', userId).eq('date', date)
    if (error) throw error
    return data ?? []
  },
  async fetchAll(userId: string): Promise<NoteRow[]> {
    const { data, error } = await supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
  async create(payload: NoteInsert): Promise<NoteRow> {
    const { data, error } = await supabase.from('notes').insert([payload]).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: NoteUpdate): Promise<NoteRow> {
    const { data, error } = await supabase.from('notes').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) throw error
  }
}
