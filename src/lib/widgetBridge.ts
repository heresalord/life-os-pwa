import { registerPlugin } from '@capacitor/core'
import { Capacitor } from '@capacitor/core'

// ── Plugin interface ──────────────────────────────────────────────────────────

export interface WidgetDataPlugin {
  updateTasksWidget(data: {
    pending: number
    completed: number
    topTask: string
  }): Promise<void>

  updateFinanceWidget(data: {
    totalBalance: string
    currency: string
    incomeToday: string
    expenseToday: string
  }): Promise<void>

  updateInboxWidget(data: {
    count: number
    firstItem: string
  }): Promise<void>

  updateAllWidgets(data: {
    tasks: { pending: number; completed: number; topTask: string }
    finance: { totalBalance: string; currency: string; incomeToday: string; expenseToday: string }
    inbox: { count: number; firstItem: string }
  }): Promise<void>
}

// Register — only resolves to the native plugin on Android.
// On web/iOS it silently no-ops via the stub below.
const WidgetData = registerPlugin<WidgetDataPlugin>('WidgetData', {
  web: () => import('./widgetBridgeWeb').then(m => new m.WidgetDataWeb()),
})

export { WidgetData }

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Returns true only when running inside the Android APK. */
export const isAndroid = () => Capacitor.getPlatform() === 'android'

/**
 * Format a numeric amount for widget display.
 * e.g. 12345.6 → "12,345.60"
 */
export function formatWidgetAmount(amount: number, _currency?: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return String(Math.round(amount))
  }
}
