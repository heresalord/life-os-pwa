import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type UsersettingsRow = Database['public']['Tables']['user_settings']['Row']
export type UsersettingsInsert = Database['public']['Tables']['user_settings']['Insert']
export type UsersettingsUpdate = Database['public']['Tables']['user_settings']['Update']

export const userSettingsApi = {
  async fetchAll() {
    const { data, error } = await supabase.from('user_settings').select('*')
    if (error) throw error
    return data
  },
  async fetchById(id: string) {
    const { data, error } = await supabase.from('user_settings').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async create(payload: UsersettingsInsert) {
    const { data, error } = await supabase.from('user_settings').insert(payload).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: UsersettingsUpdate) {
    const { data, error } = await supabase.from('user_settings').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string) {
    const { error } = await supabase.from('user_settings').delete().eq('id', id)
    if (error) throw error
  }
}
