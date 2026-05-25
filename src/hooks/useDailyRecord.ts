
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'

export function useDailyRecord(date: string) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['daily_records', date],
    enabled: !!user,
    queryFn: async () => {
      const local = await db.daily_records.where('date').equals(date).first()
      if (local) return local
      const { data } = await supabase.from('daily_records').select('*').eq('date', date).eq('user_id', user!.id).maybeSingle()
      if (data) await db.daily_records.put(data)
      return data
    }
  })

  const upsert = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!user) return
      const existing = await db.daily_records.where('date').equals(date).first()
      const record = {
        ...(existing ?? {}),
        ...payload,
        id: existing?.id ?? crypto.randomUUID(),
        user_id: user.id,
        date,
        updated_at: new Date().toISOString(),
      }
      await db.daily_records.put(record as any)
      await enqueueSync('daily_records', existing ? 'update' : 'insert', record)
      return record
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily_records', date] })
  })

  return { ...query, upsert }
}
