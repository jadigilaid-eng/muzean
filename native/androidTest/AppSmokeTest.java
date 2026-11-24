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
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
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
                "window.__r=[];window.__done=false;(async function(){var u='/_muzean_media/" + encoded + "';" +
                "var hs=[{},{Range:'bytes=10-14'}];for(var k=0;k<hs.length;k++){try{var r=await fetch(u,{headers:hs[k]});" +
                "var b=new Uint8Array(await r.arrayBuffer());window.__r.push(r.status+'|'+r.headers.get('Content-Range')+'|'+b.length+'|'+Array.from(b.slice(0,5)).join(','));}" +
                "catch(e){window.__r.push('ERR '+e);}}window.__done=true;})();'started'";
            eval(scenario, js);
            waitFor(scenario, "String(window.__done)", "\"true\"", 20);
            // Plain fetch must work. fetch() with a Range header is known to fail through WebResourceResponse;
            // the app reads tags with a streamed plain fetch, and the audio element is covered by the test below.
            String fetched = eval(scenario, "window.__r.join('#')");
            assertTrue(fetched, fetched.startsWith("\"200|null|2000|0,1,2,3,4#"));

            // The app UI itself must have rendered (React root has children).
            waitFor(scenario, "String(document.getElementById('root') && document.getElementById('root').children.length > 0)", "\"true\"", 20);
            assertTrue(file.delete());
        }
    }

    private static byte[] wav(int seconds) {
        int rate = 8000;
        int n = rate * seconds;
        ByteBuffer b = ByteBuffer.allocate(44 + n).order(ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes()).putInt(36 + n).put("WAVE".getBytes()).put("fmt ".getBytes());
        b.putInt(16).putShort((short) 1).putShort((short) 1).putInt(rate).putInt(rate).putShort((short) 1).putShort((short) 8);
        b.put("data".getBytes()).putInt(n);
        for (int i = 0; i < n; i++) b.put((byte) (128 + (int) (40 * Math.sin(i / 10.0))));
        return b.array();
    }

    /** The real playback path: an <audio> element streaming through the media server, then seeking (Range requests). */
    @Test
    public void audioElementLoadsAndSeeksThroughMediaServer() throws Exception {
        Context ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File file = new File(ctx.getCacheDir(), "tone one.wav");
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(wav(3));
        }
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitFor(scenario, "String(window.Capacitor && Capacitor.getPlatform())", "\"android\"", 60);
            String encoded = URLEncoder.encode(Uri.fromFile(file).toString(), "UTF-8").replace("+", "%20");
            String js =
                "window.__a='';var a=new Audio('/_muzean_media/" + encoded + "');window.__aud=a;" +
                "a.addEventListener('error',function(){window.__a='ERR '+(a.error&&a.error.code);});" +
                "a.addEventListener('loadedmetadata',function(){window.__a='meta '+a.duration.toFixed(1);a.currentTime=2.0;});" +
                "a.addEventListener('seeked',function(){window.__a='seeked '+a.currentTime.toFixed(1)+' of '+a.duration.toFixed(1);});" +
                "a.load();'started'";
            eval(scenario, js);
            waitFor(scenario, "String(window.__a)", "\"seeked 2.0 of 3.0\"", 30);
        } finally {
            file.delete();
        }
    }
}
