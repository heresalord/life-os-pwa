import { db } from '../db'
import { supabase } from './supabase'
import { useSyncStore } from '../store/useSyncStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as any

let isSyncing = false

export const processSyncQueue = async () => {
  if (isSyncing || !navigator.onLine) return
  isSyncing = true
  useSyncStore.getState().setIsSyncing(true)

  try {
    const queue = await db.sync_queue.orderBy('created_at').filter(item => !item.synced).toArray()
    useSyncStore.getState().setPendingCount(queue.length)

    for (const item of queue) {
      if (item.retries >= 5) continue

      let success = false
      try {
        if (item.operation === 'insert') {
          const { error } = await supabaseAny.from(item.table).insert([item.payload])
          if (!error) success = true
        } else if (item.operation === 'update') {
          const { error } = await supabaseAny.from(item.table).update(item.payload).eq('id', item.payload.id)
          if (!error) success = true
        } else if (item.operation === 'delete') {
          const { error } = await supabaseAny.from(item.table).delete().eq('id', item.payload.id)
          if (!error) success = true
        }
      } catch (err) {
        console.error('Sync error:', err)
      }

      if (success) {
        await db.sync_queue.delete(item.id)
      } else {
        await db.sync_queue.update(item.id, { retries: item.retries + 1 })
      }
    }

    const remaining = await db.sync_queue.where('synced').equals(0).count()
    useSyncStore.getState().setPendingCount(remaining)

  } finally {
    isSyncing = false
    useSyncStore.getState().setIsSyncing(false)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('lifeos-sync-trigger', () => {
    processSyncQueue()
  })
}
