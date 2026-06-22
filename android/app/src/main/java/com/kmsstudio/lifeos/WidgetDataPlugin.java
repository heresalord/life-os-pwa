package com.kmsstudio.lifeos;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * WidgetDataPlugin
 *
 * Capacitor bridge between the React/TS layer and the native Android homescreen widgets.
 *
 * Updates RemoteViews DIRECTLY via AppWidgetManager.updateAppWidget() — no broadcast
 * needed. SharedPreferences are still written so widget providers can read the last-known
 * data on cold boot (widget placed before app is opened).
 */
@CapacitorPlugin(name = "WidgetData")
public class WidgetDataPlugin extends Plugin {

    static final String PREFS_NAME = "LifeOSWidgetPrefs";

    // ── Tasks ────────────────────────────────────────────────────────────────

    @PluginMethod
    public void updateTasksWidget(PluginCall call) {
        int    pending   = call.getInt("pending",   0);
        int    completed = call.getInt("completed", 0);
        String topTask   = nvl(call.getString("topTask", ""), "");

        Context ctx = getContext();

        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString("tasks_pending",   String.valueOf(pending))
            .putString("tasks_completed", String.valueOf(completed))
            .putString("tasks_top",       topTask)
            .apply();

        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, TasksWidget.class));
        if (ids.length > 0) mgr.updateAppWidget(ids, buildTasksViews(ctx, pending, completed, topTask));

        call.resolve();
    }

    // ── Finance ──────────────────────────────────────────────────────────────

    @PluginMethod
    public void updateFinanceWidget(PluginCall call) {
        String balance      = nvl(call.getString("totalBalance",  "0"),  "0");
        String currency     = nvl(call.getString("currency",      ""),   "");
        String incomeToday  = nvl(call.getString("incomeToday",   "+0"), "+0");
        String expenseToday = nvl(call.getString("expenseToday",  "-0"), "-0");

        Context ctx = getContext();

        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString("finance_balance",  balance)
            .putString("finance_currency", currency)
            .putString("finance_income",   incomeToday)
            .putString("finance_expense",  expenseToday)
            .apply();

        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, FinanceWidget.class));
        if (ids.length > 0) mgr.updateAppWidget(ids, buildFinanceViews(ctx, balance, currency, incomeToday, expenseToday));

        call.resolve();
    }

    // ── Inbox ────────────────────────────────────────────────────────────────

    @PluginMethod
    public void updateInboxWidget(PluginCall call) {
        int    count     = call.getInt("count",      0);
        String firstItem = nvl(call.getString("firstItem", ""), "");

        Context ctx = getContext();

        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString("inbox_count", String.valueOf(count))
            .putString("inbox_first", firstItem)
            .apply();

        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, InboxWidget.class));
        if (ids.length > 0) mgr.updateAppWidget(ids, buildInboxViews(ctx, count, firstItem));

        call.resolve();
    }

    // ── RemoteViews builders (also used by widget providers on cold boot) ────

    static RemoteViews buildTasksViews(Context ctx, int pending, int completed, String topTask) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_tasks);
        v.setTextViewText(R.id.widget_tasks_pending,   String.valueOf(pending));
        v.setTextViewText(R.id.widget_tasks_completed, completed + " done");
        v.setTextViewText(R.id.widget_tasks_top,
            (topTask == null || topTask.isEmpty()) ? "No tasks today" : topTask);
        v.setOnClickPendingIntent(R.id.widget_tasks_root, buildOpenIntent(ctx, "/tasks", 0));
        return v;
    }

    static RemoteViews buildFinanceViews(Context ctx, String balance, String currency,
                                          String income, String expense) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_finance);
        v.setTextViewText(R.id.widget_finance_balance,  balance);
        v.setTextViewText(R.id.widget_finance_currency, currency);
        v.setTextViewText(R.id.widget_finance_income,   income);
        v.setTextViewText(R.id.widget_finance_expense,  expense);
        v.setOnClickPendingIntent(R.id.widget_finance_root, buildOpenIntent(ctx, "/finance", 1));
        return v;
    }

    static RemoteViews buildInboxViews(Context ctx, int count, String firstItem) {
        String label   = count == 1 ? "1 unprocessed" : count + " unprocessed";
        String preview = (firstItem == null || firstItem.isEmpty())
            ? "Tap to capture a thought" : firstItem;
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_inbox);
        v.setTextViewText(R.id.widget_inbox_count, label);
        v.setTextViewText(R.id.widget_inbox_first, preview);
        v.setOnClickPendingIntent(R.id.widget_inbox_root, buildOpenIntent(ctx, "/inbox", 2));
        return v;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static PendingIntent buildOpenIntent(Context ctx, String deepLink, int requestCode) {
        Intent intent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (intent == null) intent = new Intent(ctx, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("widgetDeepLink", deepLink);
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            : PendingIntent.FLAG_UPDATE_CURRENT;
        return PendingIntent.getActivity(ctx, requestCode, intent, flags);
    }

    private static String nvl(String value, String fallback) {
        return value != null ? value : fallback;
    }
}
