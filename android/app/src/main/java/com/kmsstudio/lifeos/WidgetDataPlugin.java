package com.kmsstudio.lifeos;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
 * Previous approach (broadcast → onReceive → onUpdate) was unreliable because
 * Android 8+ imposes strict background broadcast delivery timing, and the widget
 * provider's onUpdate could fire before SharedPreferences was written.
 *
 * Current approach: update RemoteViews DIRECTLY from the plugin via
 * AppWidgetManager.updateAppWidget(). This is synchronous and bypasses the
 * broadcast pipeline entirely. SharedPreferences are still written so the
 * individual widget providers (called by Android on cold boot / widget placement)
 * can read the last-known data without the app being open.
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
        if (topTask == null) topTask = "";

        Context ctx = getContext();

        // 1. Persist to SharedPreferences (read by TasksWidget.onUpdate on cold boot)
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString("tasks_pending",   String.valueOf(pending))
            .putString("tasks_completed", String.valueOf(completed))
            .putString("tasks_top",       topTask)
            .apply();

        // 2. Update RemoteViews directly — no broadcast needed
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, TasksWidget.class));
        if (ids.length > 0) {
            RemoteViews views = buildTasksViews(ctx, pending, completed, topTask);
            mgr.updateAppWidget(ids, views);
        }

        call.resolve();
    }

    // ── Finance ──────────────────────────────────────────────────────────────

    @PluginMethod
    public void updateFinanceWidget(PluginCall call) {
        String balance     = nvl(call.getString("totalBalance",  "0"),  "0");
        String currency    = nvl(call.getString("currency",      ""),   "");
        String incomeToday = nvl(call.getString("incomeToday",   "+0"), "+0");
        String expenseToday= nvl(call.getString("expenseToday",  "-0"), "-0");

        Context ctx = getContext();

        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString("finance_balance",  balance)
            .putString("finance_currency", currency)
            .putString("finance_income",   incomeToday)
            .putString("finance_expense",  expenseToday)
            .apply();

        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, FinanceWidget.class));
        if (ids.length > 0) {
            RemoteViews views = buildFinanceViews(ctx, balance, currency, incomeToday, expenseToday);
            mgr.updateAppWidget(ids, views);
        }

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
        if (ids.length > 0) {
            RemoteViews views = buildInboxViews(ctx, count, firstItem);
            mgr.updateAppWidget(ids, views);
        }

        call.resolve();
    }

    // ── All at once ──────────────────────────────────────────────────────────

    @PluginMethod
    public void updateAllWidgets(PluginCall call) {
        try {
            com.getcapacitor.JSObject t = call.getObject("tasks");
            com.getcapacitor.JSObject f = call.getObject("finance");
            com.getcapacitor.JSObject i = call.getObject("inbox");

            if (t != null) {
                PluginCall sub = fakeCall();
                sub.getData().put("pending",   t.optInt("pending",   0));
                sub.getData().put("completed", t.optInt("completed", 0));
                sub.getData().put("topTask",   t.optString("topTask", ""));
                updateTasksWidget(sub);
            }
            if (f != null) {
                PluginCall sub = fakeCall();
                sub.getData().put("totalBalance",  f.optString("totalBalance",  "0"));
                sub.getData().put("currency",      f.optString("currency",      ""));
                sub.getData().put("incomeToday",   f.optString("incomeToday",   "+0"));
                sub.getData().put("expenseToday",  f.optString("expenseToday",  "-0"));
                updateFinanceWidget(sub);
            }
            if (i != null) {
                PluginCall sub = fakeCall();
                sub.getData().put("count",     i.optInt("count",    0));
                sub.getData().put("firstItem", i.optString("firstItem", ""));
                updateInboxWidget(sub);
            }
        } catch (Exception e) {
            call.reject("updateAllWidgets failed: " + e.getMessage());
            return;
        }
        call.resolve();
    }

    // ── RemoteViews builders ─────────────────────────────────────────────────

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
        String label = count == 1 ? "1 unprocessed" : count + " unprocessed";
        String preview = (firstItem == null || firstItem.isEmpty())
            ? "Tap to capture a thought" : firstItem;

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_inbox);
        v.setTextViewText(R.id.widget_inbox_count, label);
        v.setTextViewText(R.id.widget_inbox_first, preview);
        v.setOnClickPendingIntent(R.id.widget_inbox_root, buildOpenIntent(ctx, "/inbox", 2));
        return v;
    }

    // ── Shared helpers ───────────────────────────────────────────────────────

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

    /** Null-safe string fallback */
    private static String nvl(String value, String fallback) {
        return value != null ? value : fallback;
    }

    /** Creates a detached PluginCall shell for internal delegation */
    private PluginCall fakeCall() {
        return new PluginCall(null, "", "", new com.getcapacitor.JSObject(), null);
    }
}
