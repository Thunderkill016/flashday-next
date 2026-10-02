import { test, expect } from '@playwright/test';

const SEED_TIMEOUT_MS = 120_000;
const waitSeeded = (page: import('@playwright/test').Page) =>
  page.waitForSelector('main[data-seeded="true"]', { timeout: SEED_TIMEOUT_MS });

test.describe('Library & Content Management', () => {
  test('library page loads with seed content', async ({ page }) => {
    await page.goto('/library');
    await waitSeeded(page);
    await expect(page.getByRole('heading', { name: 'Learning materials' })).toBeVisible();
    // Seeded learning units render as rows with a Start/Study link
    await expect(
      page.getByRole('link', { name: /^(Start|Study|Continue) / }).first(),
    ).toBeVisible({ timeout: 30000 });
  });

  test('library has search and filter controls', async ({ page }) => {
    await page.goto('/library');
    await waitSeeded(page);
    await expect(page.getByPlaceholder('Search materials…')).toBeVisible();
    await expect(page.getByLabel('Difficulty')).toBeVisible();
    await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();
  });

  test('library type filter works', async ({ page }) => {
    await page.goto('/library');
    await waitSeeded(page);

    const filters = page.locator('section[aria-label="Filter materials"]');
    await expect(filters.getByRole('button', { name: 'Word books' })).toBeVisible();
    await expect(filters.getByRole('button', { name: 'Sentences' })).toBeVisible();
    await expect(filters.getByRole('button', { name: 'Scenarios' })).toBeVisible();
  });

  test('library search filter works', async ({ page }) => {
    await page.goto('/library');
    await waitSeeded(page);
    await expect(
      page.getByRole('link', { name: /^(Start|Study|Continue) / }).first(),
    ).toBeVisible({ timeout: 30000 });

    await page.getByPlaceholder('Search materials…').fill('zzzz-no-such-material');
    await expect(page.getByText('No matching materials')).toBeVisible();
  });

  test('import panel opens for pasted text', async ({ page }) => {
    await page.goto('/library?import=text');
    await waitSeeded(page);
    await expect(page.getByRole('heading', { name: 'Add learning material' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Your text' })).toBeVisible();
  });

  test('import content flow works', async ({ page }) => {
    const title = 'E2E Test Content';
    await page.goto('/library?import=text');
    await waitSeeded(page);

    await page.getByRole('textbox', { name: 'Your text' }).fill(
      'This is a test sentence for E2E testing.',
    );
    await page.getByRole('button', { name: 'Review content', exact: true }).click();
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByLabel('Material type', { exact: true }).selectOption('sentences');
    await page.getByLabel('Material title', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Add to library', exact: true }).click();

    // Library list shows the imported unit
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15000 });
  });

  test('library units link into the learning cycle', async ({ page }) => {
    await page.goto('/library');
    await waitSeeded(page);
    const firstUnit = page.getByRole('link', { name: /^(Start|Study|Continue) / }).first();
    await expect(firstUnit).toBeVisible({ timeout: 30000 });
    await firstUnit.click();
    await expect(page).toHaveURL(/\/learn\/.+/);
    // Unit kind decides the surface (5-stage cycle, vocabulary practice, …);
    // every /learn page exposes a primary heading.
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
  });
});
