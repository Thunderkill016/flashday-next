import { expect, type Page, test } from '@playwright/test';

// Vietnam-first policy (FDN-ARCH-001): fresh installs always land on
// Vietnamese regardless of browser locale; only an explicitly saved
// preference can keep en/zh. The init scripts below clear the saved
// preference once per test (sessionStorage flag) so reloads preserve it.

const clearOnce = (browserLanguage: string) => `
  if (!sessionStorage.getItem('__i18nTestInit')) {
    sessionStorage.setItem('__i18nTestInit', '1');
    localStorage.removeItem('echotype_language_settings');
  }
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    get: () => '${browserLanguage}',
  });
`;


// First visit on a fresh profile must outlast cold IndexedDB seeding
// (~15s observed) plus dev-server compile; the layout gates children on it.
const SEED_TIMEOUT_MS = 120_000;
const gotoSeeded = async (page: Page, url: string) => {
  await page.goto(url);
  await expect(page.locator('main[data-seeded]')).toHaveAttribute('data-seeded', 'true', { timeout: SEED_TIMEOUT_MS });
};

const reloadSeeded = async (page: Page) => {
  await page.reload();
  await expect(page.locator('main[data-seeded]')).toHaveAttribute('data-seeded', 'true', { timeout: SEED_TIMEOUT_MS });
};

test.describe('vietnam-first i18n', () => {
  test('fresh install under en-US browser renders Vietnamese dashboard and <html lang="vi">', async ({
    page,
  }) => {
    await page.addInitScript(clearOnce('en-US'));
    await gotoSeeded(page, '/dashboard');

    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chào mừng đến FlashDay');
    await expect(page.getByText('Giao diện đang dùng tiếng Việt')).toBeVisible();
    await expect(page.getByText('Bắt đầu học').first()).toBeVisible();
  });

  test('fresh install under zh-CN browser renders Vietnamese, not Chinese', async ({ page }) => {
    await page.addInitScript(clearOnce('zh-CN'));
    await gotoSeeded(page, '/dashboard');

    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chào mừng đến FlashDay');
    await expect(page.getByText('欢迎使用 FlashDay')).toHaveCount(0);
  });

  test('fresh install under vi-VN browser renders Vietnamese', async ({ page }) => {
    await page.addInitScript(clearOnce('vi-VN'));
    await gotoSeeded(page, '/dashboard');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chào mừng đến FlashDay');
  });

  test('explicit saved English preference is preserved', async ({ page }) => {
    await page.addInitScript(`
      localStorage.setItem('echotype_language_settings', JSON.stringify({
        interfaceLanguage: 'en',
        hasExplicitPreference: true,
      }));
      Object.defineProperty(window.navigator, 'language', {
        configurable: true,
        get: () => 'vi-VN',
      });
    `);
    await gotoSeeded(page, '/dashboard');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to FlashDay');
  });

  test('explicit saved Chinese preference is preserved', async ({ page }) => {
    await page.addInitScript(`
      localStorage.setItem('echotype_language_settings', JSON.stringify({
        interfaceLanguage: 'zh',
        hasExplicitPreference: true,
      }));
      Object.defineProperty(window.navigator, 'language', {
        configurable: true,
        get: () => 'vi-VN',
      });
    `);
    await gotoSeeded(page, '/dashboard');

    await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('欢迎使用 FlashDay');
  });

  test('corrupt saved language falls back to Vietnamese', async ({ page }) => {
    await page.addInitScript(`
      localStorage.setItem('echotype_language_settings', '{bad json');
    `);
    await gotoSeeded(page, '/dashboard');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chào mừng đến FlashDay');
  });

  test('unknown saved language value falls back to Vietnamese', async ({ page }) => {
    await page.addInitScript(`
      localStorage.setItem('echotype_language_settings', JSON.stringify({
        interfaceLanguage: 'xx',
        hasExplicitPreference: true,
      }));
    `);
    await gotoSeeded(page, '/dashboard');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chào mừng đến FlashDay');
  });

  test('switching Vietnamese → English updates immediately and persists across reload and navigation', async ({
    page,
  }) => {
    await page.addInitScript(clearOnce('vi-VN'));
    await gotoSeeded(page, '/settings');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cài đặt');
    await expect(page.getByRole('heading', { name: 'Ngôn ngữ' })).toBeVisible();

    await page.getByTestId('settings-language-en').click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');

    await reloadSeeded(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');

    await gotoSeeded(page, '/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to FlashDay');
    await expect(page.getByText('Giao diện đang dùng tiếng Việt')).toHaveCount(0);
  });

  test('switching Chinese → Vietnamese persists across reload', async ({ page }) => {
    await page.addInitScript(`
      if (!sessionStorage.getItem('__i18nTestInit')) {
        sessionStorage.setItem('__i18nTestInit', '1');
        localStorage.setItem('echotype_language_settings', JSON.stringify({
          interfaceLanguage: 'zh',
          hasExplicitPreference: true,
        }));
      }
    `);
    await gotoSeeded(page, '/settings');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('设置');

    await page.getByTestId('settings-language-vi').click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cài đặt');

    await reloadSeeded(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cài đặt');
  });

  test('URL import surface localizes under Chinese preference', async ({ page }) => {
    await page.addInitScript(`
      if (!sessionStorage.getItem('__i18nTestInit')) {
        sessionStorage.setItem('__i18nTestInit', '1');
        localStorage.setItem('echotype_language_settings', JSON.stringify({
          interfaceLanguage: 'zh',
          hasExplicitPreference: true,
        }));
      }
    `);

    await page.route('**/api/import/url', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await gotoSeeded(page, '/library?import=url');
    await page.getByRole('button', { name: '粘贴链接' }).click();
    await expect(page.getByText('从链接导入材料')).toBeVisible();
    await page.getByLabel('来源网址').fill('https://example.com/article');
    await page.getByRole('button', { name: '开始处理' }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    await gotoSeeded(page, '/settings');
    await page.getByRole('button', { name: /English/ }).first().click();

    await gotoSeeded(page, '/library?import=url');
    await page.getByRole('button', { name: 'Paste link' }).click();
    await expect(page.getByText('Learn from a link')).toBeVisible();
    await expect(page.getByLabel('Source URL')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start processing' })).toBeVisible();
  });

  test('URL import surface renders Vietnamese by default', async ({ page }) => {
    await page.addInitScript(clearOnce('en-US'));

    await page.route('**/api/import/url', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await gotoSeeded(page, '/library?import=url');
    await page.getByRole('button', { name: 'Dán liên kết' }).click();
    await expect(page.getByText('Học từ một liên kết')).toBeVisible();
    await page.getByLabel('URL nguồn').fill('https://example.com/article');
    await page.getByRole('button', { name: 'Bắt đầu xử lý' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('all learning surfaces render Vietnamese on fresh install', async ({ page }) => {
    await page.addInitScript(clearOnce('en-US'));

    const surfaces: Array<{ path: string; text: string }> = [
      { path: '/learn', text: 'Kệ học tập của bạn' },
      { path: '/library', text: 'Tài liệu học' },
      { path: '/listen', text: 'Nghe' },
      { path: '/read', text: 'Đọc' },
      { path: '/write', text: 'Viết' },
      { path: '/speak', text: 'Nói' },
      { path: '/review', text: 'Trung tâm ôn tập' },
      { path: '/settings', text: 'Cài đặt' },
      { path: '/login', text: 'Đăng nhập FlashDay' },
    ];

    for (const { path, text } of surfaces) {
      await gotoSeeded(page, path);
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
    }
  });

  test('fresh install defaults translation target to Vietnamese', async ({ page }) => {
    await page.addInitScript(clearOnce('vi-VN'));
    await gotoSeeded(page, '/settings');

    await expect(page.getByRole('heading', { name: 'Dịch thuật' })).toBeVisible();
    await expect(page.locator('main').getByText('Tiếng Việt (Vietnamese)').first()).toBeVisible();
  });

  test('explicit saved translation target is preserved', async ({ page }) => {
    // vi UI + an explicit non-vi target: the select must show the saved
    // choice, proving the default is a default and not an overwrite.
    await page.addInitScript(`
      localStorage.setItem('echotype_language_settings', JSON.stringify({
        interfaceLanguage: 'vi', hasExplicitPreference: true,
      }));
      localStorage.setItem('echotype_tts_settings', JSON.stringify({ targetLang: 'en' }));
    `);
    await gotoSeeded(page, '/settings');

    const targetSection = page.getByText('Ngôn ngữ đích').locator('..');
    const trigger = targetSection.getByRole('combobox');
    await expect(trigger).toHaveText('English');
  });
});
