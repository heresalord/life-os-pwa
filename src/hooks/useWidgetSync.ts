import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { WidgetData, formatWidgetAmount } from '../lib/widgetBridge'
import { db } from '../db'
import { useAppStore } from '../store/useAppStore'
import { getUserLocalDate } from '../lib/dateUtils'

/**
 * useWidgetSync
 *
 * Reads live data from Dexie (local-first store) and pushes it to the three
 * native Android homescreen widgets via WidgetData (widgetBridge.ts).
 *
 * Sync is triggered:
 *   1. Once on mount (covers cold start / first render after login).
 *   2. Every time the app comes back to the foreground (appStateChange).
 *   3. On a 60-second interval as a fallback.
 *
 * Only active on native Android — all methods no-op on web/iOS via widgetBridgeWeb.
 *
 * Usage: call once inside AppShell (already done). The returned `syncWidgets`
 * can be called manually from mutation hooks after a write.
 */
export function useWidgetSync() {
  const { timezone } = useAppStore()
  const isSyncing = useRef(false)

  const sync = async () => {
    if (!Capacitor.isNativePlatform()) return
    if (isSyncing.current) return
    isSyncing.current = true

    try {
      const today = getUserLocalDate(timezone)

      // ── Tasks ─────────────────────────────────────────────────────────────
      const tasks    = await db.tasks.where('date').equals(today).toArray()
      const pending  = tasks.filter(t => !t.completed && !t.skipped)
      const done     = tasks.filter(t => t.completed)

      const topTask = pending
        .filter(t => t.priority != null)
        .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))[0]
        ?? pending[0]
        ?? null

      await WidgetData.updateTasksWidget({
        pending:   pending.length,
        completed: done.length,
        topTask:   topTask?.title ?? '',
      })

      // ── Finance ───────────────────────────────────────────────────────────
      const wallets      = await db.wallets.toArray()
      const transactions = await db.transactions.where('date').equals(today).toArray()

      const primaryCurrency = wallets[0]?.currency ?? 'USD'

      const totalBalance = wallets
        .filter(w => !w.archived && (w.currency ?? primaryCurrency) === primaryCurrency)
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

      // ── Inbox ─────────────────────────────────────────────────────────────
      // processed is a JS boolean — Dexie IndexableType doesn't support boolean,
      // so fetch all and filter in memory instead of using the index
      const unprocessed = await db.inbox_items
        .toArray()
        .then(items =>
          items
            .filter(item => !item.processed)
            .sort((a, b) =>
              new Date(b.captured_at ?? 0).getTime() - new Date(a.captured_at ?? 0).getTime()
            )
        )

      await WidgetData.updateInboxWidget({
        count:     unprocessed.length,
        firstItem: unprocessed[0]?.text ?? '',
      })

    } catch (err) {
      // Widget sync is non-critical — never block the UI
      console.warn('[useWidgetSync] sync error:', err)
    } finally {
      isSyncing.current = false
    }
  }

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    sync()

    let removeListener: (() => void) | undefined
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) sync()
    }).then(handle => {
      removeListener = () => handle.remove()
    })

    const interval = setInterval(sync, 60_000)

    return () => {
      removeListener?.()
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timezone])

  return { syncWidgets: sync }
}
