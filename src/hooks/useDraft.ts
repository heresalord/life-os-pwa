import { useState, useEffect, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'

/**
 * useDraft — persist in-progress text to localStorage so it survives
 * WebView reclaim, force-quit, and SW-triggered page reloads.
 *
 * Usage:
 *   const [value, setValue] = useDraft('draft:uid:2026-09-28:morning-journal', '')
 *
 * The hook:
 *   - Restores the saved draft on mount (returns saved value as the initial state).
 *   - Writes debounced (~300 ms) on every change.
 *   - Flushes immediately on visibilitychange → hidden, pagehide, and
 *     Capacitor appStateChange → inactive.
 *   - Exposes `clearDraft()` for callers to call after a successful save or
 *     explicit discard.
 *
 * @param key     Unique storage key. Must be stable across remounts.
 *                Recommended format: `draft:<uid>:<YYYY-MM-DD>:<surface>`.
 * @param initial Fallback value when no draft is stored.
 * @param enabled Set to false to skip all storage reads/writes (e.g. for
 *                locked notes, non-editable views). Defaults to true.
 */
export function useDraft(
  key: string,
  initial: string,
  { enabled = true }: { enabled?: boolean } = {}
): [string, (action: string | ((prev: string) => string)) => void, () => void] {
  // ── Initialise from cache on first render ────────────────────────────────
  const [value, setValueRaw] = useState<string>(() => {
    if (!enabled) return initial
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? stored : initial
    } catch {
      return initial
    }
  })

  const valueRef      = useRef(value)
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enabledRef    = useRef(enabled)
  const keyRef        = useRef(key)

  // Keep refs in sync
  useEffect(() => { valueRef.current = value },   [value])
  useEffect(() => { enabledRef.current = enabled }, [enabled])
  useEffect(() => { keyRef.current = key },         [key])

  // ── Flush helper — writes the current value immediately ─────────────────
  const flush = useCallback(() => {
    if (!enabledRef.current) return
    try {
      localStorage.setItem(keyRef.current, valueRef.current)
    } catch {
      // Storage full / private-mode restriction — not fatal
    }
  }, [])

  // ── Debounced write on every state change ────────────────────────────────
  const setValue = useCallback((action: string | ((prev: string) => string)) => {
    setValueRaw(prev => {
      const next = typeof action === 'function' ? action(prev) : action
      valueRef.current = next
      return next
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

  // ── clearDraft — call after a successful save or discard ─────────────────
  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    try {
      localStorage.removeItem(keyRef.current)
    } catch {
      // Ignore
    }
  }, [])

  return [value, setValue, clearDraft]
}
