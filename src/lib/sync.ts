import { supabase } from './supabase'
import { db } from '../db'
import { useSyncStore } from '../store/useSyncStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supa = supabase as any

let isSyncing = false
let intervalId: ReturnType<typeof setInterval> | null = null

export const processSyncQueue = async () => {
  if (isSyncing || !navigator.onLine) return
  isSyncing = true
  useSyncStore.getState().setIsSyncing(true)

  try {
    const queue = await db.sync_queue
      .orderBy('created_at')
      .filter(item => !item.synced)
      .toArray()

    useSyncStore.getState().setPendingCount(queue.length)
    if (queue.length === 0) return

    for (const item of queue) {
      if (item.retries >= 5) continue

      let success = false
      try {
        if (item.operation === 'insert') {
          const { error } = await supa.from(item.table).upsert([item.payload], { onConflict: 'id', ignoreDuplicates: false })
          if (!error) success = true
        } else if (item.operation === 'update') {
          const { error } = await supa.from(item.table).update(item.payload).eq('id', item.payload.id)
          if (!error) success = true
        } else if (item.operation === 'delete') {
          const { error } = await supa.from(item.table).delete().eq('id', item.payload.id)
          if (!error) success = true
        }
      } catch (err) {
        console.warn('[sync] error:', err)
      }

      if (success) {
        await db.sync_queue.delete(item.id)
      } else {
        await db.sync_queue.update(item.id, { retries: (item.retries || 0) + 1 })
      }
    }

    const remaining = await db.sync_queue.filter(i => !i.synced).count()
    useSyncStore.getState().setPendingCount(remaining)
  } finally {
    isSyncing = false
    useSyncStore.getState().setIsSyncing(false)
  }
}

// Start polling every 30s + react to online event
export const startSyncEngine = () => {
  if (intervalId) return // already running

  // Sync immediately on start
  processSyncQueue()

  // Then every 30 seconds
  intervalId = setInterval(() => {
    if (navigator.onLine) processSyncQueue()
  }, 30_000)

  // Sync immediately when coming back online
  window.addEventListener('online', () => {
    useSyncStore.getState().setOnlineStatus(true)
    processSyncQueue()
  })
  window.addEventListener('offline', () => {
    useSyncStore.getState().setOnlineStatus(false)
  })

  // Sync on custom trigger (after a write)
  window.addEventListener('lifeos-sync-trigger', () => {
    if (navigator.onLine) processSyncQueue()
  })
}

export const stopSyncEngine = () => {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
