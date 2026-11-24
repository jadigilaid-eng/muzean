import type { ArtworkCacheEntry, PlaylistTrack, Track } from './types';

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const VAPORWAVE_PALETTES = [
  { skyTop: '#160B30', skyMid: '#4C1D7A', skyBot: '#E84A9B', sunTop: '#FFE066', sunBot: '#FF4F8B', grid: '#24E5D8', accent: '#FFFFFF' },
  { skyTop: '#0B1B36', skyMid: '#1D4478', skyBot: '#38B2AC', sunTop: '#FBD38D', sunBot: '#F687B3', grid: '#F687B3', accent: '#E2E8F0' },
  { skyTop: '#23092D', skyMid: '#7C1D6F', skyBot: '#F97316', sunTop: '#FEF08A', sunBot: '#EC4899', grid: '#A78BFA', accent: '#FDF2F8' },
  { skyTop: '#0F172A', skyMid: '#312E81', skyBot: '#06B6D4', sunTop: '#FDE047', sunBot: '#FB7185', grid: '#22D3EE', accent: '#F8FAFC' },
  { skyTop: '#1E1133', skyMid: '#581C87', skyBot: '#EC4899', sunTop: '#67E8F9', sunBot: '#C084FC', grid: '#38BDF8', accent: '#FAF5FF' },
  { skyTop: '#18181B', skyMid: '#3F3F46', skyBot: '#14B8A6', sunTop: '#FDE68A', sunBot: '#F43F5E', grid: '#2DD4BF', accent: '#F4F4F5' },
];

/**
 * Generates a unique, deterministic Vaporwave SVG artwork Data URI for any album, artist, or playlist.
 * Different seeds vary palette, celestial object (striped sun, ringed planet, crescent moon, chrome CD),
 * horizon silhouette (grid mountains, skyline, palm curve), and geometric frame.
 */
export function generateVaporwaveArtworkDataUri(seedKey: string): string {
  const hash = hashString(seedKey || 'MUZEAN');
  const palette = VAPORWAVE_PALETTES[hash % VAPORWAVE_PALETTES.length];
  const motif = (hash >>> 3) % 4; // 0: Sunset Grid, 1: Ringed Planet, 2: Chrome CD Disc, 3: Night Crescent & Grid
  const starOffset = (hash >>> 6) % 50;
  const sunX = 110 + ((hash >>> 9) % 40) - 20;
  const sunY = 92 + ((hash >>> 12) % 16) - 8;

  const stars = Array.from({ length: 14 }, (_, i) => {
    const sx = ((hash * (i + 3) + i * 37 + starOffset) % 200) + 10;
    const sy = ((hash * (i + 7) + i * 23) % 88) + 8;
    const r = (i % 3) === 0 ? 1.4 : 0.8;
    return `<circle cx="${sx}" cy="${sy}" r="${r}" fill="${palette.accent}" opacity="${0.45 + (i % 4) * 0.14}"/>`;
  }).join('');

  const gridLines = [
    ...Array.from({ length: 7 }, (_, i) => {
      const y = 132 + i * i * 2.2;
      return `<line x1="0" y1="${y.toFixed(1)}" x2="220" y2="${y.toFixed(1)}" stroke="${palette.grid}" stroke-width="1" opacity="0.72"/>`;
    }),
    ...Array.from({ length: 9 }, (_, i) => {
      const xBottom = -40 + i * 38;
      return `<line x1="110" y1="130" x2="${xBottom}" y2="220" stroke="${palette.grid}" stroke-width="1" opacity="0.65"/>`;
    }),
  ].join('');

  let centerpiece = '';
  if (motif === 0) {
    // Striped Vaporwave Sunset
    centerpiece = `
      <circle cx="${sunX}" cy="${sunY}" r="42" fill="url(#sunGrad)"/>
      <rect x="${sunX - 44}" y="${sunY + 6}" width="88" height="4" fill="${palette.skyBot}"/>
      <rect x="${sunX - 44}" y="${sunY + 15}" width="88" height="5" fill="${palette.skyBot}"/>
      <rect x="${sunX - 44}" y="${sunY + 25}" width="88" height="7" fill="${palette.skyMid}"/>
    `;
  } else if (motif === 1) {
    // Ringed Planet
    centerpiece = `
      <circle cx="${sunX}" cy="${sunY - 6}" r="32" fill="url(#sunGrad)"/>
      <ellipse cx="${sunX}" cy="${sunY - 4}" rx="58" ry="12" transform="rotate(-18 ${sunX} ${sunY - 4})" fill="none" stroke="${palette.grid}" stroke-width="3" opacity="0.88"/>
      <ellipse cx="${sunX}" cy="${sunY - 4}" rx="48" ry="8" transform="rotate(-18 ${sunX} ${sunY - 4})" fill="none" stroke="${palette.accent}" stroke-width="1" opacity="0.6"/>
    `;
  } else if (motif === 2) {
    // Classic Y2K Chrome CD Disc
    centerpiece = `
      <circle cx="${sunX}" cy="${sunY - 4}" r="42" fill="url(#sunGrad)" stroke="${palette.accent}" stroke-width="1.5"/>
      <circle cx="${sunX}" cy="${sunY - 4}" r="14" fill="${palette.skyTop}" stroke="${palette.grid}" stroke-width="2"/>
      <circle cx="${sunX}" cy="${sunY - 4}" r="6" fill="${palette.skyMid}"/>
      <path d="M ${sunX - 30} ${sunY - 30} L ${sunX + 30} ${sunY + 22}" stroke="${palette.accent}" stroke-width="1.5" opacity="0.45"/>
    `;
  } else {
    // Night Moon Crescent + Synth Peaks
    centerpiece = `
      <circle cx="${sunX}" cy="${sunY - 12}" r="32" fill="url(#sunGrad)"/>
      <circle cx="${sunX + 12}" cy="${sunY - 18}" r="26" fill="${palette.skyMid}"/>
      <polygon points="0,130 42,96 76,130" fill="${palette.skyTop}" opacity="0.85"/>
      <polygon points="135,130 176,92 220,130" fill="${palette.skyTop}" opacity="0.85"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="220" height="220">
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${palette.skyTop}"/>
        <stop offset="55%" stop-color="${palette.skyMid}"/>
        <stop offset="100%" stop-color="${palette.skyBot}"/>
      </linearGradient>
      <linearGradient id="sunGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${palette.sunTop}"/>
        <stop offset="100%" stop-color="${palette.sunBot}"/>
      </linearGradient>
    </defs>
    <rect width="220" height="220" fill="url(#skyGrad)"/>
    ${stars}
    ${centerpiece}
    <rect x="0" y="130" width="220" height="90" fill="${palette.skyTop}" opacity="0.82"/>
    <line x1="0" y1="130" x2="220" y2="130" stroke="${palette.grid}" stroke-width="1.5"/>
    ${gridLines}
    <rect x="0" y="0" width="220" height="220" fill="none" stroke="${palette.accent}" stroke-opacity="0.18" stroke-width="2"/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getOrCreateCachedArtwork(
  cache: Record<string, ArtworkCacheEntry>,
  ownerType: ArtworkCacheEntry['ownerType'],
  ownerId: string,
  seed: string,
  now = Date.now()
): { key: string; dataUri: string; createdEntry?: ArtworkCacheEntry } {
  const key = `art_${ownerType.toLowerCase()}_${ownerId}`;
  const existing = cache[key];
  if (existing) {
    return { key, dataUri: existing.dataUri };
  }
  const dataUri = generateVaporwaveArtworkDataUri(`${ownerType}:${seed}`);
  const createdEntry: ArtworkCacheEntry = {
    artworkCacheKey: key,
    ownerType,
    ownerId,
    dataUri,
    generationSeed: seed,
    sourceHash: hashString(seed).toString(16),
    createdAt: now,
  };
  return { key, dataUri, createdEntry };
}

/**
 * Resolves playlist cover representation per PRD:
 * - 1 track -> use that track/album's cover
 * - >=2 tracks -> up to 4 unique album covers for 2x2 collage
 * - 0 tracks or no artwork -> unique generated Vaporwave artwork
 */
export function resolvePlaylistCoverArts(
  playlistId: string,
  playlistName: string,
  playlistTracks: PlaylistTrack[],
  tracksById: Map<string, Track>,
  artworkCache: Record<string, ArtworkCacheEntry>
): { mode: 'COLLAGE' | 'SINGLE'; uris: string[] } {
  const ordered = playlistTracks
    .filter((pt) => pt.playlistId === playlistId)
    .sort((a, b) => a.position - b.position);

  if (ordered.length === 0) {
    return {
      mode: 'SINGLE',
      uris: [generateVaporwaveArtworkDataUri(`PLAYLIST:${playlistId}:${playlistName}`)],
    };
  }

  const seenAlbums = new Set<string>();
  const uris: string[] = [];

  for (const pt of ordered) {
    const trk = tracksById.get(pt.trackId);
    if (!trk) continue;
    const albumKey = trk.normalizedAlbum || trk.trackId;
    if (seenAlbums.has(albumKey)) continue;
    seenAlbums.add(albumKey);

    const artUri =
      (trk.artworkCacheKey && artworkCache[trk.artworkCacheKey]?.dataUri) ||
      generateVaporwaveArtworkDataUri(`ALBUM:${trk.displayAlbum}:${trk.displayArtist}`);
    uris.push(artUri);
    if (uris.length === 4) break;
  }

  if (uris.length === 0) {
    return {
      mode: 'SINGLE',
      uris: [generateVaporwaveArtworkDataUri(`PLAYLIST:${playlistId}:${playlistName}`)],
    };
  }

  if (uris.length < 4) {
    return { mode: 'SINGLE', uris: [uris[0]] };
  }

  return { mode: 'COLLAGE', uris };
}
