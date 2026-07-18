/* eslint-disable @typescript-eslint/no-unused-vars */
import { WebPlugin } from '@capacitor/core'

/**
 * WidgetDataWeb — web/iOS no-op stub.
 *
 * Registered as the web implementation of the 'WidgetData' Capacitor plugin.
 * All methods are silent no-ops; only the native Android implementation in
 * WidgetDataPlugin.java does real work.
 *
 * NOTE: This file deliberately does NOT import from widgetBridge.ts to avoid
 * a circular dependency (widgetBridge imports this file dynamically).
 */
export class WidgetDataWeb extends WebPlugin {
  async updateTasksWidget(_data: {
    pending: number; completed: number; topTask: string
  }): Promise<void> {}

  async updateFinanceWidget(_data: {
    totalBalance: string; currency: string; incomeToday: string; expenseToday: string
  }): Promise<void> {}

  async updateInboxWidget(_data: {
    count: number; firstItem: string
  }): Promise<void> {}

  async updateAllWidgets(_data: {
    tasks: { pending: number; completed: number; topTask: string }
    finance: { totalBalance: string; currency: string; incomeToday: string; expenseToday: string }
    inbox: { count: number; firstItem: string }
  }): Promise<void> {}
}
