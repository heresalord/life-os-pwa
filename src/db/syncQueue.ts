import { db } from './index'
import type { SyncQueueItem } from './schema'

export const enqueueSync = async (
  table: string, 
  operation: 'insert' | 'update' | 'delete', 
  payload: any
) => {
  const item: SyncQueueItem = {
    id: crypto.randomUUID(),
    table,
    operation,
    payload,
    created_at: Date.now(),
    retries: 0,
    synced: false
  }
  await db.sync_queue.add(item)
  
  // Trigger background sync if possible
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lifeos-sync-trigger'))
  }
}
