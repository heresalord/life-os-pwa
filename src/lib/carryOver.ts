import type { LifeOSDatabase } from '../db'
import { enqueueSync } from '../db/syncQueue'

export async function carryOverTasks(db: LifeOSDatabase, userId: string, fromDate: string, toDate: string) {
  const localTasks = await db.tasks
    .where('date').equals(fromDate)
    .filter(t => !t.completed && !t.skipped && t.user_id === userId)
    .toArray()

  if (localTasks.length === 0) return 0

  const existingToTasks = await db.tasks.where('date').equals(toDate).toArray()

  let carriedCount = 0

  for (const task of localTasks) {
    const alreadyCarried = existingToTasks.some(
      t => t.title === task.title &&
        (t.carried_from === task.date || t.carried_from === task.carried_from)
    )
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
      carried_from: task.carried_from || task.date,
      from_inbox_id: task.from_inbox_id,
      created_at: new Date().toISOString()
    }

    await db.tasks.add(newTask as Parameters<LifeOSDatabase['tasks']['add']>[0])
    await enqueueSync('tasks', 'insert', newTask)
    carriedCount++
  }

  return carriedCount
}
