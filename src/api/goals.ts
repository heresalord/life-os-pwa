import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type GoalsRow = Database['public']['Tables']['goals']['Row']
export type GoalsInsert = Database['public']['Tables']['goals']['Insert']
export type GoalsUpdate = Database['public']['Tables']['goals']['Update']

export const goalsApi = {
  async fetchAll() {
    const { data, error } = await supabase.from('goals').select('*')
    if (error) throw error
    return data
  },
  async fetchById(id: string) {
    const { data, error } = await supabase.from('goals').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async create(payload: GoalsInsert) {
    const { data, error } = await supabase.from('goals').insert(payload).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: GoalsUpdate) {
    const { data, error } = await supabase.from('goals').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string) {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) throw error
  }
}
