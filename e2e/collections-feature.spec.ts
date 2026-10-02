import { test, expect } from '@playwright/test';

const SEED_TIMEOUT_MS = 120_000;
const waitSeeded = (page: import('@playwright/test').Page) =>
  page.waitForSelector('main[data-seeded="true"]', { timeout: SEED_TIMEOUT_MS });

// Builtin collections surface on /library as 'Scenarios' material units
// (the old Collections tab was removed with the learning-units redesign).
test.describe('Collections Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/library');
    await waitSeeded(page);
  });

  test('library Scenarios filter shows builtin collections', async ({ page }) => {
    const filters = page.locator('section[aria-label="Filter materials"]');
    await filters.getByRole('button', { name: 'Scenarios' }).click();

    await expect(page.getByText('Restaurant & Dining').first()).toBeVisible({ timeout: 15000 });
  });

  test('a scenario unit opens its learning page', async ({ page }) => {
    const filters = page.locator('section[aria-label="Filter materials"]');
    await filters.getByRole('button', { name: 'Scenarios' }).click();

    const link = page.getByRole('link', { name: /^(Start|Study|Continue) Restaurant & Dining/ });
    await expect(link).toBeVisible({ timeout: 15000 });
    await link.click();

    await expect(page).toHaveURL(/\/learn\/.+/, { timeout: 15000 });
    await expect(
      page.getByRole('heading', { name: 'Restaurant & Dining' }),
    ).toBeVisible({ timeout: 30000 });
  });

  test('AI Generate page loads correctly', async ({ page }) => {
    await page.goto('/library/collections/generate');
    await waitSeeded(page);

    await expect(page.getByRole('heading', { name: 'AI Generate Collection' })).toBeVisible();
    await expect(page.getByLabel('Collection generate keyword')).toBeVisible();
    await expect(page.getByRole('button', { name: /beginner/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /intermediate/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /advanced/i })).toBeVisible();
  });
});
