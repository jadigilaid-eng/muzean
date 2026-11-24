package com.muzean.app;

import android.content.ContentResolver;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceResponse;
import java.io.FileInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Streams a content:// (or file://) document with HTTP Range support. */
final class MediaServer {

    private MediaServer() {}

    static WebResourceResponse serve(ContentResolver cr, String contentUri, String rangeHeader) throws IOException {
        Uri uri = Uri.parse(contentUri);
        AssetFileDescriptor afd = cr.openAssetFileDescriptor(uri, "r");
        if (afd == null) throw new IOException("cannot open " + contentUri);
        try {
            long total = afd.getLength();
            if (total < 0) {
                total = afd.getParcelFileDescriptor().getStatSize();
            }
            boolean known = total > 0;
            MediaHttp.Range range = MediaHttp.parseRange(rangeHeader, total);

            FileInputStream fis = new FileInputStream(afd.getFileDescriptor());
            positionStream(fis, afd.getStartOffset() + (known ? range.start : 0));
            InputStream body = new LimitedStream(fis, known ? range.length() : Long.MAX_VALUE, afd);

            Map<String, String> headers = new HashMap<>();
            headers.put("Accept-Ranges", "bytes");
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "no-store");
            if (known) {
                headers.put("Content-Length", String.valueOf(range.length()));
                if (range.partial) {
                    headers.put("Content-Range", "bytes " + range.start + "-" + range.end + "/" + total);
                }
            }
            boolean partial = known && range.partial;
            return new WebResourceResponse(
                mimeFor(cr, uri),
                null,
                partial ? 206 : 200,
                partial ? "Partial Content" : "OK",
                headers,
                body
            );
        } catch (IOException | RuntimeException e) {
            afd.close();
            throw e;
        }
    }

    /** Seeks when the provider hands out a seekable fd, otherwise skips forward (pipes). */
    private static void positionStream(FileInputStream fis, long offset) throws IOException {
        try {
            fis.getChannel().position(offset);
        } catch (IOException e) {
            long left = offset;
            while (left > 0) {
                long skipped = fis.skip(left);
                if (skipped <= 0) break;
                left -= skipped;
            }
        }
    }

    static String mimeFor(ContentResolver cr, Uri uri) {
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

    private static final class LimitedStream extends FilterInputStream {

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
