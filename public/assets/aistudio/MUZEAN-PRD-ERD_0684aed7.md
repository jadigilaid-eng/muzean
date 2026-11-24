# MUZEAN --- Master Product & Technical Specification

**Dokumen:** Master PRD + ERD + Blueprint Teknis\
**Versi:** 1.0-draft\
**Tanggal konsolidasi:** 24 November 2026\
**Bahasa:** Indonesia\
**Platform:** Android\
**Nama produk:** MUZEAN

> Dokumen ini mengonsolidasikan keputusan produk yang telah divalidasi.
> Detail yang masih bergantung pada kemampuan Android, codec, DAC, atau
> perangkat ditandai sebagai batas teknis/keputusan terbuka.

## Daftar Isi

1.  [PRD](01-PRD.md)
2.  [ERD](02-ERD.md)
3.  [Arsitektur Android](03-ARSITEKTUR-ANDROID.md)
4.  [Alur Fitur](04-ALUR-FITUR.md)
5.  [Design System](05-DESIGN-SYSTEM.md)
6.  [Audio Engine](06-AUDIO-ENGINE.md)
7.  [Database dan Backup](07-DATABASE-BACKUP-RESTORE.md)
8.  [QA dan Testing](08-QA-TESTING.md)
9.  [Keputusan Teknis Terbuka](09-OPEN-DECISIONS.md)

------------------------------------------------------------------------

# 1. PRD --- Product Requirements Document

## 1.1 Ringkasan

MUZEAN adalah pemutar musik Android lokal (local-first) dengan identitas
visual Retro Windows 95/98 × Vaporwave × Classic Y2K. Aplikasi membaca
koleksi musik dari satu folder root yang dipilih pengguna, mengelola
library, playlist, queue, lirik, EQ, profil DAC, dan kontrol playback
Android.

Tidak ada akun, backend, streaming, atau cloud sync. File audio tetap di
lokasi aslinya. Database dan cache aplikasi tersimpan lokal.

## 1.2 Tujuan

-   Memutar koleksi musik lokal dengan pengalaman yang nyaman.
-   Mengelola library dan playlist secara intuitif.
-   Menyediakan kontrol audio lanjutan dengan batas kemampuan perangkat
    yang jelas.
-   Menjaga identitas visual MUZEAN tetap khas tanpa mengorbankan
    usability.
-   Mendukung background playback, lock screen, notification, headset,
    dan widget Android.

## 1.3 Batas Produk

Tidak termasuk streaming, akun/backend, online lyrics, metadata editing,
beberapa root folder, App Lock, Favorites, dashboard statistik, dan
backup otomatis.

## 1.4 Platform dan Stack

Kotlin, Jetpack Compose, Media3 ExoPlayer, MediaSession, Room,
DataStore, SAF, foreground media playback service. Target SDK dan
minimum SDK diputuskan saat bootstrap proyek.

## 1.5 Requirement Fungsional

### Sumber Musik dan Scan

-   Tepat satu folder root dipilih via Android SAF.
-   Scan rekursif seluruh subfolder, tidak keluar dari root.
-   Persistable URI permission.
-   Scan hanya melalui tombol Pindai Ulang di Settings; tidak ada scan
    otomatis saat app open/background.
-   Rescan mendeteksi file baru, berubah, hilang, corrupt, atau
    unsupported.
-   Jika folder/izin hilang, tampilkan peringatan dan Pilih Folder Baru.
-   Data playlist, history, EQ, lyrics, dan settings dipertahankan
    ketika folder diganti.

### Metadata dan Format

Baca title, artist, album, genre, year, track number, duration, artwork,
embedded lyrics, file URI/path, format/container, codec, bitrate, sample
rate, bit depth, size bila tersedia. Metadata read-only. Target format:
MP3, FLAC, WAV, AAC, M4A, OGG, Opus, ALAC dan format umum; dukungan
bergantung decoder Android/Media3/perangkat. File gagal baca tetap
tercatat dengan status.

### Duplikat

-   Gabungkan sebagai satu entri jika title, artist, album, dan duration
    cocok.
-   Jika metadata tidak lengkap/berbeda, tandai kandidat duplikat dan
    minta konfirmasi.
-   Penggabungan hanya pada representasi library; file asli tidak
    dihapus.
-   Semua file sumber menjadi alternatif pada Song Information.
-   Sumber utama dipilih berdasarkan estimasi kualitas (lossless/lossy,
    codec, bitrate, sample rate, bit depth); jangan bandingkan bitrate
    antar-codec secara naif.
-   Jika sumber utama hilang, fallback ke sumber alternatif.

### Navigasi

Drawer: Lagu, Daftar Putar, Album, Artis, Folder, Pengaturan. Drawer
dapat dibuka dari tombol menu dan swipe tepi kiri. Lebar sekitar 1/4
layar sebagai sasaran, dengan batas minimum agar tetap terbaca.

### Lagu

List item: artwork, title, artist, album, duration, playing indicator.
Sort: title, artist, album, duration, date added. Search partial match
title/artist/album, live results, dibuka dari Quick Access. Swipe kiri
membuka Add to Playlist dan Add to Queue; swipe kanan tanpa aksi khusus.

### Quick Access

Floating circular button; ikon menyebar setengah lingkaran dengan garis
1 px. Akses: Search, Playlist, Artists, Albums, Equalizer.

### Album, Artist, Folder

Album dan Artist memiliki Grid/List toggle. Folder berupa daftar datar
dikelompokkan per folder sumber. Album/artist tanpa artwork diberi
generated Vaporwave artwork unik; komposisi/objek/bentuk/warna berbeda
dan disimpan dalam cache.

### Playlist

Create, rename, delete, add/remove tracks, manual drag reorder.
Tampilkan jumlah lagu dan total durasi. Cover: kolase empat artwork
album pertama; satu lagu gunakan cover itu; tanpa artwork gunakan
generated Vaporwave cover unik. Cache stabil antar sesi. Delete playlist
perlu konfirmasi.

### Smart Playlists dan History

Recently Played, Most Played, Play History dibuat otomatis. Play History
menyimpan tanggal/waktu. Tidak ada Favorites dan dashboard statistik.

### Queue dan Playback

Queue sementara, terpisah dari playlist permanen. Shuffle OFF mengikuti
urutan konteks; Shuffle ON mempertahankan current track dan mengacak
upcoming. Smart Shuffle menghindari lagu baru diputar. Urutan shuffle
tetap sampai shuffle OFF atau queue diganti. Repeat All saja. Previous
selalu ke lagu sebelumnya. Tap lagu dari Album/Artist/Folder/Search
membuat queue dari konteks tersebut; album mengikuti track order,
Artist/Folder mengikuti urutan tampilan. Tambah ke queue tidak mengubah
playlist permanen.

### Now Playing dan Visualizer

Artwork sebagai fokus tanpa mendominasi; title/artist/album,
WMP-inspired visualizer, progress/duration, Play/Pause, Previous, Next,
Shuffle. Secondary: Sleep Timer, Queue, EQ, Lyrics. Visualizer Spectrum,
Waveform, Aurora, Particles, Neon Tunnel dipilih melalui tombol di Now
Playing. Aktif hanya saat halaman terlihat; berhenti di background.
Portrait prioritas; Landscape didukung.

### Sleep Timer

Circular slider 15--120 menit, nilai di tengah, Start/Cancel. Saat habis
stop playback termasuk background. Tidak ada
stop-after-track/album/playlist atau fade-out.

### EQ dan Efek

10-band (31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz), 10 preset +
Manual, gain −12 sampai +12 dB, kurva halus menghubungkan titik, marker
kecil, real-time graph, Reset. Profil global dan per DAC. Efek: Preamp
−12 sampai +12 dB + clipping warning; Spatial Audio
Narrow/Normal/Wide/Extra Wide intensity 0--100%, audition/reset;
ReplayGain Album Gain saja. Tidak ada Bass Boost.

### DAC dan Output

Deteksi USB-C/Bluetooth sejauh Android API memungkinkan. Profil khusus
hanya setelah pengguna mendaftarkan DAC. DAC tak dikenal memakai
konfigurasi standar dan memberi opsi setup. Panel informasi menampilkan
nama, koneksi, status, sample rate/bit depth supported jika tersedia,
output mode, EQ profile aktif. Output mode Automatic default atau
Manual. Validasi dukungan sebelum apply; fallback ke output Android
standar. Passthrough hanya jika didukung. Jangan klaim bit-perfect atau
hardware control universal.

### Crossfade dan Gapless

Crossfade toggle dan durasi 3/5/8/10 detik. Gapless toggle independen.
Bila keduanya aktif, crossfade menjadi transisi aktif; gapless berlaku
ketika crossfade nonaktif. Uji dukungan decoder/output dan jelaskan
interaksi di Settings.

### Lyrics

Tidak ada online lyrics. Embedded lyrics tampil otomatis bila ada.
Manual paste disimpan lokal. Plain text dan LRC. LRC sync, current line
highlight, auto-scroll, tap line seek. Plain text statis dan scrollable
tanpa karaoke. Bottom sheet drag; artwork tetap terlihat. Pilih
Embedded/Manual bila keduanya ada.

### Song Information

Read-only metadata dan audio info teknis. Tampilkan file alternatif
untuk track gabungan, kualitas dan lokasi masing-masing, dan pilihan
sumber aktif. Tidak ada edit metadata.

### Integrasi Android

Playback background/screen off via Media3, MediaSession, foreground
service. MediaStyle notification, lock screen, Quick Settings.
Artwork-based accent jika didukung. Widget 2×2, 4×2, 4×4 dengan artwork,
info, dan controls sesuai ukuran. Tidak ada aksi khusus pada
artwork/info untuk membuka Now Playing. Headset single Play/Pause,
double Next, triple Previous, long press jika device mendukung. Tangani
audio focus/interruption/route change; force-stop menghentikan service
hingga app dibuka kembali.

### Settings

Manual scan, folder picker, EQ, DAC, output quality, Dark/Light manual,
accessibility text Small/Medium/Large dan UI scaling, lyrics, Crossfade,
Gapless, Backup/Restore, Haptic toggle, bahasa Indonesia/English. Theme
icon di kanan atas. Notifikasi mengikuti Android; tanpa toggle app.
Format waktu mengikuti regional Android. Metadata tetap karakter asli.

### Haptics dan Dialog

Haptic untuk interaksi penting dan dapat dimatikan. Konfirmasi aksi
destruktif: delete playlist, manual lyrics, history, DAC profile,
backup/config tertentu. Tidak ada dialog exit. Removing item from
temporary queue tanpa konfirmasi.

### Backup/Restore

Manual only, ZIP, Internal Storage/SD Card via SAF, no
password/encryption. Sertakan playlist, smart playlist definition,
EQ/Preamp, DAC profiles, Spatial Audio, saved lyrics, playback history,
theme/accessibility. Jangan sertakan audio asli. Generated artwork dapat
dibuat ulang.

### Database Recovery

Coba recovery aman otomatis. Jika gagal, tawarkan restore dari backup.
Jika tidak ada, tawarkan database baru dengan peringatan kehilangan
data.

### Bahasa

UI Bahasa Indonesia/English dipilih manual. Metadata ditampilkan dalam
karakter asli tanpa auto-translation. Waktu mengikuti regional Android.

## 1.6 Nonfungsional

Stabilitas playback, tidak scan di luar root, error isolation, UI
accessible, target sentuh sekitar 44 dp, kontras dua tema, responsive
reflow, database migrations, local-only data, performa daftar besar.

## 1.7 Acceptance Criteria

-   Folder root tunggal, SAF permission, scan recursive.
-   Rescan manual hanya di root.
-   Background playback berfungsi.
-   Queue/shuffle/repeat sesuai aturan.
-   Duplicate merge tidak menghapus file fisik.
-   EQ 10 band dan graph halus.
-   Unsupported output fallback.
-   Lyrics LRC sync dan plain text static.
-   ZIP tidak berisi audio.
-   Dark/Light, language, font scale, orientation berfungsi.
-   Error states tidak crash.
-   Metadata non-Latin tampil asli.

## 1.8 Batas Teknis

Codec, DAC, output control, spatial audio, gapless/crossfade, headset
events, notification artwork, dan force-stop behavior bergantung
Android/device/decoder. Implementasi wajib capability-gated dan diuji.

------------------------------------------------------------------------

# 2. ERD

## 2.1 Model Data

Room/SQLite lokal. Pisahkan `Track` logis dari `TrackSource` fisik agar
duplicate source tetap tersedia.

## 2.2 Entitas Utama

-   `Track(trackId PK, displayTitle, displayArtist, displayAlbum, normalizedTitle, normalizedArtist, normalizedAlbum, durationMs, genre, year, trackNumber, primarySourceId FK, availabilityStatus, createdAt, updatedAt)`
-   `TrackSource(sourceId PK, trackId FK, documentUri, relativePath, fileName, mimeType, containerFormat, codec, bitrateBps, sampleRateHz, bitDepth, fileSizeBytes, modifiedAt, sourceStatus, qualityScore, isPrimary, lastScannedAt)`
-   `DuplicateCandidate(candidateId PK, sourceTrackId FK, targetTrackId FK, matchReason, status, createdAt, resolvedAt)`
-   `Album(albumId PK, name, normalizedName, artistDisplay, year, artworkCacheKey, artworkOrigin)`
-   `Artist(artistId PK, name, normalizedName, artworkCacheKey, artworkOrigin)`
-   `TrackAlbum(trackId FK, albumId FK, role, composite PK)`
-   `TrackArtist(trackId FK, artistId FK, role, composite PK)`
-   `Playlist(playlistId PK, name, playlistType, smartType, sortMode, artworkCacheKey, createdAt, updatedAt)`
-   `PlaylistTrack(playlistId FK, trackId FK, position, addedAt, composite PK)`
-   `PlaybackQueueItem(queueItemId PK, trackId FK, position, sourceContextType, sourceContextId, addedAt, shuffleRank)`
-   `PlaybackSession(sessionId PK, startedAt, endedAt, queueContext, shuffleEnabled, repeatMode, currentQueueItemId)`
-   `PlayHistory(historyId PK, trackId FK nullable, sourceId FK nullable, playedAt, durationPlayedMs, completed, sessionId FK)`
-   `TrackPlayCount(trackId PK/FK, playCount, lastPlayedAt)`
-   `Lyrics(lyricsId PK, trackId FK, sourceType, format, content, languageTag, createdAt, updatedAt)`
-   `DACProfile(dacProfileId PK, deviceFingerprint, displayName, connectionType, enabled, eqConfigId FK, outputMode, preferredSampleRateHz, preferredBitDepth, createdAt, updatedAt)`
-   `EQConfig(eqConfigId PK, name, scope, presetKey, isManual, preampDb, spatialPreset, spatialIntensity, replayGainAlbumEnabled, createdAt, updatedAt)`
-   `EQBand(eqBandId PK, eqConfigId FK, frequencyHz, gainDb, position)`
-   `AppSettings(settingsId PK, language, theme, textScale, uiScale, hapticsEnabled, crossfadeEnabled, crossfadeDurationSec, gaplessEnabled, outputMode, preferredSampleRateHz, preferredBitDepth, lyricsDisplayMode, updatedAt)`
-   `MusicRoot(musicRootId PK, treeUri, displayName, permissionPersisted, lastScanAt, rootStatus)`
-   `ScanRun(scanRunId PK, startedAt, finishedAt, status, filesDiscovered, filesAdded, filesUpdated, filesMissing, filesFailed, errorSummary)`
-   `ArtworkCache(artworkCacheKey PK, ownerType, ownerId, localPath, generationSeed, sourceHash, createdAt)`
-   `BackupRecord(backupId PK, uri, createdAt, appVersion, schemaVersion, backupStatus, contentSummary)`

## 2.3 Relasi

-   Track 1:N TrackSource.
-   Track 1:N Lyrics.
-   Track N:N Album melalui TrackAlbum.
-   Track N:N Artist melalui TrackArtist.
-   Playlist N:N Track melalui PlaylistTrack.
-   Track 1:N PlayHistory.
-   Track 1:1 TrackPlayCount.
-   PlaybackSession 1:N PlayHistory.
-   EQConfig 1:N EQBand.
-   DACProfile N:1 EQConfig.
-   MusicRoot 1:N ScanRun secara konseptual.
-   ArtworkCache berelasi polimorfik ke owner.

## 2.4 ERD Mermaid

``` mermaid
erDiagram
    TRACK ||--o{ TRACK_SOURCE : has
    TRACK ||--o{ LYRICS : has
    TRACK ||--o{ PLAY_HISTORY : appears_in
    TRACK ||--|| TRACK_PLAY_COUNT : counted_by
    TRACK }o--o{ ALBUM : belongs_to
    TRACK }o--o{ ARTIST : performed_by
    PLAYLIST ||--o{ PLAYLIST_TRACK : contains
    TRACK ||--o{ PLAYLIST_TRACK : listed_in
    PLAYBACK_SESSION ||--o{ PLAY_HISTORY : records
    EQ_CONFIG ||--o{ EQ_BAND : defines
    EQ_CONFIG ||--o{ DAC_PROFILE : assigned_to
    TRACK ||--o{ DUPLICATE_CANDIDATE : source_or_target
    MUSIC_ROOT ||--o{ SCAN_RUN : scanned_by
```

## 2.5 Indeks dan Constraint

-   Index normalized title/artist/album and duration.
-   Unique `TrackSource.documentUri`.
-   Index `TrackSource.trackId`, `sourceStatus`, `isPrimary`.
-   Unique `PlaylistTrack(playlistId, trackId)`.
-   Index `PlaylistTrack(playlistId, position)`.
-   Index history by playedAt and trackId.
-   Unique `EQBand(eqConfigId, frequencyHz)`.
-   Avoid cascade delete Track when source disappears.
-   Smart playlists should be query-backed rather than duplicated static
    rows.
-   Queue is temporary, not a permanent playlist.

------------------------------------------------------------------------

# 3. Arsitektur Android

## 3.1 Stack

Kotlin, Jetpack Compose, MVVM + Repository, Room, DataStore, Media3
ExoPlayer, MediaSession, foreground media playback service, SAF,
app-private artwork cache, Gradle Kotlin DSL.

## 3.2 Layers

-   Presentation: Compose, ViewModel, navigation, design system.
-   Domain: use cases and domain models.
-   Data: Room DAO/entity, repositories, SAF scanner, metadata
    extractor, artwork cache, DataStore.
-   Playback: service, ExoPlayer, MediaSession, queue controller, audio
    processing.

## 3.3 Struktur Folder

``` text
app/src/main/
  AndroidManifest.xml
  java/com/muzean/
    MuzeanApp.kt
    MainActivity.kt
    core/
      common/
      designsystem/{theme,typography,components,icons,motion}/
      navigation/
      permissions/
    data/
      local/{room/{dao,entity,migrations},datastore}/
      music/{saf,scanner,metadata,artwork}/
      repository/
    domain/{model,repository,usecase}/
    feature/
      library/ playlists/ albums/ artists/ folders/
      nowplaying/ queue/ lyrics/ equalizer/ dac/
      settings/ songinfo/ backup/
    playback/{service,player,session,queue,audio}/
    widget/
    di/
```

## 3.4 Alur Utama

Scan: Settings UI → ViewModel → UseCase → Scanner → SAF → Metadata →
Room → Repository → UI.\
Playback: UI → PlaybackRepository → MediaSession/Service → ExoPlayer.\
Settings: UI → ViewModel → DataStore → audio configuration validation.\
Backup: UI → snapshot → manifest/payload → ZIP → SAF.

## 3.5 Lifecycle dan Permissions

Gunakan SAF persistable read permission. Foreground service dan
notification permission mengikuti versi Android/target SDK. Tangani
revoked URI, file missing, USB/Bluetooth disconnect, audio focus,
process death. Hindari broad storage permission.

------------------------------------------------------------------------

# 4. Alur Fitur

-   Onboarding: pilih folder via SAF, simpan permission, masuk library;
    scan hanya lewat aksi manual.
-   Rescan: recursive enumeration, upsert baru/berubah, mark missing,
    catat error.
-   Duplicate: exact metadata+duration merge; incomplete metadata
    candidate confirmation; file source alternatives.
-   Queue: context-based, shuffle upcoming only, Repeat All.
-   Playback state: IDLE, BUFFERING, READY/PLAYING, PAUSED, ENDED,
    ERROR.
-   Lyrics: embedded/manual, LRC sync, plain scroll.
-   DAC: detect → match profile → validate → apply or fallback.
-   Backup: snapshot → manifest → ZIP; restore validate → summary →
    confirm → transactional restore.
-   Recovery: safe repair → backup restore → initialize new database
    only with warning.

------------------------------------------------------------------------

# 5. Design System

Retro Windows 95/98 × Vaporwave × Classic Y2K. Motif: classic
windows/panels, CD/cassette/CRT/equalizer, night sky/stars/moon/sunset
grid, chrome/metallic/translucency. Dials: Energy 3 Bold, Rhythm 3
Variatif, Motion 2 responsive.

Dark/Light manual. Artwork accent may color Now Playing/notification if
supported. Drawer via button/swipe, target width around 1/4 screen with
minimum readability. Quick Access half-circle. Album/Artist Grid/List.
Now Playing artwork, visualizer, controls. Lyrics bottom sheet. EQ
smooth curve. Accessibility: 44 dp touch targets, TalkBack labels,
contrast, focus order, no color-only status, responsive reflow, reduced
motion.

Logo: icon-only CD/Vinyl with Vaporwave × Classic Y2K. Logo artwork
itself is not part of this document deliverable.

------------------------------------------------------------------------

# 6. Audio Engine

-   Media3 ExoPlayer + MediaSession + foreground playback service.
-   Audio focus and route changes.
-   Format support depends on decoders.
-   Queue controller handles shuffle/repeat/context.
-   10-band EQ, 10 presets + Manual.
-   Preamp −12..+12 dB, clipping warning.
-   Spatial presets and intensity, capability-gated.
-   ReplayGain Album Gain only.
-   Crossfade 3/5/8/10 sec; Gapless independent; Crossfade takes
    precedence when both enabled.
-   DAC profile USB/Bluetooth; Automatic default or Manual sample
    rate/bit depth.
-   Fallback to standard Android output when unsupported.
-   No universal bit-perfect/hardware-control claims.

------------------------------------------------------------------------

# 7. Database, Backup, Restore

Room entities are listed in Section 2. Store audio as SAF references,
not copied files. Use schema migrations, transactions, indexes, and
conservative deletion. DataStore is preferred for app preferences; keep
one source of truth.

Manual ZIP backup to internal storage or SD card via SAF. Include
playlists, smart playlist definitions, EQ/Preamp, DAC profiles, Spatial
Audio, lyrics, history, theme/accessibility. Exclude original audio. No
password/encryption. Manifest contains app/schema version and checksums.
Restore validates and previews before confirmation. Recovery attempts
safe repair then offers restore.

------------------------------------------------------------------------

# 8. QA dan Testing

Test folder scope/permission, rescan, duplicate grouping, corrupt files,
codec matrix, queue/shuffle/repeat, background playback,
notification/lock screen/widget, audio focus, USB/Bluetooth route
changes, EQ/DAC/output, crossfade/gapless, lyrics, backup/restore,
database recovery, dark/light, language, font scaling,
portrait/landscape, TalkBack, reduced motion, and error states.

Release blockers: background playback instability, scan outside root,
unsafe restore, corrupt-file crash, inaccessible primary controls, or
unverifiable audio claims.

------------------------------------------------------------------------

# 9. Keputusan Teknis Terbuka

1.  Minimum/target SDK.
2.  Versi Kotlin, Compose, Media3, Room, Gradle.
3.  Hilt atau Koin.
4.  Single-module atau multi-module.
5.  Toleransi durasi untuk duplicate matching.
6.  Scoring kualitas file lintas codec.
7.  Identitas DAC dan kapabilitas output.
8.  Implementasi Spatial Audio, passthrough, Crossfade, Gapless sesuai
    dukungan.
9.  Algoritma generated artwork dan cache.
10. Rentang history Smart Shuffle.
11. Format manifest ZIP dan kebijakan migrasi.
12. Recovery/rollback database.

## Catatan Akhir

Dokumen ini merupakan baseline spesifikasi. Bagian yang bergantung pada
Android API, decoder, perangkat, atau DAC harus diuji pada perangkat
nyata. Jangan mengubah keputusan produk yang sudah ditetapkan tanpa
revisi requirement dan acceptance criteria.
