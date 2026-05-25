import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type TasksRow = Database['public']['Tables']['tasks']['Row']
export type TasksInsert = Database['public']['Tables']['tasks']['Insert']
export type TasksUpdate = Database['public']['Tables']['tasks']['Update']

export const tasksApi = {
  async fetchAll() {
    const { data, error } = await supabase.from('tasks').select('*')
    if (error) throw error
    return data
  },
  async fetchById(id: string) {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async create(payload: TasksInsert) {
    const { data, error } = await supabase.from('tasks').insert(payload).select().single()
    if (error) throw error
    return data
  },
  async update(id: string, payload: TasksUpdate) {
    const { data, error } = await supabase.from('tasks').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async remove(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  }
}
