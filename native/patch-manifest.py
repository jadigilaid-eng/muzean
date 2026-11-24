#!/usr/bin/env python3
"""Adds the playback service, receiver and permissions to the generated AndroidManifest.xml (idempotent)."""
import sys

path = sys.argv[1]
s = open(path, encoding="utf-8").read()
if "PlaybackService" not in s:
    perms = (
        '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\n'
        '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />\n'
        '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n'
        '    <uses-permission android:name="android.permission.WAKE_LOCK" />\n'
    )
    comps = (
        '        <service android:name=".PlaybackService" android:exported="false" android:foregroundServiceType="mediaPlayback" />\n'
        '        <receiver android:name=".PlaybackReceiver" android:exported="false" />\n'
    )
    assert "</application>" in s and "<application" in s
    s = s.replace("</application>", comps + "    </application>", 1)
    i = s.index("<application")
    s = s[:i] + perms.lstrip() + "    " + s[i:]
open(path, "w", encoding="utf-8").write(s)
