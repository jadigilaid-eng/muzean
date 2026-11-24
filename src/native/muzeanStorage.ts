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
}

export const MuzeanStorage = registerPlugin<MuzeanStoragePlugin>('MuzeanStorage');

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/** URL the WebView can stream (with Range support) for a SAF content:// document. */
export function nativeMediaUrl(contentUri: string): string {
  return `${window.location.origin}/_muzean_media/${encodeURIComponent(contentUri)}`;
}

/** Reads only the first 64 KB of a native file so ID3 tags can be parsed without loading the whole track. */
export async function readNativeHead(entry: NativeAudioEntry): Promise<File> {
  let buffer: ArrayBuffer = new ArrayBuffer(0);
  try {
    const res = await fetch(nativeMediaUrl(entry.uri), { headers: { Range: 'bytes=0-65535' } });
    buffer = await res.arrayBuffer();
  } catch {
    // fall through with an empty head; metadata falls back to the file name
  }
  return new File([buffer], entry.name, { type: entry.mimeType, lastModified: entry.lastModified });
}
