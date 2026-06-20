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
 * FinanceWidget
 *
 * "Finance Snapshot" homescreen widget.
 * Shows total balance across all wallets plus today's income / expense totals.
 * Tapping opens the app on the Finance screen.
 */
public class FinanceWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(
                WidgetDataPlugin.PREFS_NAME, Context.MODE_PRIVATE);

        String balance  = prefs.getString("finance_balance",  "—");
        String currency = prefs.getString("finance_currency", "");
        String income   = prefs.getString("finance_income",   "+0");
        String expense  = prefs.getString("finance_expense",  "-0");

        for (int widgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_finance);

            views.setTextViewText(R.id.widget_finance_balance,  balance);
            views.setTextViewText(R.id.widget_finance_currency, currency);
            views.setTextViewText(R.id.widget_finance_income,   income);
            views.setTextViewText(R.id.widget_finance_expense,  expense);

            views.setOnClickPendingIntent(R.id.widget_finance_root, buildOpenIntent(context, "/finance"));

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

        return PendingIntent.getActivity(context, 1, intent, flags);
    }
}
