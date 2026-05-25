import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type AgendablocksRow = Database['public']['Tables']['agenda_blocks']['Row']
export type AgendablocksInsert = Database['public']['Tables']['agenda_blocks']['Insert']
export type AgendablocksUpdate = Database['public']['Tables']['agenda_blocks']['Update']

export const agendaBlocksApi = {
  async fetchAll() {
    const { data, error } = await supabase.from('agenda_blocks').select('*')
    if (error) throw error
    return data
  },
  async fetchById(id: string) {
    const { data, error } = await supabase.from('agenda_blocks').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async create(payload: AgendablocksInsert) {
    const { data, error } = await supabase.from('agenda_blocks').insert(payload).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: AgendablocksUpdate) {
    const { data, error } = await supabase.from('agenda_blocks').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string) {
    const { error } = await supabase.from('agenda_blocks').delete().eq('id', id)
    if (error) throw error
  }
}
