import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTTSStore } from './tts-store';

const storage = new Map<string, string>();

const localStorageMock: Storage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => storage.clear(),
  get length() {
    return storage.size;
  },
  key: (index: number) => [...storage.keys()][index] ?? null,
};

vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('window', globalThis);

describe('tts-store translation target', () => {
  beforeEach(() => {
    storage.clear();
    useTTSStore.setState({ hydrated: false, targetLang: 'vi' });
  });

  it('defaults fresh installs to vietnamese', () => {
    useTTSStore.getState().hydrate();
    expect(useTTSStore.getState().targetLang).toBe('vi');
  });

  it('preserves an explicit saved target', () => {
    storage.set('echotype_tts_settings', JSON.stringify({ targetLang: 'ja' }));
    useTTSStore.getState().hydrate();
    expect(useTTSStore.getState().targetLang).toBe('ja');
  });

  it('migrates legacy zh to zh-CN', () => {
    storage.set('echotype_tts_settings', JSON.stringify({ targetLang: 'zh' }));
    useTTSStore.getState().hydrate();
    expect(useTTSStore.getState().targetLang).toBe('zh-CN');
  });

  it('drops an invalid target and falls back to vietnamese', () => {
    storage.set('echotype_tts_settings', JSON.stringify({ targetLang: 'klingon' }));
    useTTSStore.getState().hydrate();
    expect(useTTSStore.getState().targetLang).toBe('vi');
  });
});
