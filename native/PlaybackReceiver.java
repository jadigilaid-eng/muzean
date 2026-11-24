package com.muzean.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Forwards notification button presses to the web layer through the plugin. */
public class PlaybackReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action != null) MuzeanStoragePlugin.dispatchMediaAction(action);
    }
}
