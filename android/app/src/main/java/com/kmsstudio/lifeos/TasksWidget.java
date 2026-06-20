package com.kmsstudio.lifeos;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

/**
 * TasksWidget
 *
 * "Tasks Today" homescreen widget.
 * Reads pending/completed counts and top priority task from SharedPreferences
 * (written by WidgetDataPlugin whenever the app is open and data changes).
 * Tapping anywhere on the widget opens the app on the Tasks screen.
 */
public class TasksWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(
                WidgetDataPlugin.PREFS_NAME, Context.MODE_PRIVATE);

        String pending   = prefs.getString("tasks_pending",   "—");
        String completed = prefs.getString("tasks_completed", "0");
        String topTask   = prefs.getString("tasks_top",       "No priority task");

        for (int widgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_tasks);

            views.setTextViewText(R.id.widget_tasks_pending,   pending);
            views.setTextViewText(R.id.widget_tasks_completed, completed + " done");
            views.setTextViewText(R.id.widget_tasks_top,       topTask);

            // Tap → open app on /tasks
            views.setOnClickPendingIntent(R.id.widget_tasks_root, buildOpenIntent(context, "/tasks"));

            appWidgetManager.updateAppWidget(widgetId, views);
        }
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private PendingIntent buildOpenIntent(Context context, String path) {
        Intent intent = context.getPackageManager()
                .getLaunchIntentForPackage(context.getPackageName());
        if (intent == null) intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("widgetDeepLink", path);

        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;

        return PendingIntent.getActivity(context, 0, intent, flags);
    }
}
