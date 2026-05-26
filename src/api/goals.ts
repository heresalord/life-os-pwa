import { supabase, db } from '../lib/supabase'
import type { Database } from '../types/database'

export type GoalRow    = Database['public']['Tables']['goals']['Row']
export type GoalInsert = Database['public']['Tables']['goals']['Insert']
export type GoalUpdate = Database['public']['Tables']['goals']['Update']

export const goalsApi = {
  async fetchByState(userId: string, state: string): Promise<GoalRow[]> {
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId).eq('state', state)
    if (error) throw error
    return data ?? []
  },
  async fetchAll(userId: string): Promise<GoalRow[]> {
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId)
    if (error) throw error
    return data ?? []
  },
  async create(payload: GoalInsert): Promise<GoalRow> {
    const { data, error } = await db.from('goals').insert([payload]).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: GoalUpdate): Promise<GoalRow> {
    const { data, error } = await db.from('goals').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) throw error
  }
}
