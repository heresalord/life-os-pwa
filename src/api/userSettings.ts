import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type UserSettingsRow    = Database['public']['Tables']['user_settings']['Row']
export type UserSettingsInsert = Database['public']['Tables']['user_settings']['Insert']
export type UserSettingsUpdate = Database['public']['Tables']['user_settings']['Update']

export const userSettingsApi = {
  async fetchByUserId(userId: string): Promise<UserSettingsRow | null> {
    const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return data
  },
  async upsert(payload: UserSettingsInsert): Promise<UserSettingsRow> {
    const { data, error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' }).select().single()
    if (error) throw error
    return data
  },
  async update(userId: string, payload: UserSettingsUpdate): Promise<UserSettingsRow> {
    const { data, error } = await supabase.from('user_settings').update(payload).eq('user_id', userId).select().single()
    if (error) throw error
    return data
  }
}
