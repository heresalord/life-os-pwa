import { WebPlugin } from '@capacitor/core'
import type { WidgetDataPlugin } from './widgetBridge'

/**
 * Web/iOS stub — all methods are no-ops.
 * Only the native Android implementation in WidgetDataPlugin.java does real work.
 */
export class WidgetDataWeb extends WebPlugin implements WidgetDataPlugin {
  async updateTasksWidget(_data: Parameters<WidgetDataPlugin['updateTasksWidget']>[0]): Promise<void> {}
  async updateFinanceWidget(_data: Parameters<WidgetDataPlugin['updateFinanceWidget']>[0]): Promise<void> {}
  async updateInboxWidget(_data: Parameters<WidgetDataPlugin['updateInboxWidget']>[0]): Promise<void> {}
  async updateAllWidgets(_data: Parameters<WidgetDataPlugin['updateAllWidgets']>[0]): Promise<void> {}
}
