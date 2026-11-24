package com.muzean.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.URLEncoder;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Launches the real MainActivity and exercises the WebView, the plugin registration and the media server. */
@RunWith(AndroidJUnit4.class)
public class AppSmokeTest {

    private String eval(ActivityScenario<MainActivity> scenario, String js) throws InterruptedException {
        final AtomicReference<String> out = new AtomicReference<>("");
        final CountDownLatch latch = new CountDownLatch(1);
        scenario.onActivity(activity ->
            activity.getBridge().getWebView().evaluateJavascript(js, value -> {
                out.set(value == null ? "" : value);
                latch.countDown();
            })
        );
        latch.await(10, TimeUnit.SECONDS);
        return out.get();
    }

    private void waitFor(ActivityScenario<MainActivity> scenario, String js, String expected, int seconds) throws InterruptedException {
        long deadline = System.currentTimeMillis() + seconds * 1000L;
        String last = "";
        while (System.currentTimeMillis() < deadline) {
            last = eval(scenario, js);
            if (expected.equals(last)) return;
            Thread.sleep(500);
        }
        assertEquals("timeout waiting for: " + js, expected, last);
    }

    @Test
    public void appBootsRegistersPluginAndServesMediaWithRange() throws Exception {
        Context ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();
        byte[] data = new byte[2000];
        for (int i = 0; i < data.length; i++) data[i] = (byte) (i % 200);
        File file = new File(ctx.getCacheDir(), "smoke track.mp3");
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(data);
        } catch (IOException e) {
            throw new AssertionError(e);
        }

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitFor(scenario, "String(window.Capacitor && Capacitor.getPlatform())", "\"android\"", 60);
            waitFor(scenario, "String(Capacitor.isPluginAvailable('MuzeanStorage'))", "\"true\"", 20);

            String encoded = URLEncoder.encode(Uri.fromFile(file).toString(), "UTF-8").replace("+", "%20");
            String js =
                "window.__r='';fetch('/_muzean_media/" + encoded + "',{headers:{Range:'bytes=10-14'}})" +
                ".then(function(r){return r.arrayBuffer().then(function(b){window.__r=r.status+'|'+r.headers.get('Content-Range')+'|'+Array.from(new Uint8Array(b)).join(',');});})" +
                ".catch(function(e){window.__r='ERR '+e;});'started'";
            eval(scenario, js);
            waitFor(scenario, "String(window.__r)", "\"206|bytes 10-14/2000|10,11,12,13,14\"", 20);

            // The app UI itself must have rendered (React root has children).
            waitFor(scenario, "String(document.getElementById('root') && document.getElementById('root').children.length > 0)", "\"true\"", 20);
            assertTrue(file.delete());
        }
    }
}
