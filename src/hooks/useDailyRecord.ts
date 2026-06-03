import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
import { calculateDayScore } from '../lib/scoreUtils'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supa as any

export function useDailyRecord(date: string) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['daily_records', date, user?.id],
    enabled: !!user,
    staleTime: 0,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('daily_records').select('*')
          .eq('user_id', user!.id).eq('date', date)
          .maybeSingle()
        if (error) throw error
        if (data) await db.daily_records.put(data as Parameters<typeof db.daily_records.put>[0])
        return data
      }
      return db.daily_records.where('date').equals(date).first()
    }
  })

  const upsert = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!user) return
      const existing = await db.daily_records.where('date').equals(date).first()
      const tasks = await db.tasks.where('date').equals(date).toArray()
      
      const mood = payload.mood !== undefined ? (payload.mood as number | null) : (existing?.mood ?? null)
      const energy_am = payload.energy_am !== undefined ? (payload.energy_am as number | null) : (existing?.energy_am ?? null)
      const energy_pm = payload.energy_pm !== undefined ? (payload.energy_pm as number | null) : (existing?.energy_pm ?? null)
      const score = calculateDayScore(tasks, mood, energy_am, energy_pm)

      const record = {
        ...(existing ?? {}),
        ...payload,
        id: existing?.id ?? crypto.randomUUID(),
        user_id: user.id,
        date,
        day_score: score,
        updated_at: new Date().toISOString(),
        created_at: existing?.created_at ?? new Date().toISOString(),
      }
      await db.daily_records.put(record as Parameters<typeof db.daily_records.put>[0])

      if (navigator.onLine) {
        const { error } = await sbAny.from('daily_records')
          .upsert(record, { onConflict: 'user_id,date' })
        if (error) await enqueueSync('daily_records', existing ? 'update' : 'insert', record)
      } else {
        await enqueueSync('daily_records', existing ? 'update' : 'insert', record)
      }
      return record
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily_records', date, user?.id] })
  })

  return { ...query, upsert }
}
