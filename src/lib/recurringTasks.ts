import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { supabase as supa } from './supabase'
import type { RecurringTask } from '../db'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

const SEEDED_KEY = 'lifeos-recurring-seeded'

/**
 * Returns the ordinal occurrence of a given weekday in a month.
 * e.g. getNthWeekdayOfMonth(2026, 6, 1, 1) = first Monday of June 2026
 * Negative ordinal (-1) = last occurrence.
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, ordinal: number): number | null {
  if (ordinal > 0) {
    let count = 0
    for (let day = 1; day <= 31; day++) {
      const d = new Date(year, month, day)
      if (d.getMonth() !== month) break
      if (d.getDay() === weekday) {
        count++
        if (count === ordinal) return day
      }
    }
  } else {
    // last occurrence
    for (let day = 31; day >= 1; day--) {
      const d = new Date(year, month, day)
      if (d.getMonth() !== month) continue
      if (d.getDay() === weekday) return day
    }
  }
  return null
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function shouldRunOn(template: RecurringTask, dateStr: string): boolean {
  const d     = new Date(dateStr + 'T00:00:00')
  const dow   = d.getDay()   // 0=Sun…6=Sat
  const dom   = d.getDate()  // 1-31
  const month = d.getMonth() // 0-11
  const year  = d.getFullYear()

  switch (template.repeat) {
    case 'daily':
      return true

    case 'weekdays':
      return dow >= 1 && dow <= 5

    case 'weekends':
      return dow === 0 || dow === 6

    case 'weekly': {
      // Support legacy single day_of_week and new multi-day `days` array
      const days = template.days?.length
        ? template.days
        : template.day_of_week !== undefined ? [template.day_of_week] : []
      return days.includes(dow)
    }

    case 'monthly': {
      const target = template.day_of_month ?? 1
      if (target === -1) return dom === getLastDayOfMonth(year, month)
      return dom === target
    }

    case 'monthly_ordinal': {
      if (template.ordinal === undefined || template.weekday === undefined) return false
      const targetDay = getNthWeekdayOfMonth(year, month, template.weekday, template.ordinal)
      return dom === targetDay
    }

    default:
      return false
  }
}

export async function seedRecurringTasks(userId: string, date: string) {
  // Only seed once per day per user per session
  const key = `${SEEDED_KEY}-${userId}-${date}`
  if (sessionStorage.getItem(key)) return
  sessionStorage.setItem(key, '1')

  const templates = await db.recurring_tasks
    .where('user_id').equals(userId)
    .filter(t => t.active)
    .toArray()

  if (!templates.length) return

  const todayTasks = await db.tasks.where('date').equals(date).toArray()
  const existingTitles = new Set(todayTasks.map(t => t.title.toLowerCase()))

  for (const template of templates) {
    if (!shouldRunOn(template, date)) continue
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
      due_date: null,
      description: null,
      tags: [],
      subtasks: [],
      kanban_status: 'todo',
      project_id: null,
      time_block_start: null,
      time_block_end: null,
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
