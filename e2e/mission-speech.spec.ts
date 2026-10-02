import { expect, type Page, test } from '@playwright/test';

/*
 * mission.meet_new_person — real speech path (FDN-SPEECH-001).
 *
 * The hardware/transport boundary is faked (a scripted
 * window.SpeechRecognition, a fake MediaRecorder/getUserMedia, and an
 * HTTP-level /api/stt interception) — everything after that seam is
 * real: hook → mission UI → session → bridge → EvidenceEvent → Dexie →
 * replay/projection. Nothing below the transport boundary is mocked.
 *
 * A scripted utterance is an object consumed once per start():
 *   { interims?: string[]; hold?: boolean; final?: string|null;
 *     confidence?: number|null; error?: string }
 * `hold: true` parks the recognizer after interims until the test calls
 * window.__FAKE_ASR_FINISH__() — the interim-vs-final boundary pin.
 */

const DB_NAME = 'echotype:anonymous';
const SCREEN_TIMEOUT = 60_000;

const FAKE_RECOGNITION_INIT = `
  window.__FAKE_ASR__ = window.__FAKE_ASR__ || [];
  window.SpeechRecognition = class FakeSpeechRecognition {
    continuous = false;
    interimResults = true;
    lang = '';
    onresult = null;
    onerror = null;
    onend = null;
    start() {
      const script = window.__FAKE_ASR__.shift() ?? { final: 'My name is Mai', confidence: 0.9 };
      setTimeout(() => {
        if (this.aborted) return;
        for (const t of script.interims ?? []) {
          this.onresult?.({
            resultIndex: 0,
            results: [{ isFinal: false, 0: { transcript: t, confidence: 0 }, length: 1 }],
          });
        }
        const finish = () => {
          if (this.aborted) return;
          if (script.error) {
            this.onerror?.({ error: script.error });
          } else if (script.final != null) {
            this.onresult?.({
              resultIndex: 0,
              results: [{ isFinal: true, 0: { transcript: script.final, confidence: script.confidence }, length: 1 }],
            });
          }
          this.onend?.();
        };
        if (script.hold) {
          window.__FAKE_ASR_FINISH__ = finish;
        } else {
          setTimeout(finish, 40);
        }
      }, 40);
    }
    stop() {
      // End without emitting a final — like a learner cutting off early.
      this.onend?.();
    }
    abort() {
      this.aborted = true;
    }
  };
`;

const FALLBACK_STT_INIT = `
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: async () => new MediaStream(),
    },
    configurable: true,
  });
  window.MediaRecorder = class FakeMediaRecorder {
    static isTypeSupported() { return true; }
    constructor(stream) { this.state = 'inactive'; this._stream = stream; }
    start() {
      this.state = 'recording';
      setTimeout(() => {
        // >100 bytes so the hook's empty-blob guard passes.
        this.ondataavailable?.({ data: new Blob([new Uint8Array(512)], { type: 'audio/webm' }) });
      }, 30);
    }
    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  };
`;

async function allEvents(page: Page) {
  return page.evaluate(
    (dbName) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('evidenceEvents')) {
            resolve([]);
            return;
          }
          const tx = db.transaction('evidenceEvents', 'readonly');
          const getAll = tx.objectStore('evidenceEvents').getAll();
          getAll.onsuccess = () => resolve(getAll.result as Record<string, unknown>[]);
          getAll.onerror = () => reject(getAll.error);
        };
      }),
    DB_NAME,
  );
}

async function seedClean(page: Page) {
  await page.goto('/dashboard');
  await expect(page.locator('main[data-seeded="true"]')).toBeVisible({ timeout: 60_000 });
  await page.evaluate(
    (dbName) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('evidenceEvents')) {
            resolve();
            return;
          }
          const tx = db.transaction('evidenceEvents', 'readwrite');
          const clear = tx.objectStore('evidenceEvents').clear();
          clear.onsuccess = () => resolve();
          clear.onerror = () => reject(clear.error);
        };
      }),
    DB_NAME,
  );
  await page.evaluate(() => localStorage.clear());
}

async function enterMission(page: Page) {
  await page.goto('/mission');
  await page.getByTestId('mission-name-input').fill('Mai');
  await page.getByTestId('mission-start').click();
  await expect(page.getByTestId('mission-task')).toBeVisible({ timeout: SCREEN_TIMEOUT });
}

const attemptEvents = (events: Record<string, unknown>[]) =>
  events.filter((e) => (e.attempt as { outcome?: string } | undefined)?.outcome != null);

test('native Web Speech path: interim never mints, final reviews then commits with provenance', async ({
  page,
}) => {
  await page.addInitScript(FAKE_RECOGNITION_INIT);
  await seedClean(page);
  await enterMission(page);

  // First served task is the own-name diagnostic — a spoken_turn.
  await expect(page.getByTestId('mission-speech')).toBeVisible();

  // Interim-only utterance, held until the test releases it.
  await page.evaluate(() => {
    window.__FAKE_ASR__.push({ interims: ['My', 'My name'], hold: true, final: 'My name is Mai', confidence: 0.9 });
  });
  await page.getByTestId('mission-mic-start').click();
  await expect(page.getByTestId('mission-interim')).toContainText('My name', { timeout: 10_000 });
  // Interim is display state — zero attempts minted while it is showing.
  expect(attemptEvents(await allEvents(page))).toHaveLength(0);
  await expect(page.getByTestId('mission-speech-review')).toHaveCount(0);

  await page.evaluate(() => window.__FAKE_ASR_FINISH__());
  await expect(page.getByTestId('mission-transcript')).toHaveText('My name is Mai', { timeout: 10_000 });

  // Double-commit must land exactly one attempt.
  const commit = page.getByTestId('mission-commit');
  await commit.dispatchEvent('click');
  await commit.dispatchEvent('click');
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await expect(page.getByTestId('mission-outcome')).toHaveText('Đúng');

  const events = await allEvents(page);
  const attempts = attemptEvents(events);
  expect(attempts).toHaveLength(1);
  expect((attempts[0].attempt as { capture?: unknown }).capture).toEqual({
    mode: 'speech',
    authority: 'asr',
    provider: 'web-speech',
    final: true,
    confidence: 0.9,
  });

  // Refresh after commit: replay carries the same capture provenance,
  // and nothing is re-minted.
  await page.reload();
  const events2 = await allEvents(page);
  expect(attemptEvents(events2)).toHaveLength(1);
  expect((attemptEvents(events2)[0].attempt as { capture?: { provider?: string } }).capture?.provider).toBe(
    'web-speech',
  );
});

test('typed fallback on a spoken_turn stamps direct capture and still earns credit', async ({ page }) => {
  await page.addInitScript(FAKE_RECOGNITION_INIT);
  await seedClean(page);
  await enterMission(page);

  await page.getByTestId('mission-typed-toggle').click();
  await page.getByTestId('mission-response-input').fill('My name is Mai');
  await page.getByTestId('mission-commit').click();
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });

  const attempts = attemptEvents(await allEvents(page));
  expect(attempts).toHaveLength(1);
  expect((attempts[0].attempt as { capture?: { authority?: string } }).capture?.authority).toBe('direct');
});

test('permission denied and empty transcripts mint zero attempts; retry recovers', async ({ page }) => {
  await page.addInitScript(FAKE_RECOGNITION_INIT);
  await seedClean(page);
  await enterMission(page);

  // 1. Permission denied.
  await page.evaluate(() => window.__FAKE_ASR__.push({ error: 'not-allowed' }));
  await page.getByTestId('mission-mic-start').click();
  await expect(page.getByTestId('mission-mic-error')).toBeVisible({ timeout: 10_000 });
  expect(attemptEvents(await allEvents(page))).toHaveLength(0);

  // 2. Empty/no-speech result.
  await page.evaluate(() => window.__FAKE_ASR__.push({ final: '' }));
  await page.getByTestId('mission-mic-retry').click();
  await expect(page.getByTestId('mission-mic-error')).toBeVisible({ timeout: 10_000 });
  expect(attemptEvents(await allEvents(page))).toHaveLength(0);

  // 3. Retry with a real utterance still works.
  await page.evaluate(() =>
    window.__FAKE_ASR__.push({ final: 'My name is Mai', confidence: null }),
  );
  await page.getByTestId('mission-mic-retry').click();
  await expect(page.getByTestId('mission-transcript')).toHaveText('My name is Mai', { timeout: 10_000 });
  await page.getByTestId('mission-commit').click();
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  const attempts = attemptEvents(await allEvents(page));
  expect(attempts).toHaveLength(1);
  expect((attempts[0].attempt as { capture?: { confidence?: number | null } }).capture?.confidence).toBeNull();
});

test('a refresh during a held recording mints nothing', async ({ page }) => {
  await page.addInitScript(FAKE_RECOGNITION_INIT);
  await seedClean(page);
  await enterMission(page);

  await page.evaluate(() => window.__FAKE_ASR__.push({ interims: ['My'], hold: true, final: 'My name is Mai' }));
  await page.getByTestId('mission-mic-start').click();
  await expect(page.getByTestId('mission-interim')).toContainText('My', { timeout: 10_000 });

  // Refresh while the recognizer is parked mid-utterance.
  await page.reload();
  const events = await allEvents(page);
  expect(attemptEvents(events)).toHaveLength(0);
});

test('fallback path: MediaRecorder → /api/stt keeps the actual provider in capture provenance', async ({
  page,
}) => {
  await page.addInitScript(FALLBACK_STT_INIT);
  let sttText = 'My name is Mai';
  await page.route('**/api/stt', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: sttText, providerId: 'groq' }),
    }),
  );
  await seedClean(page);
  await enterMission(page);

  // No SpeechRecognition → the component takes the server path.
  await page.getByTestId('mission-mic-start').click();
  await expect(page.getByTestId('mission-mic-stop')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('mission-mic-stop').click();
  await expect(page.getByTestId('mission-transcript')).toHaveText('My name is Mai', { timeout: 15_000 });
  await page.getByTestId('mission-commit').click();
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });

  const attempts = attemptEvents(await allEvents(page));
  expect(attempts).toHaveLength(1);
  expect((attempts[0].attempt as { capture?: unknown }).capture).toEqual({
    mode: 'speech',
    authority: 'asr',
    provider: 'groq',
    final: true,
    confidence: null,
  });
});

test('STT upstream failure surfaces an honest error and zero evidence', async ({ page }) => {
  await page.addInitScript(FALLBACK_STT_INIT);
  await page.route('**/api/stt', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'upstream down' }) }),
  );
  await seedClean(page);
  await enterMission(page);

  await page.getByTestId('mission-mic-start').click();
  await page.getByTestId('mission-mic-stop').click();
  await expect(page.getByTestId('mission-mic-error')).toBeVisible({ timeout: 15_000 });
  expect(attemptEvents(await allEvents(page))).toHaveLength(0);
});
