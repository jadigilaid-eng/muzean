package com.muzean.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** Home-screen widget: shows the current track and controls playback through PlaybackReceiver. */
public class MuzeanWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "muzean_widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, build(context));
        }
    }

    static RemoteViews build(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String title = sp.getString("title", "MUZEAN");
        String artist = sp.getString("artist", "Ketuk untuk membuka");
        boolean playing = sp.getBoolean("playing", false);

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.muzean_widget);
        v.setTextViewText(R.id.widget_title, title == null || title.isEmpty() ? "MUZEAN" : title);
        v.setTextViewText(R.id.widget_artist, artist == null || artist.isEmpty() ? "Ketuk untuk membuka" : artist);
        v.setImageViewResource(R.id.widget_play, playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);

        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(ctx, 10, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, openPi);
        v.setOnClickPendingIntent(R.id.widget_logo, openPi);
        v.setOnClickPendingIntent(R.id.widget_prev, control(ctx, "prev", 11));
        v.setOnClickPendingIntent(R.id.widget_play, control(ctx, "toggle", 12));
        v.setOnClickPendingIntent(R.id.widget_next, control(ctx, "next", 13));
        return v;
    }

    private static PendingIntent control(Context ctx, String action, int code) {
        Intent i = new Intent(ctx, PlaybackReceiver.class).setAction(action).setPackage(ctx.getPackageName());
        return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Stores the latest playback state and redraws every placed widget. */
    static void refresh(Context ctx, String title, String artist, boolean playing) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("title", title)
            .putString("artist", artist)
            .putBoolean("playing", playing)
            .apply();
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, MuzeanWidgetProvider.class));
        for (int id : ids) {
            mgr.updateAppWidget(id, build(ctx));
        }
    }
}
