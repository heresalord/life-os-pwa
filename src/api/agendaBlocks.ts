import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type AgendaBlockRow    = Database['public']['Tables']['agenda_blocks']['Row']
export type AgendaBlockInsert = Database['public']['Tables']['agenda_blocks']['Insert']
export type AgendaBlockUpdate = Database['public']['Tables']['agenda_blocks']['Update']

export const agendaBlocksApi = {
  async fetchByDate(userId: string, date: string): Promise<AgendaBlockRow[]> {
    const { data, error } = await supabase.from('agenda_blocks').select('*').eq('user_id', userId).eq('date', date).order('start_time')
    if (error) throw error
    return data ?? []
  },
  async create(payload: AgendaBlockInsert): Promise<AgendaBlockRow> {
    const { data, error } = await supabase.from('agenda_blocks').insert([payload]).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: AgendaBlockUpdate): Promise<AgendaBlockRow> {
    const { data, error } = await supabase.from('agenda_blocks').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('agenda_blocks').delete().eq('id', id)
    if (error) throw error
  }
}
