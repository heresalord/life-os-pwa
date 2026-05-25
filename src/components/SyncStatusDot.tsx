import { useSyncStore } from '../store/useSyncStore'
import clsx from 'clsx'

export function SyncStatusDot() {
  const { isOnline, isSyncing, pendingCount } = useSyncStore()

  let colorClass = 'bg-gray-500' // Offline
  let title = 'Offline'

  if (isOnline) {
    if (isSyncing) {
      colorClass = 'bg-yellow-500 animate-pulse'
      title = 'Syncing...'
    } else if (pendingCount > 0) {
      colorClass = 'bg-yellow-500'
      title = `${pendingCount} items pending sync`
    } else {
      colorClass = 'bg-green-500'
      title = 'Synced'
    }
  }

  return (
    <div 
      className={clsx("w-2 h-2 rounded-full", colorClass)} 
      title={title}
      aria-label={title}
    />
  )
}
