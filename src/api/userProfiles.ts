import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type UserProfileRow    = Database['public']['Tables']['user_profiles']['Row']
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']

export const userProfilesApi = {
  async fetchById(id: string): Promise<UserProfileRow | null> {
    const { data, error } = await supabase.from('user_profiles').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  },
  async update(id: string, payload: UserProfileUpdate): Promise<UserProfileRow> {
    const { data, error } = await supabase.from('user_profiles').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  }
}
