import { expect, type Page, test } from '@playwright/test';

/*
 * mission.meet_at_a_time — falsification pass on the listening pilot
 * (W2-02.6).
 *
 * The web runtime executes exactly one claim-bearing surface:
 * listening + audio_line stimulus + choice response, gated on
 * transport-confirmed stimulus delivery (utterance onend). Everything
 * else — every spoken_turn task — must render the fail-closed
 * surface_unavailable card and mint nothing.
 *
 * speechSynthesis is stubbed via addInitScript: the honest variant
 * fires `onend` asynchronously (a real delivery confirmation through
 * the same seam the production utterance uses); the silent variant
 * never fires, so the commit gate must stay closed.
 *
 * Evidence assertions read the real Dexie table, not the DOM.
 */

const DB_NAME = 'echotype:anonymous';
/* Dev-server reloads recompile routes — cold compile can exceed 15s on
 * this box, so post-reload screen waits use a generous bound. */
const SCREEN_TIMEOUT = 60_000;
const PILOT_URL = '/mission?m=mission.meet_at_a_time';
const HEAR_TASK = 'task.time.diagnostic.hear';
const SAY_TASK = 'task.time.diagnostic.say';
const HEAR_CAPABILITY = 'reception.listen.understand_clock_time';

/** Stub speechSynthesis whose speak() reports delivery via onend. */
async function stubSpeechDelivered(page: Page) {
  await page.addInitScript(() => {
    class FakeUtterance {
      text = '';
      lang = '';
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text?: string) {
        this.text = text ?? '';
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        pending: false,
        speaking: false,
        paused: false,
        cancel() {},
        pause() {},
        resume() {},
        getVoices: () => [],
        speak(u: FakeUtterance) {
          setTimeout(() => u.onend?.(), 10);
        },
        addEventListener() {},
        removeEventListener() {},
      },
    });
  });
}

/** Stub speechSynthesis whose speak() never reports delivery. */
async function stubSpeechSilent(page: Page) {
  await page.addInitScript(() => {
    class FakeUtterance {
      text = '';
      lang = '';
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text?: string) {
        this.text = text ?? '';
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        pending: false,
        speaking: false,
        paused: false,
        cancel() {},
        pause() {},
        resume() {},
        getVoices: () => [],
        speak(_u: FakeUtterance) {
          /* transport never confirms — delivery must stay unproven */
        },
        addEventListener() {},
        removeEventListener() {},
      },
    });
  });
}

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

/** Intro → start → first task screen. */
async function startPilot(page: Page) {
  await page.goto(PILOT_URL);
  await expect(page.getByTestId('mission-intro')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await page.getByTestId('mission-start').click();
  await expect(page.getByTestId('mission-task')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await expect(page.getByTestId('mission-task-id')).toContainText(HEAR_TASK);
}

test.beforeEach(async ({ page }) => {
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
});

test('choices stay disabled until the transport confirms stimulus delivery', async ({ page }) => {
  await stubSpeechDelivered(page);
  await startPilot(page);

  // Before delivery: every option is inert, the gate is visible.
  await expect(page.getByTestId('mission-awaiting-delivery')).toBeVisible();
  for (const id of ['three', 'four', 'eight']) {
    await expect(page.getByTestId(`mission-option-${id}`)).toBeDisabled();
  }
  expect((await allEvents(page)).length).toBe(0);

  // Delivery confirmed by onend — options unlock.
  await page.getByTestId('mission-play').click();
  await expect(page.getByTestId('mission-option-three')).toBeEnabled();
  await expect(page.getByTestId('mission-awaiting-delivery')).toHaveCount(0);
});

test('unconfirmed delivery can never commit — the task simply cannot be answered', async ({ page }) => {
  await stubSpeechSilent(page);
  await startPilot(page);

  await page.getByTestId('mission-play').click();
  // No onend → no delivery → options never enable.
  await expect(page.getByTestId('mission-awaiting-delivery')).toBeVisible();
  await expect(page.getByTestId('mission-option-three')).toBeDisabled();
  await page.waitForTimeout(500);
  expect((await allEvents(page)).length).toBe(0);
});

test('a delivered listening choice mints exactly one canonical attempt event', async ({ page }) => {
  await stubSpeechDelivered(page);
  await startPilot(page);

  await page.getByTestId('mission-play').click();
  await expect(page.getByTestId('mission-option-three')).toBeEnabled();
  await page.getByTestId('mission-option-three').click();

  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await expect(page.getByTestId('mission-outcome')).toContainText('Đúng');

  const events = await allEvents(page);
  const attempts = events.filter((e) => (e.attempt as { outcome?: string } | undefined)?.outcome != null);
  expect(attempts).toHaveLength(1);
  const [attempt] = attempts;
  // Canonical claim-bearing identity: evt.<attemptId>.
  expect(attempt.id).toBe(`evt.${(attempt.attempt as { attemptId: string }).attemptId}`);
  expect((attempt.attempt as { attemptId: string }).attemptId).toBe(`${HEAR_TASK}@1:a1`);
  expect(attempt.taskId).toBe(HEAR_TASK);
  expect(attempt.capabilityId).toBe(HEAR_CAPABILITY);
  expect(attempt.modality).toBe('listening');
  expect((attempt.attempt as { outcome: string }).outcome).toBe('success');
  expect(
    (attempt.evaluation as { contractId?: string } | undefined)?.contractId,
  ).toBe('eval.choice.correct.v1');
  // Latency anchors to transport-confirmed delivery, not render time.
  expect(typeof (attempt.attempt as { latencyMs?: number }).latencyMs).toBe('number');
  // A feedback observation follows the landed attempt, on its own id.
  const fb = events.find((e) => e.eventType === 'feedback');
  expect(fb).toBeTruthy();
  expect((fb?.attempt as { attemptId?: string })?.attemptId).toBe(
    (attempt.attempt as { attemptId: string }).attemptId,
  );
  expect(fb?.id).not.toBe(attempt.id);
});

test('a wrong choice lands an honest fail — not a retried success', async ({ page }) => {
  await stubSpeechDelivered(page);
  await startPilot(page);

  await page.getByTestId('mission-play').click();
  await expect(page.getByTestId('mission-option-four')).toBeEnabled();
  await page.getByTestId('mission-option-four').click();

  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await expect(page.getByTestId('mission-outcome')).toContainText('Chưa đúng');

  const events = await allEvents(page);
  const attempts = events.filter((e) => (e.attempt as { outcome?: string } | undefined)?.outcome != null);
  expect(attempts).toHaveLength(1);
  expect((attempts[0].attempt as { outcome: string }).outcome).toBe('fail');
});

test('replays after first delivery mint repeat support — first play is the stimulus', async ({
  page,
}) => {
  await stubSpeechDelivered(page);
  await startPilot(page);

  await page.getByTestId('mission-play').click();
  await expect(page.getByTestId('mission-option-three')).toBeEnabled();
  // First confirmation was the stimulus itself — no support yet.
  expect((await allEvents(page)).filter((e) => e.eventType === 'support_use')).toHaveLength(0);

  await page.getByTestId('mission-play').click();
  await page.getByTestId('mission-play').click();
  // Two further deliveries → two repeat support_use observations, one
  // replay each; the stamped attempt must union them truthfully.
  await expect
    .poll(async () => (await allEvents(page)).filter((e) => e.eventType === 'support_use').length)
    .toBe(2);
  await page.getByTestId('mission-option-three').click();
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });

  const events = await allEvents(page);
  const repeats = events.filter(
    (e) => e.eventType === 'support_use' && (e.support as { repeat?: boolean } | undefined)?.repeat,
  );
  expect(repeats).toHaveLength(2);
  for (const r of repeats) {
    expect((r.support as { repeatCount?: number }).repeatCount).toBe(1);
  }
  const attempt = events.find((e) => (e.attempt as { outcome?: string } | undefined)?.outcome != null);
  expect((attempt?.support as { repeat?: boolean }).repeat).toBe(true);
  expect((attempt?.support as { repeatCount?: number }).repeatCount).toBe(2);
});

test('reload discards unconfirmed delivery — commit still gated afterwards', async ({ page }) => {
  await stubSpeechDelivered(page);
  await startPilot(page);

  await page.getByTestId('mission-play').click();
  await expect(page.getByTestId('mission-option-three')).toBeEnabled();

  await page.reload();
  await expect(page.getByTestId('mission-intro')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await page.getByTestId('mission-start').click();
  await expect(page.getByTestId('mission-task')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await expect(page.getByTestId('mission-task-id')).toContainText(HEAR_TASK);
  // Delivery is volatile state, not durable evidence — the gate resets.
  await expect(page.getByTestId('mission-option-three')).toBeDisabled();
  await expect(page.getByTestId('mission-awaiting-delivery')).toBeVisible();
  expect((await allEvents(page)).length).toBe(0);
});

test('after a commit the next served task is the spoken diagnostic — and it fails closed', async ({
  page,
}) => {
  await stubSpeechDelivered(page);
  await startPilot(page);

  await page.getByTestId('mission-play').click();
  await page.getByTestId('mission-option-three').click();
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await page.getByTestId('mission-next').click();

  // Phase-0 serves the next declared baseline: the spoken diagnostic —
  // which the web surface refuses to execute.
  await expect(page.getByTestId('mission-surface-unavailable')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await expect(page.getByTestId('mission-task-id')).toContainText(SAY_TASK);
  await expect(page.getByTestId('mission-response-input')).toHaveCount(0);
  await expect(page.getByTestId('mission-options')).toHaveCount(0);

  const events = await allEvents(page);
  expect(events.filter((e) => e.taskId === SAY_TASK)).toHaveLength(0);
  expect(
    events.filter((e) => (e.attempt as { outcome?: string } | undefined)?.outcome != null),
  ).toHaveLength(1);
});

test('corrupted and forged rows earn nothing and never crash the session', async ({ page }) => {
  await stubSpeechDelivered(page);
  await startPilot(page);

  await page.getByTestId('mission-play').click();
  await page.getByTestId('mission-option-three').click();
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  const committed = (await allEvents(page)).length;

  await page.evaluate(
    ({ dbName, now }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('evidenceEvents', 'readwrite');
          const store = tx.objectStore('evidenceEvents');
          store.add({ id: 'corrupt~ui~1', learnerId: 'local.anonymous', occurredAt: now - 1 });
          store.add({
            id: 'forged~ui~1',
            learnerId: 'local.anonymous',
            occurredAt: now,
            eventType: 'checkpoint',
            taskId: 'task.time.assessment.hear',
            taskRevision: 1,
            capabilityId: 'reception.listen.understand_clock_time',
            modality: 'listening',
            attempt: { attemptId: 'forged', outcome: 'success', observed: true },
            evaluation: { authority: 'deterministic', contractId: 'eval.choice.correct.v1' },
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    { dbName: DB_NAME, now: Date.now() },
  );

  await page.reload();
  await expect(page.getByTestId('mission-intro')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await page.getByTestId('mission-start').click();
  /* Session recovers. The forged row still sits in the table — it's
   * durable junk — but it minted no CREDIT: the only session-minted
   * attempt (canonical evt. id) is the one real commit, and nothing
   * new was produced by replaying the corrupted log. */
  await expect(page.getByTestId('mission-surface-unavailable')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  const events = await allEvents(page);
  const minted = events.filter(
    (e) =>
      typeof e.id === 'string' &&
      (e.id as string).startsWith('evt.') &&
      (e.attempt as { outcome?: string } | undefined)?.outcome != null,
  );
  expect(minted).toHaveLength(1);
  expect(events.length).toBe(committed + 2);
});

test('an unknown ?m= falls back to the pilot mission — never an unregistered run', async ({
  page,
}) => {
  await stubSpeechDelivered(page);
  await page.goto('/mission?m=mission.does_not_exist');
  await expect(page.getByTestId('mission-intro')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await expect(page.getByTestId('mission-intro')).toContainText('mission.meet_at_a_time');
  await page.getByTestId('mission-start').click();
  await expect(page.getByTestId('mission-task-id')).toContainText(HEAR_TASK);
});
