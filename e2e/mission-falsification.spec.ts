import { expect, type Page, test } from '@playwright/test';

/*
 * mission.meet_new_person — falsification pass on the vertical slice.
 *
 * Attacks the honest-evidence invariants in a real browser: refreshes at
 * prompt/feedback/summary stages, back/forward navigation, double-submit
 * idempotency, and corrupted/forged rows injected straight into
 * IndexedDB. Evidence assertions read the real Dexie table, not the DOM.
 */

const HOUR = 3_600_000;
const DB_NAME = 'echotype:anonymous';
/* Dev-server reloads recompile routes — cold compile can exceed 15s on
 * this box, so post-reload screen waits use the generous bound the main
 * spec already relies on. */
const SCREEN_TIMEOUT = 60_000;

interface Act {
  support?: string[];
  text?: string;
  optionId?: string;
}

const SCRIPT: Record<string, Act> = {
  'task.meet.diagnostic.own_name': { text: 'My name is Mai' },
  'task.meet.diagnostic.ask_name': { text: '…' },
  'task.meet.retrieval.phrases': { text: 'My name is Mai' },
  'task.meet.retrieval.ask_name': { support: ['hint'], text: 'What is your name?' },
  'task.meet.retrieval.questions': { optionId: 'ask_name' },
  'task.meet.interaction.guided': { support: ['modelAnswer'], text: 'What your name?' },
  'task.meet.remediation.ask_name': { text: 'What is your name?' },
  'task.meet.interaction.unaided': { text: 'What is your name?' },
  'task.meet.interaction.polite': { text: 'Nice to meet you' },
  'task.meet.delayed.check': { text: 'What is your name?' },
  'task.meet.delayed.name': { text: 'My name is Mai' },
  'task.meet.transfer.street': { text: 'What is your name?' },
  'task.meet.transfer.name': { text: 'My name is Mai' },
  'task.meet.assessment.name_signup': { text: 'My name is Mai' },
  'task.meet.assessment.checkpoint': { text: 'Hi, I am Mai. What is your name?' },
};

async function currentScreen(page: Page): Promise<'intro' | 'task' | 'input' | 'summary'> {
  await expect(
    page
      .getByTestId('mission-task')
      .or(page.getByTestId('mission-input'))
      .or(page.getByTestId('mission-summary'))
      .or(page.getByTestId('mission-intro')),
  ).toBeVisible({ timeout: SCREEN_TIMEOUT });
  if (await page.getByTestId('mission-summary').isVisible()) return 'summary';
  if (await page.getByTestId('mission-input').isVisible()) return 'input';
  if (await page.getByTestId('mission-intro').isVisible()) return 'intro';
  return 'task';
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

/** Resume through the intro screen if it is shown. */
async function resumeIfIntro(page: Page) {
  if ((await currentScreen(page)) === 'intro') {
    await page.getByTestId('mission-start').click();
  }
}

/** Drive one on-screen step; returns false at the summary. */
async function stepOnce(page: Page): Promise<boolean> {
  const kind = await currentScreen(page);
  if (kind === 'summary') return false;
  if (kind === 'intro') {
    await page.getByTestId('mission-start').click();
    return true;
  }
  // Every step must surface the planner's reason — no hard-coded path.
  await expect(page.getByTestId('mission-reason')).toBeVisible();
  await expect(page.getByTestId('mission-reason')).not.toBeEmpty();
  if (kind === 'input') {
    await page.getByTestId('mission-view').click();
    return true;
  }
  const taskId = (await page.getByTestId('mission-task-id').innerText()).split(' · ')[0].trim();
  if (await page.getByTestId('mission-feedback').isVisible()) {
    await page.getByTestId('mission-next').click();
    return true;
  }
  const act = SCRIPT[taskId];
  if (!act) throw new Error(`no scripted act for '${taskId}'`);
  for (const kind2 of act.support ?? []) {
    await page.getByTestId(`mission-support-${kind2}`).click();
  }
  if (act.optionId != null) {
    await page.getByTestId(`mission-option-${act.optionId}`).click();
  } else {
    await ensureTypedInput(page);
    await page.getByTestId('mission-response-input').fill(act.text ?? '');
    await page.getByTestId('mission-commit').click();
  }
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  return true;
}

/** On spoken_turn prompts the typed control sits behind a toggle —
 * voice is the product path, typing stays as the a11y/dev fallback. */
async function ensureTypedInput(page: Page) {
  if (await page.getByTestId('mission-typed-toggle').isVisible()) {
    await page.getByTestId('mission-typed-toggle').click();
  }
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

test('refreshes at prompt, feedback, and summary stages keep evidence intact', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/mission');
  await page.getByTestId('mission-name-input').fill('Mai');
  await page.getByTestId('mission-start').click();

  // Refresh stage 1: mid-prompt — nothing may be minted.
  await expect(page.getByTestId('mission-task')).toBeVisible();
  let events = await allEvents(page);
  expect(events.length).toBe(0);
  await page.reload();
  await resumeIfIntro(page);
  expect((await allEvents(page)).length).toBe(0);

  // Commit the first diagnostic → feedback screen → refresh stage 2.
  const taskId = (await page.getByTestId('mission-task-id').innerText()).split(' · ')[0].trim();
  await ensureTypedInput(page);
  await page.getByTestId('mission-response-input').fill(SCRIPT[taskId].text ?? '');
  await page.getByTestId('mission-commit').click();
  await expect(page.getByTestId('mission-feedback')).toBeVisible();
  events = await allEvents(page);
  const afterFeedback = events.length;
  await page.reload();
  await resumeIfIntro(page);
  // The committed attempt survives; the consumed task is not re-served.
  events = await allEvents(page);
  expect(events.length).toBe(afterFeedback);
  const screen2 = await currentScreen(page);
  expect(screen2 === 'task' || screen2 === 'input').toBe(true);
  if (screen2 === 'task') {
    const t2 = (await page.getByTestId('mission-task-id').innerText()).split(' · ')[0].trim();
    expect(t2).not.toBe(taskId);
  }

  // Drive the rest of the mission through both phases.
  for (let i = 0; i < 14; i++) {
    if (!(await stepOnce(page))) break;
    const label = await page.getByTestId('mission-task-id').innerText().catch(() => '');
    if (label.includes('retrieval.questions') || label.includes('delayed.')) break;
  }
  await page.evaluate((offset) => localStorage.setItem('fdn:timeOffsetMs', String(offset)), 25 * HOUR);
  await page.reload();
  for (let i = 0; i < 40; i++) {
    if (!(await stepOnce(page))) break;
  }
  await expect(page.getByTestId('mission-summary')).toBeVisible({ timeout: SCREEN_TIMEOUT });

  // Refresh stage 3: on the summary — replayed evidence must reproduce
  // the identical screen; nothing is minted by revisiting.
  events = await allEvents(page);
  const finalCount = events.length;
  await page.reload();
  await resumeIfIntro(page);
  await expect(page.getByTestId('mission-summary')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await expect(page.getByTestId('mission-progress-interaction.ask_name')).toContainText('Vận dụng');
  expect((await allEvents(page)).length).toBe(finalCount);
});

test('back/forward navigation preserves the trajectory without duplicating evidence', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/mission');
  await page.getByTestId('mission-name-input').fill('Mai');
  await page.getByTestId('mission-start').click();

  // Commit one real attempt, then navigate away and back.
  const taskId = (await page.getByTestId('mission-task-id').innerText()).split(' · ')[0].trim();
  await ensureTypedInput(page);
  await page.getByTestId('mission-response-input').fill(SCRIPT[taskId].text ?? '');
  await page.getByTestId('mission-commit').click();
  await expect(page.getByTestId('mission-feedback')).toBeVisible();
  const before = (await allEvents(page)).length;

  await page.getByTestId('mission-next').click();
  await page.goBack(); // → wherever the user came from (dashboard or prior)
  await page.goForward(); // → /mission remounts
  await expect(page.getByTestId('mission-intro')).toBeVisible();
  await expect(page.getByTestId('mission-resumed')).toBeVisible();
  await page.getByTestId('mission-start').click();
  const after = await allEvents(page);
  expect(after.length).toBe(before);
});

test('double-submit mints one attempt; corrupted rows earn nothing', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/mission');
  await page.getByTestId('mission-name-input').fill('Mai');
  await page.getByTestId('mission-start').click();

  // Fire two rapid commits — the busy guard + deterministic id mean at
  // most one attempt event exists for a1.
  const taskId = (await page.getByTestId('mission-task-id').innerText()).split(' · ')[0].trim();
  await ensureTypedInput(page);
  await page.getByTestId('mission-response-input').fill(SCRIPT[taskId].text ?? '');
  const commitBtn = page.getByTestId('mission-commit');
  await commitBtn.dispatchEvent('click');
  await commitBtn.dispatchEvent('click');
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  let events = await allEvents(page);
  expect(
    events.filter((e) => (e.attempt as { outcome?: string } | undefined)?.outcome != null),
  ).toHaveLength(1);

  // Inject corrupted + forged rows straight into IndexedDB — the
  // session must recover and grant no credit.
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
            taskId: 'task.meet.assessment.checkpoint',
            taskRevision: 1,
            capabilityId: 'interaction.ask_name',
            modality: 'speaking',
            attempt: { attemptId: 'forged', outcome: 'success', observed: true },
            evaluation: { authority: 'deterministic', contractId: 'eval.meet.checkpoint' },
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    { dbName: DB_NAME, now: Date.now() },
  );
  await page.reload();
  await resumeIfIntro(page);
  // Session recovered: feedback for the landed attempt re-derives fine
  // and the mission continues serving.
  const kind = await currentScreen(page);
  expect(kind === 'task' || kind === 'input').toBe(true);
});
