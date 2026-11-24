package com.muzean.app;

import android.content.ContentResolver;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Serves content:// documents (picked through SAF) to the WebView at
 * https://localhost/_muzean_media/<encodeURIComponent(contentUri)> with real HTTP Range support,
 * so the <audio> element can stream and seek without loading whole files into memory.
 */
public class MuzeanWebViewClient extends BridgeWebViewClient {

    private static final String PREFIX = "/_muzean_media/";
    private final Bridge bridge;

    public MuzeanWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String path = request.getUrl().getEncodedPath();
        if (path != null && path.startsWith(PREFIX)) {
            try {
                return serve(request, Uri.decode(path.substring(PREFIX.length())));
            } catch (Exception e) {
                return new WebResourceResponse(
                    "text/plain",
                    "utf-8",
                    404,
                    "Not Found",
                    new HashMap<String, String>(),
                    new ByteArrayInputStream(new byte[0])
                );
            }
        }
        return super.shouldInterceptRequest(view, request);
    }

    private WebResourceResponse serve(WebResourceRequest request, String contentUri) throws IOException {
        Uri uri = Uri.parse(contentUri);
        ContentResolver cr = bridge.getContext().getContentResolver();
        AssetFileDescriptor afd = cr.openAssetFileDescriptor(uri, "r");
        if (afd == null) throw new IOException("cannot open " + contentUri);

        long total = afd.getLength();
        if (total < 0) {
            total = afd.getParcelFileDescriptor().getStatSize();
        }

        long start = 0;
        long end = total - 1;
        boolean partial = false;
        String range = request.getRequestHeaders().get("Range");
        if (range == null) range = request.getRequestHeaders().get("range");
        if (range != null && range.startsWith("bytes=") && total > 0) {
            String spec = range.substring(6).split(",")[0].trim();
            int dash = spec.indexOf('-');
            if (dash >= 0) {
                String a = spec.substring(0, dash).trim();
                String b = spec.substring(dash + 1).trim();
                try {
                    if (a.isEmpty() && !b.isEmpty()) {
                        long suffix = Long.parseLong(b);
                        start = Math.max(0, total - suffix);
                    } else if (!a.isEmpty()) {
                        start = Long.parseLong(a);
                        if (!b.isEmpty()) end = Math.min(Long.parseLong(b), total - 1);
                    }
                    partial = true;
                } catch (NumberFormatException ignored) {
                    start = 0;
                    end = total - 1;
                }
            }
        }
        if (start > end || start >= total) {
            start = 0;
            end = total - 1;
            partial = false;
        }

        FileInputStream fis = new FileInputStream(afd.getFileDescriptor());
        fis.getChannel().position(afd.getStartOffset() + start);
        long length = end - start + 1;
        InputStream body = new LimitedStream(fis, length, afd);

        Map<String, String> headers = new HashMap<>();
        headers.put("Accept-Ranges", "bytes");
        headers.put("Content-Length", String.valueOf(length));
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cache-Control", "no-store");
        if (partial) {
            headers.put("Content-Range", "bytes " + start + "-" + end + "/" + total);
        }

        return new WebResourceResponse(
            mimeFor(cr, uri),
            null,
            partial ? 206 : 200,
            partial ? "Partial Content" : "OK",
            headers,
            body
        );
    }

    private String mimeFor(ContentResolver cr, Uri uri) {
        String type = cr.getType(uri);
        if (type != null && type.startsWith("audio/")) return type;
        String last = uri.getLastPathSegment();
        if (last != null) {
            int dot = last.lastIndexOf('.');
            if (dot >= 0) {
                String ext = last.substring(dot + 1).toLowerCase(Locale.ROOT);
                String guess = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                if (guess != null) return guess;
                if (ext.equals("flac")) return "audio/flac";
                if (ext.equals("opus")) return "audio/ogg";
            }
        }
        return type != null ? type : "application/octet-stream";
    }

    private static class LimitedStream extends FilterInputStream {

        private long remaining;
        private final AssetFileDescriptor afd;

        LimitedStream(InputStream in, long limit, AssetFileDescriptor afd) {
            super(in);
            this.remaining = limit;
            this.afd = afd;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) return -1;
            int b = super.read();
            if (b >= 0) remaining--;
            return b;
        }

        @Override
        public int read(byte[] buf, int off, int len) throws IOException {
            if (remaining <= 0) return -1;
            int n = super.read(buf, off, (int) Math.min(len, remaining));
            if (n > 0) remaining -= n;
            return n;
        }

        @Override
        public int available() throws IOException {
            return (int) Math.min(remaining, Integer.MAX_VALUE);
        }

        @Override
        public void close() throws IOException {
            try {
                super.close();
            } finally {
                afd.close();
            }
        }
    }
}
