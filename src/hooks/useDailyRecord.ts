import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { supabase as supa } from '../lib/supabase'
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
      const record = {
        ...(existing ?? {}),
        ...payload,
        id: existing?.id ?? crypto.randomUUID(),
        user_id: user.id,
        date,
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
