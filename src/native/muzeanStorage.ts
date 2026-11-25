import { Capacitor, registerPlugin } from '@capacitor/core';

export interface NativeAudioEntry {
  uri: string;
  name: string;
  relativePath: string;
  size: number;
  lastModified: number;
  mimeType: string;
}

interface MuzeanStoragePlugin {
  pickFolder(): Promise<{ treeUri: string; displayName: string }>;
  scan(options: { treeUri: string }): Promise<{ rootName: string; files: NativeAudioEntry[] }>;
  hasPermission(options: { treeUri: string }): Promise<{ granted: boolean }>;
  updatePlayback(options: { title: string; artist: string; playing: boolean }): Promise<void>;
  stopPlayback(): Promise<void>;
  pinWidget(): Promise<{ supported: boolean; requested: boolean }>;
  addListener(
    eventName: 'mediaAction',
    listener: (event: { action: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const MuzeanStorage = registerPlugin<MuzeanStoragePlugin>('MuzeanStorage');

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/** URL the WebView can stream (with Range support) for a SAF content:// document. */
export function nativeMediaUrl(contentUri: string, origin: string = window.location.origin): string {
  return `${origin}/_muzean_media/${encodeURIComponent(contentUri)}`;
}

const HEAD_BYTES = 64 * 1024;

/**
 * Reads only the first 64 KB of a native file so ID3 tags can be parsed without loading the whole track.
 * Uses a plain streamed fetch and cancels it early: fetch() with a Range header is rejected by the WebView
 * when the response comes from shouldInterceptRequest (verified on an emulator).
 */
export async function readNativeHead(entry: NativeAudioEntry): Promise<File> {
  const chunks: Uint8Array[] = [];
  let received = 0;
  const controller = new AbortController();
  try {
    const res = await fetch(nativeMediaUrl(entry.uri), { signal: controller.signal });
    const reader = res.body?.getReader();
    if (reader) {
      while (received < HEAD_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        received += value.byteLength;
      }
      void reader.cancel().catch(() => undefined);
    } else {
      const buf = new Uint8Array(await res.arrayBuffer());
      chunks.push(buf.subarray(0, HEAD_BYTES));
    }
  } catch {
    // fall through with whatever was read; metadata falls back to the file name
  } finally {
    controller.abort();
  }
  return new File(chunks as BlobPart[], entry.name, { type: entry.mimeType, lastModified: entry.lastModified });
}
