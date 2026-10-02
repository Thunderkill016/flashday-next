import { test, expect } from '@playwright/test';

// The /speak surface is a scenario picker: a free-conversation entry plus a
// grid of guided scenarios linking to /speak/<scenarioId> conversation pages.
async function gotoSpeak(page: import('@playwright/test').Page, url = '/speak') {
  await page.goto(url);
  await page.waitForSelector('main[data-seeded="true"]', { timeout: 30000 });
}

test.describe('Speak / Read Module', () => {
  test('speak list page loads with content', async ({ page }) => {
    await gotoSpeak(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Speak');
    await expect(page.getByText('Practice English through conversation with AI')).toBeVisible();
    await expect(page.getByTestId('speak-free-conversation-entry')).toBeVisible();
    await expect(page.getByRole('link').filter({ hasText: 'Ordering Coffee' })).toBeVisible();
  });

  test('speak list has category filters', async ({ page }) => {
    await gotoSpeak(page);
    for (const label of ['All', 'Daily', 'Work', 'Travel', 'Social']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await page.getByText('Travel', { exact: true }).click();
    await expect(page.getByRole('link').filter({ hasText: 'Hotel Check-in' })).toBeVisible();
    await expect(page.getByRole('link').filter({ hasText: 'Ordering Coffee' })).toHaveCount(0);
  });

  test('clicking a scenario navigates to its conversation page', async ({ page }) => {
    await gotoSpeak(page);
    await page.getByRole('link').filter({ hasText: 'Ordering Coffee' }).first().click();
    await expect(page).toHaveURL(/\/speak\/.+/);
    await expect(page.getByRole('heading', { name: 'Ordering Coffee', level: 1 })).toBeVisible();
  });

  test('speak detail page has voice input and controls', async ({ page }) => {
    await gotoSpeak(page);
    await page.getByRole('link').filter({ hasText: 'Ordering Coffee' }).first().click();
    await expect(page).toHaveURL(/\/speak\/.+/);
    await expect(page.getByRole('button', { name: 'Back to scenarios' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Speak scenario input' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send speak scenario message' })).toBeVisible();
  });

  test('speak detail back button returns to list', async ({ page }) => {
    await gotoSpeak(page);
    await page.getByRole('link').filter({ hasText: 'Ordering Coffee' }).first().click();
    await expect(page).toHaveURL(/\/speak\/.+/);
    await page.getByRole('button', { name: 'Back to scenarios' }).click();
    await expect(page).toHaveURL(/\/speak$/);
  });

  test('speak detail shows scenario title and difficulty', async ({ page }) => {
    await gotoSpeak(page);
    await page.getByRole('link').filter({ hasText: 'Ordering Coffee' }).first().click();
    await expect(page.getByRole('heading', { name: 'Ordering Coffee', level: 1 })).toBeVisible();
    await expect(page.getByText('beginner', { exact: true })).toBeVisible();
  });
});
