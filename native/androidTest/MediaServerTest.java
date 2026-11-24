package com.muzean.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import android.content.ContentResolver;
import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class MediaServerTest {

    private ContentResolver cr;
    private File file;
    private byte[] data;
    private String uri;

    @Before
    public void setUp() throws IOException {
        Context ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();
        cr = ctx.getContentResolver();
        data = new byte[10_000];
        for (int i = 0; i < data.length; i++) data[i] = (byte) (i % 251);
        file = new File(ctx.getCacheDir(), "a b%c.mp3");
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(data);
        }
        uri = Uri.fromFile(file).toString();
    }

    @After
    public void tearDown() {
        if (file != null) file.delete();
    }

    private static byte[] readAll(WebResourceResponse r) throws IOException {
        try (InputStream in = r.getData()) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    @Test
    public void servesWholeFileWithoutRange() throws IOException {
        WebResourceResponse r = MediaServer.serve(cr, uri, null);
        assertEquals(200, r.getStatusCode());
        assertEquals("audio/mpeg", r.getMimeType());
        assertEquals("bytes", r.getResponseHeaders().get("Accept-Ranges"));
        assertEquals("10000", r.getResponseHeaders().get("Content-Length"));
        assertArrayEquals(data, readAll(r));
    }

    @Test
    public void servesBoundedRange() throws IOException {
        WebResourceResponse r = MediaServer.serve(cr, uri, "bytes=100-199");
        assertEquals(206, r.getStatusCode());
        assertEquals("bytes 100-199/10000", r.getResponseHeaders().get("Content-Range"));
        assertEquals("100", r.getResponseHeaders().get("Content-Length"));
        assertArrayEquals(Arrays.copyOfRange(data, 100, 200), readAll(r));
    }

    @Test
    public void servesOpenEndedAndSuffixRanges() throws IOException {
        assertArrayEquals(Arrays.copyOfRange(data, 9990, 10_000), readAll(MediaServer.serve(cr, uri, "bytes=9990-")));
        assertArrayEquals(Arrays.copyOfRange(data, 9984, 10_000), readAll(MediaServer.serve(cr, uri, "bytes=-16")));
    }

    @Test
    public void unsatisfiableRangeFallsBackToWholeFile() throws IOException {
        WebResourceResponse r = MediaServer.serve(cr, uri, "bytes=20000-");
        assertEquals(200, r.getStatusCode());
        assertArrayEquals(data, readAll(r));
    }

    @Test
    public void seekingBackAndForthReturnsCorrectBytes() throws IOException {
        for (int start : new int[] { 5000, 0, 9999, 1234 }) {
            WebResourceResponse r = MediaServer.serve(cr, uri, "bytes=" + start + "-" + start);
            assertArrayEquals(new byte[] { data[start] }, readAll(r));
        }
    }

    @Test
    public void missingFileThrows() {
        assertThrows(IOException.class, () -> MediaServer.serve(cr, Uri.fromFile(new File(file.getParentFile(), "nope.mp3")).toString(), null));
    }
}
