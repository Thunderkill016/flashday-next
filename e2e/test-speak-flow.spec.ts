import { test, expect, type Page } from '@playwright/test';

// The /speak surface is a scenario picker linking to /speak/<id> conversation
// pages. /api/speak needs a live LLM provider, so tests that send a message
// stub the route with a text stream.

async function gotoSpeak(page: Page) {
  await page.goto('/speak');
  await page.waitForSelector('main[data-seeded="true"]', { timeout: 30000 });
}

async function mockSpeakApi(page: Page) {
  // The conversation hook skips the fetch entirely without a configured
  // provider — point it at Ollama (no key required) and stub the route.
  await page.addInitScript(() => {
    // provider-store persists a flat {providers, activeProviderId} object
    // (src/stores/provider-store.ts saveToStorage), not a zustand envelope.
    localStorage.setItem(
      'echotype_provider_config',
      JSON.stringify({
        providers: {
          ollama: {
            auth: { type: 'none' },
            selectedModelId: 'llama3.2',
            baseUrl: 'http://localhost:11434/v1',
            noModelApi: true,
          },
        },
        activeProviderId: 'ollama',
      }),
    );
  });
  await page.route('**/api/speak', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: 'Sure! What would you like to order?',
    }),
  );
}

async function openOrderingCoffee(page: Page) {
  await page.getByRole('link').filter({ hasText: 'Ordering Coffee' }).first().click();
  await page.waitForURL(/\/speak\/[^/]+/, { timeout: 15000 });
}

test.describe('Speak Module Flow Test', () => {
  test.beforeEach(async ({ page }) => {
    await mockSpeakApi(page);
    await gotoSpeak(page);
  });

  test('should display scenario grid on speak homepage', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Speak');
    await expect(page.getByText('Practice English through conversation with AI')).toBeVisible();
    await expect(page.getByRole('link').filter({ hasText: 'Ordering Coffee' }).first()).toBeVisible();
  });

  test('should navigate to conversation page and test text input', async ({ page }) => {
    await openOrderingCoffee(page);

    await expect(page.getByRole('heading', { name: 'Ordering Coffee', level: 1 })).toBeVisible();
    await expect(page.getByText('beginner', { exact: true })).toBeVisible();

    const textInput = page.getByLabel('Speak scenario input');
    await expect(textInput).toBeVisible();
    const userMessage = "Hi, I'd like to order a coffee please";
    await textInput.fill(userMessage);
    await page.getByLabel('Send speak scenario message').click();

    await expect(page.getByText(userMessage).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Sure! What would you like to order?')).toBeVisible({ timeout: 15000 });
  });

  test('should check API integration and streaming', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/speak')) apiRequests.push(request.url());
    });
    await openOrderingCoffee(page);

    const textInput = page.getByLabel('Speak scenario input');
    await textInput.fill('I want a latte');
    await page.getByLabel('Send speak scenario message').click();

    await expect(page.getByText('Sure! What would you like to order?')).toBeVisible({ timeout: 15000 });
    expect(apiRequests.length).toBeGreaterThan(0);
  });
});
