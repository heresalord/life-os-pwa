package com.kmsstudio.lifeos;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** FinanceWidget — "Finance Snapshot" homescreen widget. */
public class FinanceWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        SharedPreferences p = context.getSharedPreferences(
                WidgetDataPlugin.PREFS_NAME, Context.MODE_PRIVATE);

        String balance  = p.getString("finance_balance",  "—");
        String currency = p.getString("finance_currency", "");
        String income   = p.getString("finance_income",   "+0");
        String expense  = p.getString("finance_expense",  "-0");

        RemoteViews views = WidgetDataPlugin.buildFinanceViews(context, balance, currency, income, expense);
        for (int id : ids) mgr.updateAppWidget(id, views);
    }
}
