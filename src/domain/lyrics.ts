export interface LrcLine {
  timeMs: number;
  text: string;
}

const TIMESTAMP_REGEX = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const METADATA_TAG_REGEX = /^\[(ar|ti|al|by|offset|re|ve):.*\]$/i;

export function parseLrcLyrics(raw: string): { isLrc: boolean; lines: LrcLine[]; plainLines: string[] } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { isLrc: false, lines: [], plainLines: [] };
  }

  const parsedLrc: LrcLine[] = [];
  const rawLines = trimmed.split(/\r?\n/);

  for (const line of rawLines) {
    if (METADATA_TAG_REGEX.test(line.trim())) continue;

    const matches = [...line.matchAll(TIMESTAMP_REGEX)];
    if (matches.length === 0) continue;

    const cleanText = line.replace(TIMESTAMP_REGEX, '').trim();
    for (const match of matches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fracStr = match[3] ?? '0';
      const millis =
        fracStr.length === 3
          ? parseInt(fracStr, 10)
          : fracStr.length === 2
          ? parseInt(fracStr, 10) * 10
          : parseInt(fracStr, 10) * 100;
      const timeMs = minutes * 60_000 + seconds * 1_000 + millis;
      parsedLrc.push({ timeMs, text: cleanText || '···' });
    }
  }

  if (parsedLrc.length > 0) {
    parsedLrc.sort((a, b) => a.timeMs - b.timeMs);
    return {
      isLrc: true,
      lines: parsedLrc,
      plainLines: parsedLrc.map((l) => l.text),
    };
  }

  return {
    isLrc: false,
    lines: [],
    plainLines: rawLines,
  };
}

export function getActiveLrcLineIndex(lines: LrcLine[], currentTimeMs: number): number {
  if (lines.length === 0) return -1;
  let active = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= currentTimeMs + 80) {
      active = i;
    } else {
      break;
    }
  }
  return active;
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
