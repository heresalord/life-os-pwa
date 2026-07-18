import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type TaskRow    = Database['public']['Tables']['tasks']['Row']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']
export type TaskUpdate = Database['public']['Tables']['tasks']['Update']

export const tasksApi = {
  async fetchByDate(userId: string, date: string): Promise<TaskRow[]> {
    const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).eq('date', date)
    if (error) throw error
    return data ?? []
  },
  async fetchById(id: string): Promise<TaskRow> {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async create(payload: TaskInsert): Promise<TaskRow> {
    const { data, error } = await supabase.from('tasks').insert([payload]).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: TaskUpdate): Promise<TaskRow> {
    const { data, error } = await supabase.from('tasks').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  }
}
