import { WifiOff, RefreshCw, CheckCheck } from 'lucide-react'
import { useSyncStore } from '../store/useSyncStore'
import { processSyncQueue, hasPendingSync } from '../lib/sync'
import { useState } from 'react'

/** True whenever there's something worth surfacing — offline or a pending/syncing change.
 *  False in the steady-state "all synced" case, so callers can skip rendering the dot entirely. */
export function useHasSyncIssue() {
  const { isOnline, isSyncing, pendingCount } = useSyncStore()
  const actualPending = pendingCount > 0 ? pendingCount : (hasPendingSync() ? 1 : 0)
  return !isOnline || isSyncing || actualPending > 0
}

export function SyncStatusDot() {
  const { isOnline, isSyncing, pendingCount } = useSyncStore()
  const [showTip, setShowTip] = useState(false)

  // Keep pendingCount in sync with localStorage queue on each render
  // (the store is updated by startSyncEngine/drainOfflineQueue but a manual
  // check here handles edge cases where the store count drifts)
  const actualPending = pendingCount > 0 ? pendingCount : (hasPendingSync() ? 1 : 0)

  const handleClick = () => {
    if (isOnline && actualPending > 0 && !isSyncing) {
      void processSyncQueue()
    }
    setShowTip(v => !v)
    setTimeout(() => setShowTip(false), 2500)
  }

  const state = !isOnline
    ? { icon: WifiOff,    color: 'text-text-muted', label: 'Offline — changes saved locally' }
    : isSyncing
    ? { icon: RefreshCw,  color: 'text-warning',    label: 'Syncing…' }
    : actualPending > 0
    ? { icon: RefreshCw,  color: 'text-warning',    label: `${actualPending} change${actualPending > 1 ? 's' : ''} pending — tap to sync` }
    : { icon: CheckCheck, color: 'text-success',    label: 'All changes saved' }

  const Icon = state.icon

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        aria-label={state.label}
        className={`flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors ${state.color}`}
      >
        <Icon size={14} className={isSyncing ? 'animate-spin' : ''} />
        {actualPending > 0 && isOnline && (
          <span className="text-[10px] font-medium tabular-nums">{actualPending}</span>
        )}
      </button>

      {showTip && (
        <div className="absolute right-0 top-9 z-50 whitespace-nowrap bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-secondary shadow-xl">
          {state.label}
          <div className="absolute -top-1.5 right-3 w-3 h-3 bg-surface border-l border-t border-border rotate-45" />
        </div>
      )}
    </div>
  )
}
