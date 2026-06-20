import { registerPlugin } from '@capacitor/core'

/**
 * WidgetDataPlugin — TypeScript bridge
 *
 * Calls the native Android WidgetDataPlugin to write fresh data into
 * SharedPreferences and trigger an immediate widget redraw.
 *
 * Only has effect when running as a native Android APK.
 * On web/iOS the calls are silently ignored (Capacitor no-ops).
 */

export interface TasksWidgetData {
  /** Number of incomplete, non-skipped tasks for today */
  pending: string
  /** Number of completed tasks for today */
  completed: string
  /** Title of the highest-priority pending task, or empty string */
  topTask: string
}

export interface FinanceWidgetData {
  /** Formatted total balance across all wallets (e.g. "1,250.00") */
  totalBalance: string
  /** Currency code of the primary wallet (e.g. "XOF") */
  currency: string
  /** Formatted total income for today (e.g. "+450.00") */
  income: string
  /** Formatted total expenses for today (e.g. "-200.00") */
  expense: string
}

export interface InboxWidgetData {
  /** Total count of unprocessed inbox items */
  unprocessed: string
  /** Text of the most recent unprocessed item, or empty string */
  firstItem: string
}

export interface WidgetDataPlugin {
  syncTasks(data: TasksWidgetData): Promise<void>
  syncFinance(data: FinanceWidgetData): Promise<void>
  syncInbox(data: InboxWidgetData): Promise<void>
}

const WidgetData = registerPlugin<WidgetDataPlugin>('WidgetData')

export { WidgetData }
