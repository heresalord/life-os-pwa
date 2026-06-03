import { db } from '../db'
import { supabase } from './supabase'
import { enqueueSync } from '../db/syncQueue'

export function calculateDayScore(
  tasks: { completed: boolean; skipped: boolean }[],
  mood: number | null,
  energy_am: number | null,
  energy_pm: number | null
): number {
  // 1. Task Completion Rate
  const activeTasks = tasks.filter(t => !t.skipped);
  const completedCount = activeTasks.filter(t => t.completed).length;
  const taskPct = activeTasks.length > 0 ? (completedCount / activeTasks.length) * 100 : 100;

  // 2. Mood (1-5) -> 0-100
  const moodScore = mood !== null && mood !== undefined ? (mood - 1) * 25 : 50;

  // 3. Energy (1-5) -> 0-100
  let avgEnergy = 3;
  if (energy_am !== null && energy_pm !== null) {
    avgEnergy = (energy_am + energy_pm) / 2;
  } else if (energy_am !== null) {
    avgEnergy = energy_am;
  } else if (energy_pm !== null) {
    avgEnergy = energy_pm;
  }
  const energyScore = (avgEnergy - 1) * 25;

  return Math.round((taskPct + moodScore + energyScore) / 3);
}

const sbAny = supabase as any

export async function syncDayScore(userId: string, date: string) {
  try {
    const tasks = await db.tasks.where('date').equals(date).toArray();
    const record = await db.daily_records
      .where('date')
      .equals(date)
      .filter(r => r.user_id === userId)
      .first();
    if (!record) return null;

    const score = calculateDayScore(tasks, record.mood, record.energy_am, record.energy_pm);

    if (record.day_score !== score) {
      const updatedRecord = {
        ...record,
        day_score: score,
        updated_at: new Date().toISOString()
      };
      await db.daily_records.put(updatedRecord as Parameters<typeof db.daily_records.put>[0]);

      if (navigator.onLine) {
        const { error } = await sbAny
          .from('daily_records')
          .upsert(updatedRecord, { onConflict: 'user_id,date' });
        if (error) {
          await enqueueSync('daily_records', 'update', updatedRecord);
        }
      } else {
        await enqueueSync('daily_records', 'update', updatedRecord);
      }
      return score;
    }
    return record.day_score;
  } catch (err) {
    console.error('Failed to sync day score:', err);
    return null;
  }
}
