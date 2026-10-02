/*
 * FD-VS01 dev inspection path — registers window.__vs01Report() in
 * development builds so the dogfooder can dump per-target records from
 * DevTools without a dashboard or export UI. Pure read; no writes.
 * Usage (pnpm dev):  await __vs01Report()
 */
import { db } from './db';
import { vs01DogfoodEnabled } from './vs01-targets';
import { vs01ReportJson } from './vs01-telemetry';

if (typeof window !== 'undefined' && vs01DogfoodEnabled()) {
  (window as unknown as Record<string, unknown>).__vs01Report = async () => {
    const [contents, attempts, sessions] = await Promise.all([
      db.contents.toArray(),
      db.learningAttempts.toArray(),
      db.sessions.toArray(),
    ]);
    return vs01ReportJson({ contents, attempts, sessions, now: Date.now() });
  };
}
