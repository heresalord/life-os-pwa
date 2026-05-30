/**
 * useNavSync — keeps the user's nav item selection in sync across devices.
 *
 * Storage strategy:
 *  - Immediate / same-device: localStorage (already handled by useAppStore)
 *  - Cross-device: user_settings.category_budgets → { nav_items: string[] }
 *    (category_budgets is a JSON column that was otherwise unused)
 *
 * Behaviour:
 *  1. On first settings load, seed the local store from the DB value (if present).
 *  2. Whenever navItems changes, debounce-save it back to the DB.
 *
 * Call this hook once, inside AppShell.
 */
import { useEffect, useRef } from 'react'
import { useUserSettings } from './useUserSettings'
import { useAppStore } from '../store/useAppStore'

export function useNavSync() {
  const { data: settings, upsert } = useUserSettings()
  const { navItems, setNavItems } = useAppStore()

  // Flag so we don't overwrite a user mid-session nav change with a stale DB read
  const seeded = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Step 1: seed from DB on first load ──────────────────────────────────
  useEffect(() => {
    if (!settings || seeded.current) return
    seeded.current = true

    const cb = settings.category_budgets as Record<string, unknown> | null
    const dbNav = cb?.nav_items
    if (Array.isArray(dbNav) && dbNav.length >= 1) {
      setNavItems(dbNav as string[])
    }
  }, [settings, setNavItems])

  // ── Step 2: auto-save nav to DB whenever it changes ─────────────────────
  useEffect(() => {
    // Don't fire before the initial seed has had a chance to run
    if (!seeded.current) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const existing = (settings?.category_budgets as Record<string, unknown>) ?? {}
      upsert.mutate({ category_budgets: { ...existing, nav_items: navItems } })
    }, 800)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navItems])
}
