import { expect, type Page, test } from '@playwright/test';

/*
 * mission.meet_new_person — spoken-modality fail-closed spec (W2-02.6).
 *
 * This mission's declared tasks are almost all spoken_turn surfaces.
 * The web runtime cannot execute them honestly — typed text is not
 * speech — so the session must refuse: a fail-closed surface card, no
 * input channel, and zero minted evidence. This spec is the regression
 * lock on that refusal; the canonical trajectory it used to drive is
 * unexecutable on web until a real speech surface exists (W3).
 */

const DB_NAME = 'echotype:anonymous';
const SCREEN_TIMEOUT = 60_000;

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

test('spoken diagnostic fails closed: no text channel, no evidence', async ({ page }) => {
  await page.goto('/mission?m=mission.meet_new_person');
  await expect(page.getByTestId('mission-intro')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await page.getByTestId('mission-name-input').fill('Mai');
  await page.getByTestId('mission-start').click();

  // The baseline diagnostic is a spoken_turn task — the planner serves
  // it and the surface must refuse to execute it.
  await expect(page.getByTestId('mission-surface-unavailable')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await expect(page.getByTestId('mission-task-id')).toContainText('task.meet.diagnostic.own_name');
  await expect(page.getByTestId('mission-unavailable-reason')).toBeVisible();
  // The planner's reason for the selection is still auditable.
  await expect(page.getByTestId('mission-reason')).toBeVisible();
  await expect(page.getByTestId('mission-reason')).not.toBeEmpty();

  // No substitute response channel exists — the old text box is gone.
  await expect(page.getByTestId('mission-response-input')).toHaveCount(0);
  await expect(page.getByTestId('mission-commit')).toHaveCount(0);
  await expect(page.getByTestId('mission-options')).toHaveCount(0);

  // Nothing minted — not even a session bookkeeping event for the
  // blocked task.
  const events = await allEvents(page);
  expect(events).toHaveLength(0);
});

test('unsupported surface is stable across reloads — still zero evidence', async ({ page }) => {
  await page.goto('/mission?m=mission.meet_new_person');
  await expect(page.getByTestId('mission-intro')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await page.getByTestId('mission-name-input').fill('Mai');
  await page.getByTestId('mission-start').click();
  await expect(page.getByTestId('mission-surface-unavailable')).toBeVisible({ timeout: SCREEN_TIMEOUT });

  await page.reload();
  await expect(page.getByTestId('mission-intro')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await page.getByTestId('mission-start').click();
  await expect(page.getByTestId('mission-surface-unavailable')).toBeVisible({ timeout: SCREEN_TIMEOUT });
  await expect(page.getByTestId('mission-task-id')).toContainText('task.meet.diagnostic.own_name');
  expect((await allEvents(page)).length).toBe(0);
});
