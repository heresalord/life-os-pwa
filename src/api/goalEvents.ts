import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type GoaleventsRow = Database['public']['Tables']['goal_events']['Row']
export type GoaleventsInsert = Database['public']['Tables']['goal_events']['Insert']
export type GoaleventsUpdate = Database['public']['Tables']['goal_events']['Update']

export const goalEventsApi = {
  async fetchAll() {
    const { data, error } = await supabase.from('goal_events').select('*')
    if (error) throw error
    return data
  },
  async fetchById(id: string) {
    const { data, error } = await supabase.from('goal_events').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async create(payload: GoaleventsInsert) {
    const { data, error } = await supabase.from('goal_events').insert(payload).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: GoaleventsUpdate) {
    const { data, error } = await supabase.from('goal_events').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string) {
    const { error } = await supabase.from('goal_events').delete().eq('id', id)
    if (error) throw error
  }
}
