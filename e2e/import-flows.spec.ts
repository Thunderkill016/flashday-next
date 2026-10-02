import { expect, test, type Page } from '@playwright/test';

// Legacy multi-tab import page (Media / Local Upload / AI Generate tabs,
// "Import to Library") was removed. Import now runs through the material
// wizard on /library (?import=text|file|url), covered in depth by
// durable-import.spec.ts and import-design-fidelity.spec.ts. This spec
// keeps the durable end-to-end intent: import → lands in library →
// searchable and startable.

const SEED_TIMEOUT_MS = 120_000;
const waitSeeded = (page: Page) =>
  page.waitForSelector('main[data-seeded="true"]', { timeout: SEED_TIMEOUT_MS });

async function expectLibraryContains(page: Page, title: string) {
  await page.getByLabel('Close import').click();
  await expect(page).toHaveURL(/\/library/);
  await page.getByPlaceholder('Search materials…').fill(title);
  await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15000 });
}

test.describe('Import Flows', () => {
  test('imports pasted text content', async ({ page }) => {
    const title = 'E2E Text Import';

    await page.goto('/library?import=text');
    await waitSeeded(page);
    await page.getByRole('textbox', { name: 'Your text' }).fill(
      'This is a stable local E2E check for the text import flow.',
    );
    await page.getByRole('button', { name: 'Review content', exact: true }).click();
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByLabel('Material type', { exact: true }).selectOption('sentences');
    await page.getByLabel('Material title', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Add to library', exact: true }).click();

    await expectLibraryContains(page, title);
  });

  test('imports uploaded document content', async ({ page }) => {
    const title = 'E2E File Import';

    await page.goto('/library?import=file');
    await waitSeeded(page);
    await page.getByTestId('durable-import-file').setInputFiles({
      name: 'sample.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'FlashDay file upload verification.\n\nThis sample validates text extraction and library save behavior.',
      ),
    });
    await page.getByRole('button', { name: 'Start processing', exact: true }).click();
    await page.getByRole('button', { name: /Review ready material/ }).click();
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByLabel('Material title', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Add to library', exact: true }).click();

    await expectLibraryContains(page, title);
  });

  test('imports YouTube media with mocked caption API', async ({ page }) => {
    const title = 'E2E Media URL Import';

    await page.route('**/api/import/youtube', (route) =>
      route.fulfill({
        json: {
          videoId: 'abc123',
          timeUnit: 'milliseconds',
          fullText: 'First caption. Second caption.',
          segments: [
            { offset: 1000, duration: 2000, text: 'First caption.' },
            { offset: 4000, duration: 2000, text: 'Second caption.' },
          ],
        },
      }),
    );

    await page.goto('/library?import=url');
    await waitSeeded(page);
    await page.getByLabel('Source URL').fill('https://www.youtube.com/watch?v=abc123');
    await page.getByRole('button', { name: 'Start processing', exact: true }).click();
    await page.getByRole('button', { name: /Review ready material/ }).click();
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByLabel('Material title', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Add to library', exact: true }).click();

    await expectLibraryContains(page, title);
  });
});
