/**
 * syncQueue.ts — Phase 3 adapter
 *
 * `enqueueSync` is called by every mutation hook immediately after the local
 * Dexie write. Previously it inserted into the sync_queue Dexie table which
 * the background polling engine would drain. Now it pushes directly to
 * Supabase (online) or queues in localStorage (offline).
 *
 * All mutation hook call sites are unchanged — they still call enqueueSync
 * and the Dexie write before it still happens first. Only the mechanism
 * underneath has changed. The sync_queue Dexie table is no longer written to.
 */

import { syncToSupabase } from '../lib/sync'

export const enqueueSync = async (
  table:     string,
  operation: 'insert' | 'update' | 'delete',
  payload:   Record<string, unknown>
): Promise<void> => {
  // The local Dexie write has already happened by the time this is called.
  // Push to Supabase immediately (online) or queue to localStorage (offline).
  await syncToSupabase(table, operation, payload)
}
