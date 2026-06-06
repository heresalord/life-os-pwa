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
