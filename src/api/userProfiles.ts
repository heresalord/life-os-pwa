import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type UserprofilesRow = Database['public']['Tables']['user_profiles']['Row']
export type UserprofilesInsert = Database['public']['Tables']['user_profiles']['Insert']
export type UserprofilesUpdate = Database['public']['Tables']['user_profiles']['Update']

export const userProfilesApi = {
  async fetchAll() {
    const { data, error } = await supabase.from('user_profiles').select('*')
    if (error) throw error
    return data
  },
  async fetchById(id: string) {
    const { data, error } = await supabase.from('user_profiles').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async create(payload: UserprofilesInsert) {
    const { data, error } = await supabase.from('user_profiles').insert(payload).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: UserprofilesUpdate) {
    const { data, error } = await supabase.from('user_profiles').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string) {
    const { error } = await supabase.from('user_profiles').delete().eq('id', id)
    if (error) throw error
  }
}
