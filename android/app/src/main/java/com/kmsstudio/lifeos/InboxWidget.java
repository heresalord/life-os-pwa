package com.kmsstudio.lifeos;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** InboxWidget — "Inbox Quick View" homescreen widget. */
public class InboxWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        SharedPreferences p = context.getSharedPreferences(
                WidgetDataPlugin.PREFS_NAME, Context.MODE_PRIVATE);

        int    count     = parseInt(p.getString("inbox_count", "0"), 0);
        String firstItem = p.getString("inbox_first", "");

        RemoteViews views = WidgetDataPlugin.buildInboxViews(context, count, firstItem);
        for (int id : ids) mgr.updateAppWidget(id, views);
    }

    private static int parseInt(String s, int def) {
        try { return Integer.parseInt(s); } catch (Exception e) { return def; }
    }
}
