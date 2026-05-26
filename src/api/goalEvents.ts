import { supabase, db } from '../lib/supabase'
import type { Database } from '../types/database'

export type GoalEventRow    = Database['public']['Tables']['goal_events']['Row']
export type GoalEventInsert = Database['public']['Tables']['goal_events']['Insert']
export type GoalEventUpdate = Database['public']['Tables']['goal_events']['Update']

export const goalEventsApi = {
  async fetchByGoalIds(goalIds: string[]): Promise<GoalEventRow[]> {
    if (!goalIds.length) return []
    const { data, error } = await supabase.from('goal_events').select('*').in('goal_id', goalIds)
    if (error) throw error
    return data ?? []
  },
  async create(payload: GoalEventInsert): Promise<GoalEventRow> {
    const { data, error } = await db.from('goal_events').insert([payload]).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: GoalEventUpdate): Promise<GoalEventRow> {
    const { data, error } = await db.from('goal_events').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('goal_events').delete().eq('id', id)
    if (error) throw error
  }
}
