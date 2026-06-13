/**
 * localFirst.ts
 *
 * Utility for the Dexie-first / local-first data pattern used throughout Life OS.
 *
 * Pattern for queries:
 *   1. Read from Dexie immediately (< 5 ms, no network).
 *   2. Fire a background Supabase sync via bgSync().
 *   3. When Supabase responds, write to Dexie and call queryClient.setQueryData()
 *      to update the React Query cache — the UI re-renders silently with fresh data.
 *
 * Pattern for mutations:
 *   mutationFn writes to Dexie + calls enqueueSync() only.
 *   The sync engine (syncQueue) handles pushing to Supabase in the background.
 *   Never await Supabase inside a mutationFn hot path.
 */

import { db } from '../db'

// Tracks in-progress background syncs by key to prevent duplicate concurrent requests.
const inFlightSyncs = new Set<string>()

/**
 * Fire `fn` in the background without blocking the caller.
 * If a sync for the same `key` is already in flight, the call is silently dropped.
 */
export function bgSync(key: string, fn: () => Promise<void>): void {
  if (inFlightSyncs.has(key)) return
  inFlightSyncs.add(key)
  fn()
    .catch(err => console.warn('[bgSync] failed:', key, err))
    .finally(() => inFlightSyncs.delete(key))
}

/**
 * Reconcile freshly-fetched server rows with operations still sitting in the
 * local sync queue for `table`.
 *
 * Without this, a bgSync response that lands before a pending insert/update/
 * delete has been pushed to Supabase will blow away the local-only change
 * when it overwrites Dexie + the React Query cache:
 *
 *  - A row just INSERTED locally (e.g. a new wallet) is missing from the
 *    server response, so it would silently disappear from the UI.
 *  - A row just DELETED locally (e.g. a transaction) is still present in the
 *    server response, so it would reappear in the UI — and if it's deleted
 *    again from there, dependent state (like a wallet balance) gets
 *    adjusted a second time.
 *  - A row just UPDATED locally would briefly revert to its pre-update
 *    server value.
 *
 * This merges in-flight local writes on top of the server data so the cache
 * always reflects the latest known state until the queue item syncs.
 */
export async function reconcilePendingSync<T extends { id: string }>(
  table: string,
  serverRows: T[]
): Promise<T[]> {
  const pending = await db.sync_queue
    .orderBy('created_at')
    .filter(item => !item.synced && item.table === table)
    .toArray()

  if (pending.length === 0) return serverRows

  const byId = new Map(serverRows.map(row => [row.id, row]))

  // Apply queued operations in order so the most recent local write wins.
  for (const item of pending) {
    const payload = item.payload as Partial<T> & { id: string }
    if (item.operation === 'delete') {
      byId.delete(payload.id)
    } else if (item.operation === 'insert') {
      // A brand-new local row — include it even if the server hasn't seen it yet.
      byId.set(payload.id, { ...(byId.get(payload.id) ?? {}), ...payload } as T)
    } else {
      // 'update': only patch rows that are already part of this result set.
      // If the row isn't here, the server's filter (e.g. a different date,
      // or a status that no longer matches this view) may correctly exclude
      // it now, and re-adding it from a partial payload could put it in the
      // wrong list.
      const existing = byId.get(payload.id)
      if (existing) byId.set(payload.id, { ...existing, ...payload } as T)
    }
  }

  return Array.from(byId.values())
}
