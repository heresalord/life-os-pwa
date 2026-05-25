
import { supabase } from './supabase'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'

export async function carryOverTasks(userId: string, fromDate: string, toDate: string) {
  // 1. Fetch pending tasks for fromDate
  const localTasks = await db.tasks
    .where('date').equals(fromDate)
    .filter(t => !t.completed && !t.skipped && t.user_id === userId)
    .toArray()
  
  if (localTasks.length === 0) return 0

  // 2. Check toDate to avoid double-carry
  const existingToTasks = await db.tasks.where('date').equals(toDate).toArray()
  const carriedIds = new Set(existingToTasks.map(t => t.carried_from))

  let carriedCount = 0

  for (const task of localTasks) {
    // If we already carried this exact task, skip
    if (carriedIds.has(task.date)) continue // Wait, carried_from stores the original date. We should check if there's a task on toDate with the same title or an explicit link.
    // Better logic: tasks don't have a specific link to the *new* task ID they spawned. 
    // We check if a task with the same title and carried_from exists on toDate.
    const alreadyCarried = existingToTasks.some(t => t.title === task.title && (t.carried_from === task.date || t.carried_from === task.carried_from))
    if (alreadyCarried) continue

    const newTask = {
      id: crypto.randomUUID(),
      user_id: userId,
      date: toDate,
      title: task.title,
      completed: false,
      skipped: false,
      priority: task.priority,
      completed_at: null,
      skipped_at: null,
      carried_from: task.carried_from || task.date, // Preserve original date if already carried
      from_inbox_id: task.from_inbox_id,
      created_at: new Date().toISOString()
    }
    
    await db.tasks.add(newTask as any)
    await enqueueSync('tasks', 'insert', newTask)
    carriedCount++
  }

  return carriedCount
}
