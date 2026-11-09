import { useState, useEffect, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'

export interface DraftEnvelope {
  value: string
  baseUpdatedAt?: string | null
}

export interface UseDraftOptions {
  enabled?: boolean
  baseUpdatedAt?: string | null
}

export interface UseDraftMeta {
  isDirty: boolean
  hasDraft: boolean
  discardDraft: () => void
  reset: (newValue?: string) => void
}

/**
 * Helper to parse a draft from localStorage.
 * Handles both the new { value, baseUpdatedAt } envelope and legacy raw strings.
 */
function parseStoredDraft(
  key: string,
  initial: string,
  baseUpdatedAt?: string | null
): { value: string; hasDraft: boolean } {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return { value: initial, hasDraft: false }

    let parsedVal: string | null = null
    let parsedBase: string | null | undefined = undefined

    try {
      const obj = JSON.parse(raw)
      if (obj && typeof obj === 'object' && typeof obj.value === 'string') {
        parsedVal = obj.value
        parsedBase = obj.baseUpdatedAt
      }
    } catch {
      // Legacy raw string format
      parsedVal = raw
    }

    if (parsedVal === null) return { value: initial, hasDraft: false }

    // If caller provided baseUpdatedAt (e.g. note editing):
    // Stale draft check: draft is only offered if baseUpdatedAt matches exactly
    if (baseUpdatedAt !== undefined) {
      if (parsedBase !== baseUpdatedAt || !parsedVal.trim() || parsedVal === initial) {
        // Discard stale or redundant draft
        try { localStorage.removeItem(key) } catch { /* ignore */ }
        return { value: initial, hasDraft: false }
      }
      return { value: parsedVal, hasDraft: true }
    }

    // For non-versioned drafts (inbox capture, wizard inputs):
    if (parsedVal !== initial && parsedVal.trim()) {
      return { value: parsedVal, hasDraft: true }
    }

    return { value: initial, hasDraft: false }
  } catch {
    return { value: initial, hasDraft: false }
  }
}

/**
 * useDraft — persist in-progress text to localStorage so it survives
 * WebView reclaim, force-quit, and SW-triggered page reloads.
 *
 * Requirements (Phase 0.3):
 * 1. Stored as { value, baseUpdatedAt }.
 * 2. Only writes when user actually edited (isDirty flag). Backgrounding with no edits writes nothing.
 * 3. Keyed: resets internal value and isDirty flag on key change. Never writes note A's text under note B's key.
 * 4. Stale drafts are discarded on open if baseUpdatedAt !== note.updated_at.
 * 5. Returns tuple [value, setValue, clearDraft, meta] preserving backwards compatibility.
 */
export function useDraft(
  key: string,
  initial: string,
  options: UseDraftOptions = {}
): [string, (action: string | ((prev: string) => string)) => void, () => void, UseDraftMeta] {
  const { enabled = true, baseUpdatedAt } = options

  // Initial state derived from storage if valid
  const [{ value, hasDraft }, setState] = useState(() => {
    if (!enabled) return { value: initial, hasDraft: false }
    return parseStoredDraft(key, initial, baseUpdatedAt)
  })

  const [isDirty, setIsDirty] = useState(false)

  const valueRef = useRef(value)
  const isDirtyRef = useRef(isDirty)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enabledRef = useRef(enabled)
  const keyRef = useRef(key)
  const baseUpdatedAtRef = useRef(baseUpdatedAt)
  const initialRef = useRef(initial)

  useEffect(() => { valueRef.current = value }, [value])
  useEffect(() => { isDirtyRef.current = isDirty }, [isDirty])
  useEffect(() => { enabledRef.current = enabled }, [enabled])
  useEffect(() => { baseUpdatedAtRef.current = baseUpdatedAt }, [baseUpdatedAt])
  useEffect(() => { initialRef.current = initial }, [initial])

  // ── Flush helper — writes ONLY when dirty and enabled ────────────────────
  const flush = useCallback(() => {
    if (!enabledRef.current || !isDirtyRef.current) return
    try {
      const envelope: DraftEnvelope = {
        value: valueRef.current,
        baseUpdatedAt: baseUpdatedAtRef.current ?? null,
      }
      localStorage.setItem(keyRef.current, JSON.stringify(envelope))
    } catch {
      // Storage full or private mode — non-fatal
    }
  }, [])

  // ── Re-keying: reset state when key or baseUpdatedAt changes ────────────
  const prevKeyRef = useRef(key)
  const prevBaseRef = useRef(baseUpdatedAt)

  useEffect(() => {
    if (prevKeyRef.current !== key || prevBaseRef.current !== baseUpdatedAt) {
      // Key or note version changed
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      prevKeyRef.current = key
      prevBaseRef.current = baseUpdatedAt
      keyRef.current = key

      // Reset dirty flag
      setIsDirty(false)
      isDirtyRef.current = false

      if (!enabled) {
        setState({ value: initial, hasDraft: false })
      } else {
        const next = parseStoredDraft(key, initial, baseUpdatedAt)
        setState(next)
      }
    }
  }, [key, baseUpdatedAt, enabled, initial])

  // ── Debounced write on user edit ─────────────────────────────────────────
  const setValue = useCallback((action: string | ((prev: string) => string)) => {
    setIsDirty(true)
    isDirtyRef.current = true

    setState(prev => {
      const nextVal = typeof action === 'function' ? action(prev.value) : action
      valueRef.current = nextVal
      return { value: nextVal, hasDraft: true }
    })

    if (!enabledRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, 300)
  }, [flush])

  // ── Flush on page-hide / visibility-hidden ───────────────────────────────
  useEffect(() => {
    if (!enabled) return

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const onPageHide = () => flush()

    window.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      window.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [enabled, flush])

  // ── Flush on Capacitor app backgrounding ────────────────────────────────
  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return

    const listenerPromise = CapacitorApp.addListener(
      'appStateChange',
      ({ isActive }: { isActive: boolean }) => {
        if (!isActive) flush()
      }
    )

    return () => {
      listenerPromise.then((l: { remove: () => void }) => l.remove())
    }
  }, [enabled, flush])

  // ── Cleanup debounce timer on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // ── clearDraft — call after successful save ─────────────────────────────
  const clearDraft = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsDirty(false)
    isDirtyRef.current = false
    try {
      localStorage.removeItem(keyRef.current)
    } catch {
      // Ignore
    }
  }, [])

  // ── discardDraft — revert to initial value and delete storage ────────────
  const discardDraft = useCallback(() => {
    clearDraft()
    setState({ value: initialRef.current, hasDraft: false })
  }, [clearDraft])

  // ── reset — programmatically set clean value ─────────────────────────────
  const reset = useCallback((newValue?: string) => {
    clearDraft()
    setState({ value: newValue ?? initialRef.current, hasDraft: false })
  }, [clearDraft])

  const meta: UseDraftMeta = {
    isDirty,
    hasDraft,
    discardDraft,
    reset,
  }

  return [value, setValue, clearDraft, meta]
}
