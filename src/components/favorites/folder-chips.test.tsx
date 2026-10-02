import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ lang: 'vi' as 'vi' | 'en' | 'zh' }));

// renderToStaticMarkup serves the language store's initial state only, so the
// hook is mocked to the real dictionaries at a controlled language instead.
vi.mock('@/lib/i18n/use-i18n', async () => {
  const dictionary = await import('@/lib/i18n/dictionary');
  return {
    useI18n: (namespace: keyof typeof dictionary.messages) => ({
      interfaceLanguage: mocked.lang,
      messages: dictionary.getLanguageMessages(mocked.lang)[namespace],
      t: <K extends string>(key: K, values?: Record<string, string | number>) =>
        dictionary.translate(mocked.lang, namespace, key as never, values),
    }),
  };
});

vi.mock('@/lib/tauri', () => ({
  detectIOSNativeHost: () => false,
}));

vi.mock('@/stores/favorite-store', () => ({
  useFavoriteStore: (selector: (state: unknown) => unknown) =>
    selector({
      folders: [
        { id: 'default', name: '默认收藏', emoji: '⭐', sortOrder: 0, createdAt: 1 },
        { id: 'auto', name: '智能收藏', emoji: '🤖', sortOrder: 1, createdAt: 2 },
        { id: 'empty-folder', name: '单词收藏', emoji: '📚', sortOrder: 2, createdAt: 3 },
      ],
      favorites: [],
      activeFolderId: null,
      setActiveFolderId: vi.fn(),
    }),
}));

vi.mock('./folder-manage-dialog', () => ({
  FolderManageDialog: () => null,
}));

import { FolderChips } from './folder-chips';

describe('FolderChips', () => {
  it('shows newly created folders even when they do not contain favorites yet', () => {
    mocked.lang = 'vi';
    const markup = renderToStaticMarkup(<FolderChips />);

    expect(markup).toContain('📚 单词收藏');
  });

  it('renders Vietnamese chrome and localized reserved folders by default', () => {
    mocked.lang = 'vi';
    const markup = renderToStaticMarkup(<FolderChips />);

    expect(markup).toContain('Tất cả');
    expect(markup).toContain('Quản lý');
    expect(markup).toContain('Mặc định');
    expect(markup).toContain('Thông minh');
    expect(markup).not.toContain('默认收藏');
    expect(markup).not.toContain('智能收藏');
    expect(markup).not.toContain('>All<');
  });

  it('renders English chrome and localized reserved folders under en preference', () => {
    mocked.lang = 'en';
    const markup = renderToStaticMarkup(<FolderChips />);

    expect(markup).toContain('>All<');
    expect(markup).toContain('Manage');
    expect(markup).toContain('Default');
    expect(markup).toContain('Smart');
    expect(markup).not.toContain('默认收藏');
  });

  it('renders Chinese chrome under zh preference and keeps user-authored names intact', () => {
    mocked.lang = 'zh';
    const markup = renderToStaticMarkup(<FolderChips />);

    expect(markup).toContain('全部');
    expect(markup).toContain('管理');
    expect(markup).toContain('默认收藏');
    expect(markup).toContain('智能收藏');
    expect(markup).toContain('📚 单词收藏');
  });
});
