import { expect, type Page, test } from '@playwright/test';

/*
 * mission.meet_new_person — full vertical slice through the real UI.
 *
 * The scripted learner mirrors FlashDay's canonical vnext-slice: she can
 * SAY her name (baseline pass) but cannot yet ASK it (honest diagnostic
 * fail), retrieves it only with a hint (supported ≠ independent), needs
 * the model in guided interaction (partial), succeeds on a clean retry
 * (INDEPENDENT), survives a 25h lag (RETAINED via delayed_retrieval),
 * applies the skill in a changed context (TRANSFERRED via
 * transfer_attempt), and is sampled by fresh assessments (checkpoint).
 *
 * Evidence is asserted against the real Dexie evidenceEvents table —
 * not just what the UI renders.
 */

const HOUR = 3_600_000;
const DB_NAME = 'echotype:anonymous';

interface Act {
  /** Support controls to press before responding. */
  support?: string[];
  text?: string;
  optionId?: string;
}

/* What the learner does when a task is served. Missing ids fall back to
 * requiredFunction-driven answers — but every task in the canonical path
 * is scripted so the story stays deterministic. */
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

const served: string[] = [];

/** Which screen is currently rendered. */
async function currentScreen(page: Page): Promise<'task' | 'input' | 'summary'> {
  await expect(
    page
      .getByTestId('mission-task')
      .or(page.getByTestId('mission-input'))
      .or(page.getByTestId('mission-summary')),
  ).toBeVisible({ timeout: 15_000 });
  if (await page.getByTestId('mission-summary').isVisible()) return 'summary';
  if (await page.getByTestId('mission-input').isVisible()) return 'input';
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

/** Drive one on-screen step; returns false when the summary is reached. */
async function stepOnce(page: Page): Promise<boolean> {
  const kind = await currentScreen(page);
  if (kind === 'summary') return false;
  if (kind === 'input') {
    served.push(await page.getByTestId('mission-task-id').innerText());
    await page.getByTestId('mission-view').click();
    return true;
  }
  // task screen — prompt or feedback.
  const taskLabel = await page.getByTestId('mission-task-id').innerText();
  if (await page.getByTestId('mission-feedback').isVisible()) {
    await page.getByTestId('mission-next').click();
    return true;
  }
  const taskId = taskLabel.split(' · ')[0].trim();
  served.push(taskLabel);
  const act = SCRIPT[taskId];
  if (!act) throw new Error(`no scripted act for '${taskId}'`);
  for (const kind of act.support ?? []) {
    await page.getByTestId(`mission-support-${kind}`).click();
  }
  if (act.optionId != null) {
    await page.getByTestId(`mission-option-${act.optionId}`).click();
  } else {
    await page.getByTestId('mission-response-input').fill(act.text ?? '');
    await page.getByTestId('mission-commit').click();
  }
  // Feedback must render before the loop continues — evidence lands first.
  await expect(page.getByTestId('mission-feedback')).toBeVisible({ timeout: 15_000 });
  return true;
}

test.beforeEach(async ({ page }) => {
  served.length = 0;
  await page.goto('/dashboard');
  // The (app) shell renders children only after seedDatabase() resolves.
  await expect(page.locator('main[data-seeded="true"]')).toBeVisible({ timeout: 60_000 });
  // Clear the evidence log through a second IDB connection — deleting the
  // database would wedge on the app's open connection.
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
  await page.evaluate(() => localStorage.removeItem('fdn:timeOffsetMs'));
});

test('meet_new_person: Today → diagnostic → supported → independent → delayed → transfer → assessment', async ({
  page,
}) => {
  // Today surface recommends the mission.
  await page.goto('/dashboard');
  await expect(page.getByTestId('mission-entry')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('mission-entry').click();
  await expect(page).toHaveURL(/\/mission/);

  // Intro → persona name → start.
  await expect(page.getByTestId('mission-intro')).toBeVisible();
  await page.getByTestId('mission-name-input').fill('Mai');
  await page.screenshot({ path: 'test-results/mission-intro.png', fullPage: true });
  await page.getByTestId('mission-start').click();

  // ── Phase 1: diagnostics, teaching, supported attempt, clean retry ──
  // Drive until the delayed stage is pending — the planner stalls once
  // only not-yet-due delayed work remains, so cap by task count.
  for (let i = 0; i < 12; i++) {
    const kind = await currentScreen(page);
    if (kind === 'summary') break;
    const ok = await stepOnce(page);
    if (!ok) break;
    // Stop after the carrier comprehension check — everything left is
    // time-gated (delayed) or post-delay (transfer/assessment).
    const lastId = served.at(-1)?.split(' · ')[0] ?? '';
    if (lastId === 'task.meet.retrieval.questions') break;
    if (served.filter((s) => s.startsWith('task.meet.delayed.')).length) break;
  }

  // ── Evidence so far: supported must NOT be independent ──
  await page.screenshot({ path: 'test-results/mission-after-supported.png', fullPage: true });
  let events = await allEvents(page);
  const hinted = events.find(
    (e) =>
      e.capabilityId === 'interaction.ask_name' &&
      (e.support as Record<string, unknown> | undefined)?.hint === true,
  );
  expect(hinted, 'a hint-supported success must exist').toBeTruthy();
  const askAttempts = events.filter(
    (e) =>
      e.capabilityId === 'interaction.ask_name' &&
      (e.attempt as { outcome?: string } | undefined)?.outcome === 'success' &&
      e.eventType !== 'transfer_attempt',
  );
  expect(
    askAttempts.some((e) => e.eventType === 'retry'),
    'the clean remediation retry is the independent-minting event',
  ).toBe(true);

  // ── Refresh persistence: resume mid-trajectory ──
  const beforeReload = events.length;
  await page.reload();
  await expect(page.getByTestId('mission-intro')).toBeVisible();
  await expect(page.getByTestId('mission-resumed')).toBeVisible();
  await page.getByTestId('mission-start').click();
  events = await allEvents(page);
  expect(events.length).toBe(beforeReload);

  // ── Phase 2: the 25h lag unlocks delayed retrieval ──
  await page.evaluate(
    (offset) => localStorage.setItem('fdn:timeOffsetMs', String(offset)),
    25 * HOUR,
  );
  await page.reload();
  await expect(page.getByTestId('mission-intro')).toBeVisible();
  await page.getByTestId('mission-start').click();

  let sawTransfer = false;
  let sawAssessment = false;
  for (let i = 0; i < 40; i++) {
    const kind = await currentScreen(page);
    if (kind === 'summary') break;
    const label =
      kind === 'input'
        ? await page.getByTestId('mission-task-id').innerText()
        : await page.getByTestId('mission-task-id').innerText();
    if (label.includes('transfer.')) {
      if (!sawTransfer) await page.screenshot({ path: 'test-results/mission-transfer.png', fullPage: true });
      sawTransfer = true;
    }
    if (label.includes('assessment.')) sawAssessment = true;
    const ok = await stepOnce(page);
    if (!ok) break;
  }

  expect(sawTransfer, 'transfer tasks must be served').toBe(true);
  expect(sawAssessment, 'assessment tasks must be served').toBe(true);
  await expect(page.getByTestId('mission-summary')).toBeVisible({ timeout: 15_000 });

  // ── Final evidence assertions against the durable log ──
  events = await allEvents(page);
  const byType = (type: string) => events.filter((e) => e.eventType === type);
  expect(byType('delayed_retrieval').length).toBeGreaterThanOrEqual(2);
  expect(byType('transfer_attempt').length).toBeGreaterThanOrEqual(2);
  expect(byType('checkpoint').length).toBeGreaterThanOrEqual(2);
  // Every transfer event is in a transfer context, never a rehearsed one.
  for (const e of byType('transfer_attempt')) {
    expect((e.context as { practicedOrTransfer?: string }).practicedOrTransfer).toBe('transfer');
  }
  // Assessment events are fresh-family checkpoints with attempt ids.
  for (const e of byType('checkpoint')) {
    expect((e.attempt as { attemptId?: string }).attemptId).toBeTruthy();
  }

  // Summary shows replay-derived states for both claim-bearing targets.
  await expect(
    page.getByTestId('mission-progress-interaction.ask_name'),
  ).toContainText('Vận dụng');
  await expect(
    page.getByTestId('mission-progress-production.speak.say_own_name'),
  ).toContainText('Vận dụng');

  await page.screenshot({ path: 'test-results/mission-summary.png', fullPage: true });
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/mission-served.txt', served.join(String.fromCharCode(10)));
  writeFileSync(
    'test-results/mission-events.json',
    JSON.stringify(events, null, 2),
  );
});
