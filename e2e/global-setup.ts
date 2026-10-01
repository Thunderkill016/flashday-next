import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const SEEDED_STORAGE_PATH = 'e2e/fixtures/seeded-en.storage.json';

/**
 * Cold IndexedDB seed (builtin contents, wordbooks, course reconciliation)
 * takes ~15-25s on a fresh profile and gates every (app) route behind
 * `main[data-seeded="true"]`. Most legacy specs never waited for it and
 * raced the gate, so the suite flaked under load. Seed once here, snapshot
 * IndexedDB (Playwright >=1.51 restores it per context), and pin the
 * explicit 'en' preference that English-asserting specs rely on.
 */
export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
    '/home/thunder/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';

  const browser = await chromium.launch({ executablePath });
  try {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await page.waitForSelector('main[data-seeded="true"]', { timeout: 180_000 });

    await page.evaluate(() => {
      localStorage.setItem(
        'echotype_language_settings',
        JSON.stringify({ interfaceLanguage: 'en', hasExplicitPreference: true }),
      );
    });

    const outPath = path.resolve(SEEDED_STORAGE_PATH);
    await mkdir(path.dirname(outPath), { recursive: true });
    const state = await context.storageState({ indexedDB: true });
    await writeFile(outPath, JSON.stringify(state));
    await context.close();
  } finally {
    await browser.close();
  }
}
