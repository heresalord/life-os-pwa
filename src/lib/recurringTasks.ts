import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { supabase as supa } from './supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

const SEEDED_KEY = 'lifeos-recurring-seeded'

function shouldRunToday(repeat: string, dayOfWeek?: number): boolean {
  const today = new Date().getDay() // 0=Sun, 6=Sat
  if (repeat === 'daily')    return true
  if (repeat === 'weekdays') return today >= 1 && today <= 5
  if (repeat === 'weekends') return today === 0 || today === 6
  if (repeat === 'weekly')   return dayOfWeek === today
  return false
}

export async function seedRecurringTasks(userId: string, date: string) {
  // Only seed once per day per user
  const key = `${SEEDED_KEY}-${userId}-${date}`
  if (sessionStorage.getItem(key)) return
  sessionStorage.setItem(key, '1')

  const templates = await db.recurring_tasks
    .where('user_id').equals(userId)
    .filter(t => t.active)
    .toArray()

  if (!templates.length) return

  // Get today's existing tasks to avoid duplicates
  const todayTasks = await db.tasks.where('date').equals(date).toArray()
  const existingTitles = new Set(todayTasks.map(t => t.title.toLowerCase()))

  for (const template of templates) {
    if (!shouldRunToday(template.repeat, template.day_of_week)) continue
    if (existingTitles.has(template.title.toLowerCase())) continue

    const task = {
      id: crypto.randomUUID(),
      user_id: userId,
      date,
      title: template.title,
      completed: false,
      skipped: false,
      priority: template.priority,
      completed_at: null,
      skipped_at: null,
      carried_from: null,
      from_inbox_id: null,
      created_at: new Date().toISOString(),
    }

    await db.tasks.add(task as Parameters<typeof db.tasks.add>[0])
    if (navigator.onLine) {
      const { error } = await sbAny.from('tasks').insert([task])
      if (error) await enqueueSync('tasks', 'insert', task)
    } else {
      await enqueueSync('tasks', 'insert', task)
    }
  }
}
