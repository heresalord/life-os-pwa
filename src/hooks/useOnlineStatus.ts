import { useState, useEffect } from 'react'
import { useSyncStore } from '../store/useSyncStore'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const setOnlineStatus = useSyncStore(state => state.setOnlineStatus)

  useEffect(() => {
    setOnlineStatus(navigator.onLine)
    
    const handleOnline = () => {
      setIsOnline(true)
      setOnlineStatus(true)
      // Trigger sync when back online
      window.dispatchEvent(new CustomEvent('lifeos-sync-trigger'))
    }
    const handleOffline = () => {
      setIsOnline(false)
      setOnlineStatus(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnlineStatus])

  return isOnline
}
