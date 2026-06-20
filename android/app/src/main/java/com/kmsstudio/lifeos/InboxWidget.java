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
 * InboxWidget
 *
 * "Inbox Quick View" homescreen widget.
 * Shows count of unprocessed items and a preview of the most recent one.
 * Tapping opens the app on the Inbox screen.
 */
public class InboxWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(
                WidgetDataPlugin.PREFS_NAME, Context.MODE_PRIVATE);

        String rawCount  = prefs.getString("inbox_count", "0");
        String firstItem = prefs.getString("inbox_first", "Tap to capture a thought");

        // Build friendly count label
        int count = 0;
        try { count = Integer.parseInt(rawCount); } catch (NumberFormatException ignored) {}
        String countLabel = count == 1 ? "1 unprocessed" : count + " unprocessed";

        if (firstItem.isEmpty()) firstItem = "Tap to capture a thought";

        for (int widgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_inbox);

            views.setTextViewText(R.id.widget_inbox_count, countLabel);
            views.setTextViewText(R.id.widget_inbox_first, firstItem);

            views.setOnClickPendingIntent(R.id.widget_inbox_root, buildOpenIntent(context, "/inbox"));

            appWidgetManager.updateAppWidget(widgetId, views);
        }
    }

    private PendingIntent buildOpenIntent(Context context, String path) {
        Intent intent = context.getPackageManager()
                .getLaunchIntentForPackage(context.getPackageName());
        if (intent == null) intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("widgetDeepLink", path);

        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;

        return PendingIntent.getActivity(context, 2, intent, flags);
    }
}
