import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'

/**
 * useContextualAdd - Listens for contextual add trigger increments
 * while the component is mounted. Does NOT fire on initial mount even if
 * the global trigger count is > 0 from previous actions.
 */
export function useContextualAdd(onTrigger: () => void) {
  const headerAddTrigger = useAppStore(s => s.headerAddTrigger)
  const initialTriggerRef = useRef(headerAddTrigger)
  const lastHandledRef = useRef(headerAddTrigger)

  useEffect(() => {
    // Only fire if trigger has incremented since this component mounted
    // and has not been handled yet.
    if (headerAddTrigger > initialTriggerRef.current && headerAddTrigger !== lastHandledRef.current) {
      lastHandledRef.current = headerAddTrigger
      onTrigger()
    }
  }, [headerAddTrigger, onTrigger])
}
