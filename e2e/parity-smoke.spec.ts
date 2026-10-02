import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

const SEED_TIMEOUT_MS = 120_000;
const waitSeeded = (page: Page) =>
  page.waitForSelector('main[data-seeded="true"]', { timeout: SEED_TIMEOUT_MS });

async function waitForVoicePickerReady(page: Page) {
  const loadingVoices = page.getByText('Loading voices...');
  if (await loadingVoices.count()) {
    await expect(loadingVoices).not.toBeVisible({ timeout: 15000 });
  }

  await expect(
    page
      .getByPlaceholder('Search Edge voices by name, accent, or gender...')
      .or(page.getByPlaceholder('Search voices by name, accent, or provider...'))
      .or(page.getByText('No voices available.')),
  ).toBeVisible({ timeout: 15000 });
}

async function findLibraryRow(page: Page, title: string): Promise<Locator> {
  await page.getByPlaceholder('Search materials…').fill(title);
  const row = page.locator('li').filter({ hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  return row;
}

test.describe('Parity Smoke', () => {
  test('web shell core flows stay healthy and library actions remain clickable with chat open', async ({ page }) => {
    const title = `Parity Smoke ${Date.now()}`;

    await page.goto('/dashboard');
    await waitSeeded(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome to FlashDay');
    await expect(page.getByLabel('Open AI chat')).toBeVisible();

    await page.goto('/settings');
    await waitSeeded(page);
    await expect(page.getByRole('heading', { name: 'Voice & Speech' })).toBeVisible();
    await waitForVoicePickerReady(page);

    // Text import through the material wizard (the legacy /library/import
    // page now redirects here).
    await page.goto('/library?import=text');
    await waitSeeded(page);
    await page.getByRole('textbox', { name: 'Your text' }).fill('This is a parity smoke test sentence for FlashDay.');
    await page.getByRole('button', { name: 'Review content', exact: true }).click();
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByLabel('Material type', { exact: true }).selectOption('sentences');
    await page.getByLabel('Material title', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Add to library', exact: true }).click();

    await page.getByLabel('Close import').click();
    await expect(page).toHaveURL(/\/library/);
    const row = await findLibraryRow(page, title);

    await page.getByLabel('Open AI chat').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();
    // Row stays visible under the open chat panel…
    await expect(row.getByRole('link', { name: /^(Start|Study|Continue) / })).toBeVisible();
    // …but the 420px panel overlays the action column, so close before clicking.
    await page.getByLabel('Close chat').click();

    await row.getByRole('link', { name: /^(Start|Study|Continue) / }).click();
    await expect(page).toHaveURL(/\/learn\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
    // Wizard imports land in learningUnits (not `contents`), so module
    // pages like /listen don't list them — the /learn route is the
    // canonical surface, proven above.
  });
});
