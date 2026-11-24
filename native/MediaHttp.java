package com.muzean.app;

import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;

/** Pure-Java helpers (no Android classes) so they can be unit-tested on the JVM. */
final class MediaHttp {

    static final String PREFIX = "/_muzean_media/";

    private MediaHttp() {}

    /** Byte range resolved against a known total length. {@code end} is inclusive. */
    static final class Range {

        final long start;
        final long end;
        final boolean partial;

        Range(long start, long end, boolean partial) {
            this.start = start;
            this.end = end;
            this.partial = partial;
        }

        long length() {
            return end - start + 1;
        }
    }

    /**
     * Parses an HTTP Range header. Anything unsatisfiable or malformed falls back to the whole
     * resource (status 200) instead of failing, which is what the media element copes with best.
     */
    static Range parseRange(String header, long total) {
        Range whole = new Range(0, total - 1, false);
        if (total <= 0 || header == null || !header.startsWith("bytes=")) return whole;
        String spec = header.substring(6).split(",")[0].trim();
        int dash = spec.indexOf('-');
        if (dash < 0) return whole;
        String a = spec.substring(0, dash).trim();
        String b = spec.substring(dash + 1).trim();
        try {
            long start;
            long end;
            if (a.isEmpty()) {
                if (b.isEmpty()) return whole;
                long suffix = Long.parseLong(b);
                if (suffix <= 0) return whole;
                start = Math.max(0, total - suffix);
                end = total - 1;
            } else {
                start = Long.parseLong(a);
                end = b.isEmpty() ? total - 1 : Math.min(Long.parseLong(b), total - 1);
            }
            if (start < 0 || start >= total || end < start) return whole;
            return new Range(start, end, true);
        } catch (NumberFormatException e) {
            return whole;
        }
    }

    /**
     * Turns the encoded request path /_muzean_media/&lt;encodeURIComponent(contentUri)&gt; back into the
     * original content URI, or returns null when the path is not a media path.
     */
    static String decodePath(String encodedPath) {
        if (encodedPath == null || !encodedPath.startsWith(PREFIX)) return null;
        String rest = encodedPath.substring(PREFIX.length());
        if (rest.isEmpty()) return null;
        try {
            // encodeURIComponent never emits a raw '+', so URLDecoder's '+' handling cannot misfire.
            return URLDecoder.decode(rest, "UTF-8");
        } catch (UnsupportedEncodingException | IllegalArgumentException e) {
            return null;
        }
    }
}
