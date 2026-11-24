package com.muzean.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class MediaHttpTest {

    private static final long TOTAL = 10_000;

    @Test
    public void noHeaderReturnsWholeResource() {
        MediaHttp.Range r = MediaHttp.parseRange(null, TOTAL);
        assertFalse(r.partial);
        assertEquals(0, r.start);
        assertEquals(TOTAL - 1, r.end);
        assertEquals(TOTAL, r.length());
    }

    @Test
    public void boundedRange() {
        MediaHttp.Range r = MediaHttp.parseRange("bytes=100-199", TOTAL);
        assertTrue(r.partial);
        assertEquals(100, r.start);
        assertEquals(199, r.end);
        assertEquals(100, r.length());
    }

    @Test
    public void openEndedRange() {
        MediaHttp.Range r = MediaHttp.parseRange("bytes=9990-", TOTAL);
        assertTrue(r.partial);
        assertEquals(9990, r.start);
        assertEquals(9999, r.end);
        assertEquals(10, r.length());
    }

    @Test
    public void suffixRange() {
        MediaHttp.Range r = MediaHttp.parseRange("bytes=-16", TOTAL);
        assertTrue(r.partial);
        assertEquals(9984, r.start);
        assertEquals(9999, r.end);
    }

    @Test
    public void suffixLargerThanFileStartsAtZero() {
        MediaHttp.Range r = MediaHttp.parseRange("bytes=-99999", TOTAL);
        assertTrue(r.partial);
        assertEquals(0, r.start);
        assertEquals(TOTAL - 1, r.end);
    }

    @Test
    public void endIsClampedToFileSize() {
        MediaHttp.Range r = MediaHttp.parseRange("bytes=9000-99999", TOTAL);
        assertTrue(r.partial);
        assertEquals(9999, r.end);
    }

    @Test
    public void unsatisfiableOrMalformedFallsBackToWhole() {
        String[] bad = { "bytes=20000-", "bytes=200-100", "bytes=abc-def", "bytes=", "bytes=-", "bytes=-0", "items=0-1", "garbage" };
        for (String header : bad) {
            MediaHttp.Range r = MediaHttp.parseRange(header, TOTAL);
            assertFalse(header, r.partial);
            assertEquals(header, 0, r.start);
            assertEquals(header, TOTAL - 1, r.end);
        }
    }

    @Test
    public void onlyFirstRangeOfMultiRangeIsServed() {
        MediaHttp.Range r = MediaHttp.parseRange("bytes=0-9, 20-29", TOTAL);
        assertTrue(r.partial);
        assertEquals(0, r.start);
        assertEquals(9, r.end);
    }

    @Test
    public void unknownLengthNeverReportsPartial() {
        assertFalse(MediaHttp.parseRange("bytes=0-9", 0).partial);
        assertFalse(MediaHttp.parseRange("bytes=0-9", -1).partial);
    }

    @Test
    public void decodesSafDocumentUri() {
        String encoded =
            "/_muzean_media/content%3A%2F%2Fcom.android.externalstorage.documents%2Ftree%2Fprimary%253AMusic%2Fdocument%2Fprimary%253AMusic%252FAlbum%2520One%252Fa%2520b.mp3";
        assertEquals(
            "content://com.android.externalstorage.documents/tree/primary%3AMusic/document/primary%3AMusic%2FAlbum%20One%2Fa%20b.mp3",
            MediaHttp.decodePath(encoded)
        );
    }

    @Test
    public void keepsPlusSignsInFileNames() {
        assertEquals("content://x/a+b.mp3", MediaHttp.decodePath("/_muzean_media/content%3A%2F%2Fx%2Fa%2Bb.mp3"));
    }

    @Test
    public void rejectsOtherPaths() {
        assertNull(MediaHttp.decodePath(null));
        assertNull(MediaHttp.decodePath("/index.html"));
        assertNull(MediaHttp.decodePath("/_muzean_media/"));
        assertNull(MediaHttp.decodePath("/_capacitor_content_/foo"));
    }
}
