import { expect, type Page, test } from '@playwright/test';

/*
 * mission.meet_at_a_time — W2-02.6 integrity pilot: reproduction probes
 * for cases the first falsification pass did not cover.
 *
 * These tests model REAL browser transport semantics — including the
 * documented Chromium quirk that speechSynthesis.cancel() fires `end`
 * on interrupted utterances — and pin the evidence layer, not just the
 * DOM. A probe that fails here is a defect report, not a bad test.
 */

const DB_NAME = 'echotype:anonymous';
const SCREEN_TIMEOUT = 60_000;
const PILOT_URL = '/mission?m=mission.meet_at_a_time';
const HEAR_TASK = 'task.time.diagnostic.hear';
const SAY_TASK = 'task.time.diagnostic.say';

/** Chrome-faithful stub: speak() parks the utterance (manual onend
 * control) and cancel() fires `end` on every parked utterance — which
 * is what real Chrome does when playback is interrupted. */
async function stubSpeechChromeCancel(page: Page) {
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
    const pending: FakeUtterance[] = [];
    (window as unknown as { __fdnUtterances: FakeUtterance[] }).__fdnUtterances = pending;
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        pending: false,
        speaking: false,
        paused: false,
        /* The Chromium quirk under test: cancel() reports 'end' on
         * interrupted utterances — an interrupted stimulus is NOT a
         * completed delivery. */
        cancel() {
          while (pending.length) pending.shift()?.onend?.();
        },
        pause() {},
        resume() {},
        getVoices: () => [],
        speak(u: FakeUtterance) {
          pending.push(u);
        },
        addEventListener() {},
        removeEventListener() {},
      },
    });
  });
}

/** Manual-control stub where cancel() is a no-op — the test fires
 * onend on whichever parked utterance it chooses. */
async function stubSpeechManual(page: Page) {
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
    (window as unknown as { __fdnUtterances: FakeUtterance[] }).__fdnUtterances = [];
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
          (window as unknown as { __fdnUtterances: FakeUtterance[] }).__fdnUtterances.push(u);
        },
        addEventListener() {},
        removeEventListener() {},
      },
    });
  });
}

/** Honest stub: every utterance ends asynchronously after 10ms. */
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

/** Error stub: speak() reports onerror — never a delivery. */
async function stubSpeechError(page: Page) {
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
          setTimeout(() => u.onerror?.(), 10);
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

/* R3 — a transport error is not a delivery: onerror must leave the
 * commit gate closed and mint nothing. */
test('R3: playback error confirms nothing — choices stay locked, no evidence', async ({ page }) => {
  await stubSpeechError(page);
  await startPilot(page);

  await page.getByTestId('mission-play').click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('mission-awaiting-delivery')).toBeVisible();
  await expect(page.getByTestId('mission-option-three')).toBeDisabled();
  expect((await allEvents(page)).length).toBe(0);
});

/* R4 / race — the Chromium cancel() quirk: pressing Play while audio
 * is in flight interrupts the first utterance, and Chrome reports
 * 'end' on it. An interrupted stimulus never finished playing — it
 * must not confirm delivery, must not mint repeat support, and the
 * commit gate must stay closed until the LIVE utterance completes. */
test('R4: an interrupted utterance is not a delivery — cancel-induced end cannot unlock choices', async ({
  page,
}) => {
  await stubSpeechChromeCancel(page);
  await startPilot(page);

  // Press Play, then press again before the audio finishes — Chrome
  // fires `end` on the interrupted utterance inside cancel().
  await page.getByTestId('mission-play').click();
  await page.getByTestId('mission-play').click();
  await page.waitForTimeout(300);

  // The live utterance (press #2) has NOT completed — no delivery yet.
  await expect(page.getByTestId('mission-awaiting-delivery')).toBeVisible();
  await expect(page.getByTestId('mission-option-three')).toBeDisabled();
  expect((await allEvents(page)).filter((e) => e.eventType === 'support_use')).toHaveLength(0);

  // Now the live utterance genuinely completes → first real delivery.
  await page.evaluate(() => {
    const us = (window as unknown as { __fdnUtterances: { onend?: (() => void) | null }[] })
      .__fdnUtterances;
    us?.[us.length - 1]?.onend?.();
  });
  await expect(page.getByTestId('mission-option-three')).toBeEnabled();
  // One completed playback = the stimulus itself, zero repeat support.
  expect((await allEvents(page)).filter((e) => e.eventType === 'support_use')).toHaveLength(0);
});

/* R4 variant — stale task: an utterance started on task A completing
 * after the session moved to task B confirms nothing for B. */
test('R4b: a completion for a consumed task cannot deliver the next one', async ({ page }) => {
  await stubSpeechManual(page);
  await startPilot(page);

  // Park A's utterance, then deliver A manually + commit → mission
  // advances to the spoken diagnostic (surface_unavailable).
  await page.getByTestId('mission-play').click();
  await page.evaluate(() => {
    const us = (window as unknown as { __fdnUtterances: { onend?: (() => void) | null }[] })
      .__fdnUtterances;
    us?.[0]?.onend?.();
  });
  await expect(page.getByTestId('mission-option-three')).toBeEnabled();
  await page.getByTestId('mission-option-three').click();
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await page.getByTestId('mission-next').click();
  await expect(page.getByTestId('mission-surface-unavailable')).toBeVisible({
    timeout: SCREEN_TIMEOUT,
  });
  const settled = (await allEvents(page)).length;

  // The consumed task's utterance completes LATE (a stray second end
  // on the same parked utterance) — its taskId/attemptId no longer
  // match the live selection, so it must be inert.
  await page.evaluate(() => {
    const us = (window as unknown as { __fdnUtterances: { onend?: (() => void) | null }[] })
      .__fdnUtterances;
    us?.[us.length - 1]?.onend?.();
  });
  await page.waitForTimeout(300);
  expect((await allEvents(page)).length).toBe(settled);
});

/* R6 — reload mid-prompt re-serves the same canonical attempt
 * identity (task@rev:aN is derived from committed evidence). */
test('R6: reload mid-prompt re-serves the same task@revision:attempt identity', async ({ page }) => {
  await stubSpeechDelivered(page);
  await startPilot(page);
  await expect(page.getByTestId('mission-task-id')).toContainText(`${HEAR_TASK} · ${HEAR_TASK}@1:a1`);

  await page.reload();
  await expect(page.getByTestId('mission-intro')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await page.getByTestId('mission-start').click();
  await expect(page.getByTestId('mission-task')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await expect(page.getByTestId('mission-task-id')).toContainText(`${HEAR_TASK}@1:a1`);
  expect((await allEvents(page)).length).toBe(0);
});

/* B8 — a committed attempt survives reload exactly once: no duplicate
 * write, no re-served prompt for the same attempt. */
test('B8: reload after a committed attempt — no duplicate, no re-serve', async ({ page }) => {
  await stubSpeechDelivered(page);
  await startPilot(page);

  await page.getByTestId('mission-play').click();
  await page.getByTestId('mission-option-three').click();
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  const committed = (await allEvents(page)).length;

  await page.reload();
  await expect(page.getByTestId('mission-intro')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await page.getByTestId('mission-start').click();
  /* The diagnostic is consumed — the planner moves to the spoken
   * baseline, which fails closed. The committed attempt must NOT be
   * re-served as an unconsumed prompt. */
  await expect(page.getByTestId('mission-surface-unavailable')).toBeVisible({
    timeout: SCREEN_TIMEOUT,
  });
  await expect(page.getByTestId('mission-task-id')).toContainText(SAY_TASK);

  const events = await allEvents(page);
  expect(events.length).toBe(committed);
  const attempts = events.filter((e) => (e.attempt as { outcome?: string } | undefined)?.outcome != null);
  expect(attempts).toHaveLength(1);
  expect(attempts[0].id).toBe(`evt.${HEAR_TASK}@1:a1`);
});

/* B6 + R7 — support durability across reload. On this mission every
 * non-baseline trajectory dead-ends at the spoken diagnostic (the
 * fail-closed surface is the pilot's point), so no support-CONTROL
 * purpose is ever reachable — transcript/hint durability is pinned at
 * the session-test level instead. What IS reachable on the pilot is
 * transport support: the second confirmed playback mints repeat
 * support_use, which must survive reload and contaminate the SAME
 * attempt — without double-counting from the in-memory snapshot. */
test('B6: repeat support before reload still contaminates the post-reload attempt', async ({
  page,
}) => {
  await stubSpeechDelivered(page);
  await startPilot(page);

  // Two completed playbacks: first = stimulus delivery, second =
  // repeat support_use — durable before any commit.
  await page.getByTestId('mission-play').click();
  await expect(page.getByTestId('mission-option-three')).toBeEnabled();
  await page.getByTestId('mission-play').click();
  await expect
    .poll(async () => (await allEvents(page)).filter((e) => e.eventType === 'support_use').length)
    .toBe(1);

  // Reload: the in-memory snapshot is gone — the durable support_use
  // row must still contaminate the SAME canonical attempt id.
  await page.reload();
  await expect(page.getByTestId('mission-intro')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await page.getByTestId('mission-start').click();
  await expect(page.getByTestId('mission-task')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await expect(page.getByTestId('mission-task-id')).toContainText(`${HEAR_TASK}@1:a1`);

  await page.getByTestId('mission-play').click();
  await page.getByTestId('mission-option-three').click();
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });

  const events = await allEvents(page);
  const attempt = events.find(
    (e) =>
      e.taskId === HEAR_TASK &&
      (e.attempt as { outcome?: string } | undefined)?.outcome != null,
  );
  expect((attempt?.support as { repeat?: boolean } | undefined)?.repeat).toBe(true);
  /* Exactly ONE durable replay: the pre-reload repeat row. Delivery
   * itself is volatile (no event, by design), so the post-reload Play
   * is the new session's first delivery — not another repeat. The
   * pin: pre-reload contamination survives reload without
   * double-counting. */
  expect((attempt?.support as { repeatCount?: number } | undefined)?.repeatCount).toBe(1);
});

/* B10 — second learner in the SAME table inherits nothing: change
 * the anonymous subject key, and learner B's session must show zero
 * of learner A's delivery/support/progress state. */
test('B10: a second learner on the same device inherits no evidence or progress', async ({
  page,
}) => {
  await stubSpeechDelivered(page);
  await startPilot(page);

  await page.getByTestId('mission-play').click();
  await page.getByTestId('mission-option-three').click();
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  const learnerA = await page.evaluate(() => localStorage.getItem('flashday.localSubjectId'));
  const aEvents = await allEvents(page);
  expect(aEvents.length).toBeGreaterThan(0);
  expect(aEvents.every((e) => e.learnerId === learnerA)).toBe(true);

  // Become learner B — same device DB, different subject key.
  await page.evaluate(() => localStorage.setItem('flashday.localSubjectId', 'local.learner-b'));
  await page.goto(PILOT_URL);
  await expect(page.getByTestId('mission-intro')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  // Not a resumed mission — B never started one.
  await expect(page.getByTestId('mission-resumed')).toHaveCount(0);
  await page.getByTestId('mission-start').click();
  await expect(page.getByTestId('mission-task')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  // B gets the baseline prompt under a fresh attempt ordinal — not
  // A's consumed attempt, not A's next task.
  await expect(page.getByTestId('mission-task-id')).toContainText(`${HEAR_TASK}@1:a1`);
  await expect(page.getByTestId('mission-awaiting-delivery')).toBeVisible();

  // A's rows stay in the shared table but are foreign to B's session.
  const events = await allEvents(page);
  expect(events.filter((e) => e.learnerId === learnerA).length).toBe(aEvents.length);
  expect(events.filter((e) => e.learnerId === 'local.learner-b')).toHaveLength(0);
});

/* Support offer integrity — a diagnostic prompt is not a supportable
 * purpose: no support controls may appear, and none exist in the DOM
 * to be forged into a support_use. */
test('support controls are absent on non-supportable purposes — nothing to forge', async ({
  page,
}) => {
  await stubSpeechDelivered(page);
  await startPilot(page);

  await expect(page.getByTestId('mission-task-id')).toContainText(HEAR_TASK);
  // Diagnostic purpose → zero support affordances rendered.
  await expect(page.getByTestId('mission-supports')).toHaveCount(0);
  for (const kind of ['hint', 'modelAnswer', 'transcript']) {
    await expect(page.getByTestId(`mission-support-${kind}`)).toHaveCount(0);
  }
});

/* Commit-race falsification — two rapid option clicks must land
 * exactly one canonical attempt; the dedupe boundary is the canonical
 * evt.<attemptId> id, not the click. */
test('B-race: double-click on an option commits exactly once', async ({ page }) => {
  await stubSpeechDelivered(page);
  await startPilot(page);

  await page.getByTestId('mission-play').click();
  await expect(page.getByTestId('mission-option-three')).toBeEnabled();
  // dispatchEvent bypasses actionability — two clicks land in the same
  // task tick, a true concurrent-commit race the busy flag cannot gate.
  await page.getByTestId('mission-option-three').dispatchEvent('click');
  await page.getByTestId('mission-option-three').dispatchEvent('click');
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });

  const events = await allEvents(page);
  const attempts = events.filter((e) => (e.attempt as { outcome?: string } | undefined)?.outcome != null);
  expect(attempts).toHaveLength(1);
});
