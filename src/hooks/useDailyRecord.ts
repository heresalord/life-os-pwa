import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useDb } from '../db/DbContext'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { bgSync } from '../lib/localFirst'
import { queryClient } from '../lib/queryClient'
import { QK } from '../lib/queryKeys'
import { calculateDayScore } from '../lib/scoreUtils'

export function useDailyRecord(date: string) {
  const db = useDb()
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: QK.dailyRecord(date, user?.id ?? ''),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const local = (await db.daily_records.where('date').equals(date).first()) ?? null

      if (navigator.onLine) {
        bgSync(`daily_record-${date}-${user!.id}`, async () => {
          const { data, error } = await supabase
            .from('daily_records').select('*')
            .eq('user_id', user!.id).eq('date', date)
            .maybeSingle()
          if (error) throw error
          if (data) {
            await db.daily_records.put(data as Parameters<typeof db.daily_records.put>[0])
            queryClient.setQueryData(QK.dailyRecord(date, user!.id), data)
          }
        })
      }

      return local
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
      await enqueueSync('daily_records', existing ? 'update' : 'insert', record)
      return record
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.dailyRecord(date, user?.id ?? '') })
  })

  return { ...query, upsert }
}
