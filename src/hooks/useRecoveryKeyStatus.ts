import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { isUserRecoveryKeyVerified } from '../lib/recoveryKey'

export function useRecoveryKeyStatus() {
  const { user } = useAuth()
  const [isVerified, setIsVerified] = useState<boolean>(() => isUserRecoveryKeyVerified(user?.id))

  const checkStatus = useCallback(() => {
    if (!user) {
      setIsVerified(true)
      return
    }
    setIsVerified(isUserRecoveryKeyVerified(user.id))
  }, [user])

  useEffect(() => {
    checkStatus()

    // Listen to storage events or custom verification events
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('life_os_recovery_')) {
        checkStatus()
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('recovery-key-updated', checkStatus)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('recovery-key-updated', checkStatus)
    }
  }, [checkStatus])

  return {
    isVerified,
    refreshStatus: checkStatus,
  }
}
