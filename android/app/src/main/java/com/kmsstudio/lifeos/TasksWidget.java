package com.kmsstudio.lifeos;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/**
 * TasksWidget — "Tasks Today" homescreen widget.
 * onUpdate() is called by Android on cold boot / widget placement.
 * It reads the last-written SharedPreferences data and calls the shared
 * RemoteViews builder from WidgetDataPlugin so the layout logic lives in
 * exactly one place.
 */
public class TasksWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        SharedPreferences p = context.getSharedPreferences(
                WidgetDataPlugin.PREFS_NAME, Context.MODE_PRIVATE);

        int    pending   = parseInt(p.getString("tasks_pending",   "0"), 0);
        int    completed = parseInt(p.getString("tasks_completed", "0"), 0);
        String topTask   = p.getString("tasks_top", "");

        RemoteViews views = WidgetDataPlugin.buildTasksViews(context, pending, completed, topTask);
        for (int id : ids) mgr.updateAppWidget(id, views);
    }

    private static int parseInt(String s, int def) {
        try { return Integer.parseInt(s); } catch (Exception e) { return def; }
    }
}
