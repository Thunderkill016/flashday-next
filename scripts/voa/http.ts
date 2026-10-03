/*
 * FD-VOA-CORPUS-01 §53 — crawler ethics.
 *
 * One request every ~1.2s with jitter, exponential backoff on failure
 * (VOA returns 200 + empty body under load — treated as retryable),
 * disk cache so re-runs never re-fetch unchanged pages.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CACHE_DIR = 'content-corpus/voa/cache';
const UA = 'FlashDayCorpusBuilder/1.0 (+https://github.com/Thunderkill016/flashday-next; respectful research crawler)';
const MIN_GAP_MS = 1200;
let lastReq = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function cachePath(url: string): string {
  return join(CACHE_DIR, `${createHash('sha256').update(url).digest('hex').slice(0, 24)}.html`);
}

export async function fetchPage(url: string, { retries = 4, force = false } = {}): Promise<string | null> {
  const cp = cachePath(url);
  if (!force && existsSync(cp)) return readFileSync(cp, 'utf8');

  for (let attempt = 0; attempt < retries; attempt++) {
    const gap = MIN_GAP_MS + Math.random() * 800;
    const wait = Math.max(0, lastReq + gap - Date.now());
    if (wait) await sleep(wait);
    lastReq = Date.now();
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'text/html,application/rss+xml' },
        signal: AbortSignal.timeout(20000),
      });
      const body = await res.text();
      if (res.status === 200 && body.length > 2000) {
        mkdirSync(CACHE_DIR, { recursive: true });
        writeFileSync(cp, body);
        return body;
      }
      /* 200 + empty body = VOA rate-limit/quirk → retryable */
      await sleep(2000 * (attempt + 1) + Math.random() * 1000);
    } catch {
      await sleep(2000 * (attempt + 1));
    }
  }
  return null;
}

export async function headOk(url: string): Promise<boolean> {
  const gap = MIN_GAP_MS;
  const wait = Math.max(0, lastReq + gap - Date.now());
  if (wait) await sleep(wait);
  lastReq = Date.now();
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
    return res.status === 200;
  } catch {
    return false;
  }
}
