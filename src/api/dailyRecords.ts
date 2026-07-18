import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type DailyRecordRow    = Database['public']['Tables']['daily_records']['Row']
export type DailyRecordInsert = Database['public']['Tables']['daily_records']['Insert']
export type DailyRecordUpdate = Database['public']['Tables']['daily_records']['Update']

export const dailyRecordsApi = {
  async fetchByDate(userId: string, date: string): Promise<DailyRecordRow | null> {
    const { data, error } = await supabase.from('daily_records').select('*').eq('user_id', userId).eq('date', date).maybeSingle()
    if (error) throw error
    return data
  },
  async upsert(payload: DailyRecordInsert): Promise<DailyRecordRow> {
    const { data, error } = await supabase.from('daily_records').upsert(payload, { onConflict: 'user_id,date' }).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: DailyRecordUpdate): Promise<DailyRecordRow> {
    const { data, error } = await supabase.from('daily_records').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  }
}
