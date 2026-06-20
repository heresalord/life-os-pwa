package com.kmsstudio.lifeos;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * WidgetDataPlugin
 *
 * Capacitor bridge between the React/TS layer and the Android homescreen widgets.
 * Method names match the TypeScript interface in src/lib/widgetBridge.ts exactly.
 *
 * Flow:
 *   1. JS calls updateTasksWidget / updateFinanceWidget / updateInboxWidget.
 *   2. Plugin writes data to SharedPreferences (readable by widget providers
 *      even when the app is not running).
 *   3. Plugin broadcasts ACTION_APPWIDGET_UPDATE so the widget redraws
 *      immediately rather than waiting for the 30-minute scheduler.
 */
@CapacitorPlugin(name = "WidgetData")
public class WidgetDataPlugin extends Plugin {

    static final String PREFS_NAME = "LifeOSWidgetPrefs";

    // ── Tasks ────────────────────────────────────────────────────────────────

    @PluginMethod
    public void updateTasksWidget(PluginCall call) {
        int    pending   = call.getInt("pending",   0);
        int    completed = call.getInt("completed", 0);
        String topTask   = call.getString("topTask", "");

        Context ctx = getContext();
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString("tasks_pending",   String.valueOf(pending))
            .putString("tasks_completed", String.valueOf(completed))
            .putString("tasks_top",       topTask != null ? topTask : "")
            .apply();

        triggerWidgetUpdate(ctx, TasksWidget.class);
        call.resolve();
    }

    // ── Finance ──────────────────────────────────────────────────────────────

    @PluginMethod
    public void updateFinanceWidget(PluginCall call) {
        String balance    = call.getString("totalBalance",  "0");
        String currency   = call.getString("currency",      "USD");
        String incomeToday  = call.getString("incomeToday",  "+0");
        String expenseToday = call.getString("expenseToday", "-0");

        Context ctx = getContext();
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString("finance_balance",  balance  != null ? balance  : "0")
            .putString("finance_currency", currency != null ? currency : "USD")
            .putString("finance_income",   incomeToday  != null ? incomeToday  : "+0")
            .putString("finance_expense",  expenseToday != null ? expenseToday : "-0")
            .apply();

        triggerWidgetUpdate(ctx, FinanceWidget.class);
        call.resolve();
    }

    // ── Inbox ────────────────────────────────────────────────────────────────

    @PluginMethod
    public void updateInboxWidget(PluginCall call) {
        int    count     = call.getInt("count",     0);
        String firstItem = call.getString("firstItem", "");

        Context ctx = getContext();
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString("inbox_count", String.valueOf(count))
            .putString("inbox_first", firstItem != null ? firstItem : "")
            .apply();

        triggerWidgetUpdate(ctx, InboxWidget.class);
        call.resolve();
    }

    // ── All at once ──────────────────────────────────────────────────────────

    @PluginMethod
    public void updateAllWidgets(PluginCall call) {
        // Delegate to each individual method by extracting the nested objects.
        // This lets callers batch a single round-trip to update all three widgets.
        try {
            com.getcapacitor.JSObject tasks   = call.getObject("tasks");
            com.getcapacitor.JSObject finance = call.getObject("finance");
            com.getcapacitor.JSObject inbox   = call.getObject("inbox");

            Context ctx = getContext();
            SharedPreferences.Editor ed =
                ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();

            if (tasks != null) {
                ed.putString("tasks_pending",   tasks.optString("pending",   "0"))
                  .putString("tasks_completed", tasks.optString("completed", "0"))
                  .putString("tasks_top",       tasks.optString("topTask",   ""));
            }
            if (finance != null) {
                ed.putString("finance_balance",  finance.optString("totalBalance",  "0"))
                  .putString("finance_currency", finance.optString("currency",      "USD"))
                  .putString("finance_income",   finance.optString("incomeToday",   "+0"))
                  .putString("finance_expense",  finance.optString("expenseToday",  "-0"));
            }
            if (inbox != null) {
                ed.putString("inbox_count", inbox.optString("count",     "0"))
                  .putString("inbox_first", inbox.optString("firstItem", ""));
            }
            ed.apply();

            triggerWidgetUpdate(ctx, TasksWidget.class);
            triggerWidgetUpdate(ctx, FinanceWidget.class);
            triggerWidgetUpdate(ctx, InboxWidget.class);

        } catch (Exception e) {
            call.reject("updateAllWidgets failed: " + e.getMessage());
            return;
        }

        call.resolve();
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private void triggerWidgetUpdate(Context ctx, Class<?> widgetClass) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, widgetClass));
        if (ids.length == 0) return;

        Intent intent = new Intent(ctx, widgetClass);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        ctx.sendBroadcast(intent);
    }
}
