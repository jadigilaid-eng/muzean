import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeMediaUrl } from './muzeanStorage';

const ORIGIN = 'https://localhost';

test('nativeMediaUrl encodes the whole content URI as a single path segment', () => {
  const uri = 'content://com.android.externalstorage.documents/tree/primary%3AMusic/document/primary%3AMusic%2FAlbum One%2Fa+b.mp3';
  const url = nativeMediaUrl(uri, ORIGIN);
  assert.ok(url.startsWith(`${ORIGIN}/_muzean_media/`));
  const tail = url.slice(`${ORIGIN}/_muzean_media/`.length);
  assert.ok(!tail.includes('/'), 'no raw slash may remain');
  assert.ok(!tail.includes(' '), 'no raw space may remain');
  assert.equal(decodeURIComponent(tail), uri);
});

test('nativeMediaUrl keeps "+" and "%" distinguishable (matches the Java decoder)', () => {
  const tail = nativeMediaUrl('content://x/a+b%20c.mp3', ORIGIN).split('/_muzean_media/')[1];
  assert.ok(tail.includes('%2B'));
  assert.ok(tail.includes('%2520'));
});

test('nativeMediaUrl round-trips unicode file names', () => {
  const uri = 'content://x/Lagu Indonesia/Kasih Tak Sampai – Padi ♪.mp3';
  const tail = nativeMediaUrl(uri, ORIGIN).split('/_muzean_media/')[1];
  assert.equal(decodeURIComponent(tail), uri);
});
