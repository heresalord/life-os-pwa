import { useSyncStore } from '../store/useSyncStore'
import { hasPendingSync } from '../lib/sync'

/** True whenever there's something worth surfacing — offline or a pending/syncing change.
 *  False in the steady-state "all synced" case, so callers can skip rendering the dot entirely. */
export function useHasSyncIssue() {
  const { isOnline, isSyncing, pendingCount } = useSyncStore()
  const actualPending = pendingCount > 0 ? pendingCount : (hasPendingSync() ? 1 : 0)
  return !isOnline || isSyncing || actualPending > 0
}
