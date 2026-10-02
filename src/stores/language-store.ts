import { create } from 'zustand';

const STORAGE_KEY = 'echotype_language_settings';

export type InterfaceLanguage = 'vi' | 'en' | 'zh';

interface LanguageSettings {
  interfaceLanguage: InterfaceLanguage;
  hasExplicitPreference: boolean;
}

interface LanguageStore extends LanguageSettings {
  setInterfaceLanguage: (lang: InterfaceLanguage) => void;
  initialized: boolean;
  initialize: () => void;
  hydrate: () => void;
}

function isInterfaceLanguage(value: unknown): value is InterfaceLanguage {
  return value === 'vi' || value === 'en' || value === 'zh';
}

/**
 * FlashDay is Vietnam-first: the fresh-install UI language is a product
 * policy decision, NOT browser detection. Any browser locale resolves to
 * Vietnamese unless the learner explicitly saved another language.
 */
export const DEFAULT_INTERFACE_LANGUAGE: InterfaceLanguage = 'vi';

export function detectInterfaceLanguage(_browserLanguage?: string | null): InterfaceLanguage {
  return DEFAULT_INTERFACE_LANGUAGE;
}

function loadSettings(): Partial<LanguageSettings> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<LanguageSettings>;
    if (!isInterfaceLanguage(parsed.interfaceLanguage)) return {};

    return {
      interfaceLanguage: parsed.interfaceLanguage,
      hasExplicitPreference: parsed.hasExplicitPreference === true,
    };
  } catch {
    return {};
  }
}

function saveSettings(settings: LanguageSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  interfaceLanguage: DEFAULT_INTERFACE_LANGUAGE,
  hasExplicitPreference: false,
  initialized: false,

  setInterfaceLanguage: (interfaceLanguage) => {
    set({ interfaceLanguage, hasExplicitPreference: true, initialized: true });
    saveSettings({ interfaceLanguage, hasExplicitPreference: true });
  },

  initialize: () => {
    const saved = loadSettings();

    if (saved.interfaceLanguage && saved.hasExplicitPreference) {
      set({
        interfaceLanguage: saved.interfaceLanguage,
        hasExplicitPreference: true,
        initialized: true,
      });
      return;
    }

    /* Vietnam-first: only an explicitly saved preference survives. A stored
     * language without the explicit flag (never persisted, flag lost, or
     * legacy write) is not a learner choice — fall back to Vietnamese. */
    set({
      interfaceLanguage: DEFAULT_INTERFACE_LANGUAGE,
      hasExplicitPreference: saved.hasExplicitPreference ?? false,
      initialized: true,
    });
  },

  hydrate: () => {
    useLanguageStore.getState().initialize();
  },
}));
