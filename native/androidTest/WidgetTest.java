package com.muzean.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.Intent;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.List;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class WidgetTest {

    private Context ctx() {
        return InstrumentationRegistry.getInstrumentation().getTargetContext();
    }

    @Test
    public void widgetRendersCurrentTrackAndPlayState() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            Context c = ctx();
            MuzeanWidgetProvider.refresh(c, "Neon Dreams", "Retro Artist", true);
            View root = MuzeanWidgetProvider.build(c).apply(c, new FrameLayout(c));
            assertEquals("Neon Dreams", ((TextView) root.findViewById(R.id.widget_title)).getText().toString());
            assertEquals("Retro Artist", ((TextView) root.findViewById(R.id.widget_artist)).getText().toString());
            assertNotNull(root.findViewById(R.id.widget_prev));
            assertNotNull(root.findViewById(R.id.widget_play));
            assertNotNull(root.findViewById(R.id.widget_next));
        });
    }

    @Test
    public void widgetFallsBackToAppNameWhenTitleIsEmpty() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            Context c = ctx();
            MuzeanWidgetProvider.refresh(c, "", "", false);
            View root = MuzeanWidgetProvider.build(c).apply(c, new FrameLayout(c));
            assertEquals("MUZEAN", ((TextView) root.findViewById(R.id.widget_title)).getText().toString());
        });
    }

    @Test
    public void widgetIsRegisteredWithTheSystem() {
        Context c = ctx();
        List<android.appwidget.AppWidgetProviderInfo> providers = AppWidgetManager.getInstance(c).getInstalledProvidersForPackage(c.getPackageName(), null);
        boolean found = false;
        for (android.appwidget.AppWidgetProviderInfo info : providers) {
            if (new ComponentName(c, MuzeanWidgetProvider.class).equals(info.provider)) found = true;
        }
        assertEquals("MuzeanWidgetProvider must be a registered app widget", true, found);
    }
}
