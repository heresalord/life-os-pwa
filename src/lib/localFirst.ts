/**
 * localFirst.ts — local-first query utilities
 *
 * bgSync: fire a background Supabase fetch without blocking the caller.
 *   Used by every query hook: serve local Dexie data instantly, then
 *   silently refresh from Supabase in the background.
 *
 * reconcilePendingSync: merge fresh server rows with any writes that are
 *   still sitting in the offline queue (localStorage). Without this,
 *   a background sync could:
 *     - reinsert a row the user just deleted locally (server still has it)
 *     - overwrite a row the user just updated locally (server has old version)
 *     - make a newly-inserted row disappear (server hasn't seen it yet)
 *
 *   Phase 3 change: previously read the sync_queue Dexie table. Now reads
 *   the offline queue from localStorage (written by syncToSupabase in sync.ts).
 *   Function signature and behaviour are identical — all query hook call sites
 *   are unchanged.
 */

import { getQueuedItemsForTable } from './sync'

// Tracks in-progress background syncs by key to prevent duplicate concurrent requests.
const inFlightSyncs = new Set<string>()

/**
 * Fire `fn` in the background without blocking the caller.
 * Drops duplicate concurrent syncs for the same key.
 */
export function bgSync(key: string, fn: () => Promise<void>): void {
  if (inFlightSyncs.has(key)) return
  inFlightSyncs.add(key)
  fn()
    .catch(err => console.warn('[bgSync] failed:', key, err))
    .finally(() => inFlightSyncs.delete(key))
}

/**
 * Reconcile freshly-fetched server rows with writes pending in the offline
 * queue for `table`.
 *
 * Reads the localStorage offline queue (phase 3 replacement for reading the
 * sync_queue Dexie table). Applies queued operations in chronological order
 * so the most recent local write always wins over the server response.
 *
 * @param _db   - Dexie database instance (accepted but unused — kept for
 *               backward compatibility with all query hook call sites).
 * @param table - Supabase / Dexie table name.
 * @param serverRows - Rows returned by the Supabase query.
 */
export async function reconcilePendingSync<T extends { id: string }>(
  _db:        unknown,
  table:      string,
  serverRows: T[]
): Promise<T[]> {
  const queued = getQueuedItemsForTable(table)
  if (queued.length === 0) return serverRows

  const byId = new Map(serverRows.map(row => [row.id, row]))

  // Apply queued operations in chronological order (oldest first) so the
  // most recent write wins.
  const sorted = [...queued].sort((a, b) => a.ts - b.ts)

  for (const item of sorted) {
    const payload = item.payload as Partial<T> & { id: string }

    if (item.op === 'delete') {
      // Row was deleted locally — don't let the server put it back.
      byId.delete(payload.id)

    } else if (item.op === 'insert') {
      // Row was inserted locally — include it even if the server hasn't
      // seen it yet (e.g., created while offline).
      byId.set(payload.id, {
        ...(byId.get(payload.id) ?? {}),
        ...payload,
      } as T)

    } else {
      // 'update' — patch the server row with local changes.
      // Only patch rows that are in the result set; if the row is absent from
      // the server response it may have been correctly filtered out (e.g. by
      // date or status), and patching from a partial payload could insert it
      // in the wrong list.
      const existing = byId.get(payload.id)
      if (existing) {
        byId.set(payload.id, { ...existing, ...payload } as T)
      }
    }
  }

  return Array.from(byId.values())
}
