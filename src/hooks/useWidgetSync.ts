import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { WidgetData, formatWidgetAmount } from '../lib/widgetBridge'
import { useDb } from '../db/DbContext'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'
import { getUserLocalDate } from '../lib/dateUtils'

/**
 * useWidgetSync
 *
 * Reads live data from Dexie and pushes it to the three native Android
 * homescreen widgets via WidgetData (widgetBridge.ts).
 *
 * IMPORTANT: every Dexie query filters by the authenticated user_id to
 * prevent cross-account data leakage on shared / multi-account devices.
 *
 * Sync is triggered:
 *   1. Once on mount (cold start / first render after login).
 *   2. Every time the app comes to the foreground (appStateChange).
 *   3. Every 60 s as a fallback while the app is open.
 *
 * No-ops on web/iOS — all WidgetData methods are stubs on non-Android.
 */
export function useWidgetSync() {
  const db = useDb()
  const { timezone }  = useAppStore()
  const { user }      = useAuth()
  const isSyncing     = useRef(false)

  const sync = async () => {
    if (!Capacitor.isNativePlatform()) return
    if (!user?.id) return          // not logged in — never query without a user
    if (isSyncing.current) return
    isSyncing.current = true

    const userId = user.id

    try {
      const today = getUserLocalDate(timezone)

      // ── Tasks ── filter by user_id AND date ──────────────────────────────
      const tasks = await db.tasks
        .where('user_id').equals(userId)
        .filter(t => t.date === today)
        .toArray()

      const pending  = tasks.filter(t => !t.completed && !t.skipped)
      const done     = tasks.filter(t => t.completed)
      const topTask  = pending
        .filter(t => t.priority != null)
        .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))[0]
        ?? pending[0]
        ?? null

      await WidgetData.updateTasksWidget({
        pending:   pending.length,
        completed: done.length,
        topTask:   topTask?.title ?? '',
      })

      // ── Finance ── filter by user_id ─────────────────────────────────────
      const wallets = await db.wallets
        .where('user_id').equals(userId)
        .filter(w => !w.archived)
        .toArray()

      const transactions = await db.transactions
        .where('user_id').equals(userId)
        .filter(t => t.date === today)
        .toArray()

      const primaryCurrency = wallets[0]?.currency ?? 'USD'

      const totalBalance = wallets
        .filter(w => (w.currency ?? primaryCurrency) === primaryCurrency)
        .reduce((sum, w) => sum + (w.balance ?? 0), 0)

      const todayIncome  = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount ?? 0), 0)
      const todayExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount ?? 0), 0)

      await WidgetData.updateFinanceWidget({
        totalBalance:  formatWidgetAmount(totalBalance),
        currency:      primaryCurrency,
        incomeToday:   '+' + formatWidgetAmount(todayIncome),
        expenseToday:  '-' + formatWidgetAmount(todayExpense),
      })

      // ── Inbox ── filter by user_id ───────────────────────────────────────
      const allInbox = await db.inbox_items
        .where('user_id').equals(userId)
        .toArray()

      const unprocessed = allInbox
        .filter(item => !item.processed)
        .sort((a, b) =>
          new Date(b.captured_at ?? 0).getTime() - new Date(a.captured_at ?? 0).getTime()
        )

      await WidgetData.updateInboxWidget({
        count:     unprocessed.length,
        firstItem: unprocessed[0]?.text ?? '',
      })

    } catch (err) {
      console.warn('[useWidgetSync] sync error:', err)
    } finally {
      isSyncing.current = false
    }
  }

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (!user?.id) return

    sync()

    let removeListener: (() => void) | undefined
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) sync()
    }).then(handle => { removeListener = () => handle.remove() })

    const interval = setInterval(sync, 60_000)

    return () => {
      removeListener?.()
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timezone, user?.id])

  return { syncWidgets: sync }
}
