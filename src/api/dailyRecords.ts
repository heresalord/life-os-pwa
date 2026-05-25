import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type DailyrecordsRow = Database['public']['Tables']['daily_records']['Row']
export type DailyrecordsInsert = Database['public']['Tables']['daily_records']['Insert']
export type DailyrecordsUpdate = Database['public']['Tables']['daily_records']['Update']

export const dailyRecordsApi = {
  async fetchAll() {
    const { data, error } = await supabase.from('daily_records').select('*')
    if (error) throw error
    return data
  },
  async fetchById(id: string) {
    const { data, error } = await supabase.from('daily_records').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async create(payload: DailyrecordsInsert) {
    const { data, error } = await supabase.from('daily_records').insert(payload).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: DailyrecordsUpdate) {
    const { data, error } = await supabase.from('daily_records').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string) {
    const { error } = await supabase.from('daily_records').delete().eq('id', id)
    if (error) throw error
  }
}
