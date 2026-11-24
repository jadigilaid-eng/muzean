package com.muzean.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/**
 * Foreground service that keeps the process (and therefore the WebView's audio element) alive while music
 * plays with the screen off or the app in the background, and shows transport controls in the notification.
 */
public class PlaybackService extends Service {

    static final String CHANNEL_ID = "muzean_playback";
    static final int NOTIFICATION_ID = 7001;
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_ARTIST = "artist";
    static final String EXTRA_PLAYING = "playing";
    static final String ACTION_STOP = "com.muzean.app.STOP";

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || ACTION_STOP.equals(intent.getAction())) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        Notification n = build(
            this,
            intent.getStringExtra(EXTRA_TITLE),
            intent.getStringExtra(EXTRA_ARTIST),
            intent.getBooleanExtra(EXTRA_PLAYING, true)
        );
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, n);
        }
        return START_NOT_STICKY;
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Pemutaran musik", NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
    }

    private static PendingIntent action(Context ctx, String name, int code) {
        Intent i = new Intent(ctx, PlaybackReceiver.class).setAction(name).setPackage(ctx.getPackageName());
        return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static Notification build(Context ctx, String title, String artist, boolean playing) {
        ensureChannel(ctx);
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL_ID) : new Notification.Builder(ctx);
        b.setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title == null || title.isEmpty() ? "MUZEAN" : title)
            .setContentText(artist == null ? "" : artist)
            .setContentIntent(content)
            .setOngoing(playing)
            .setOnlyAlertOnce(true)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous, "Sebelumnya", action(ctx, "prev", 1)).build())
            .addAction(
                new Notification.Action.Builder(
                    playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                    playing ? "Jeda" : "Putar",
                    action(ctx, "toggle", 2)
                ).build()
            )
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next, "Berikutnya", action(ctx, "next", 3)).build())
            .setStyle(new Notification.MediaStyle().setShowActionsInCompactView(0, 1, 2));
        return b.build();
    }
}
