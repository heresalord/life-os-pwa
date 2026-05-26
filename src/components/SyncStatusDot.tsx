import { WifiOff, RefreshCw, CheckCheck } from 'lucide-react'
import { useSyncStore } from '../store/useSyncStore'
import { processSyncQueue } from '../lib/sync'
import { useState } from 'react'

export function SyncStatusDot() {
  const { isOnline, isSyncing, pendingCount } = useSyncStore()
  const [showTip, setShowTip] = useState(false)

  const handleClick = () => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      processSyncQueue()
    }
    setShowTip(v => !v)
    setTimeout(() => setShowTip(false), 2500)
  }

  const state = !isOnline
    ? { icon: WifiOff, color: 'text-text-muted', label: 'Offline — changes saved locally' }
    : isSyncing
    ? { icon: RefreshCw, color: 'text-warning', label: 'Syncing…' }
    : pendingCount > 0
    ? { icon: RefreshCw, color: 'text-warning', label: `${pendingCount} change${pendingCount > 1 ? 's' : ''} waiting — tap to sync` }
    : { icon: CheckCheck, color: 'text-success', label: 'All changes saved' }

  const Icon = state.icon

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        aria-label={state.label}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors ${state.color}`}
      >
        <Icon size={14} className={isSyncing ? 'animate-spin' : ''} />
        {pendingCount > 0 && isOnline && (
          <span className="text-[10px] font-medium tabular-nums">{pendingCount}</span>
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
