import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER !== 'false';

export default defineConfig({
  testDir: './e2e',
  /* Dev-mode route recompiles under parallel browser load can exceed
   * the 30s default — the failure mode is a stuck loader, not a crash. */
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /* 4 parallel Chromium instances against a dev server that recompiles
   * on reload starve the seed gate — 2 workers is the stable local
   * bound; CI stays serial. */
  workers: process.env.CI ? 1 : 2,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Reuse the full Chrome build already installed for
        // playwright-mcp; browser downloads are slow on this network.
        launchOptions: {
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
            '/home/thunder/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
        },
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: process.env.CI ? false : reuseExistingServer,
    timeout: 30000,
  },
});
