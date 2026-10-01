import { type InterfaceLanguage, useLanguageStore } from '@/stores/language-store';

/**
 * Canonical BCP-47 tags per interface language — the single place that
 * maps FlashDay's three UI languages to Intl/toLocale* tags.
 */
export const LOCALE_TAGS: Record<InterfaceLanguage, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  zh: 'zh-CN',
};

/**
 * FlashDay is Vietnam-first: a fresh learner's translation/support target
 * is Vietnamese. Provider-compatible canonical code. Existing explicit
 * targets are persisted elsewhere and preserved — this is only a default.
 */
export const DEFAULT_TRANSLATION_TARGET = 'vi';

/** Translation/support targets offered in Settings and accepted on hydrate. */
export const TRANSLATION_TARGETS = ['vi', 'en', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru'] as const;

export type TranslationTarget = (typeof TRANSLATION_TARGETS)[number];

export function isTranslationTarget(value: unknown): value is TranslationTarget {
  return typeof value === 'string' && (TRANSLATION_TARGETS as readonly string[]).includes(value);
}

/** A UI string available in every interface language. */
export interface Localized {
  vi: string;
  en: string;
  zh: string;
}

/**
 * Locale-indexed pick with English as the safety net — replaces binary
 * `lang === 'zh' ? … : …` branching. Missing vi/zh falls back to en.
 */
export function pickLocale(language: InterfaceLanguage, values: Localized): string {
  return values[language] ?? values.en;
}

/** React hook form of `pickLocale` for components. */
export function useL() {
  const language = useLanguageStore((s) => s.interfaceLanguage);
  return (values: Localized) => pickLocale(language, values);
}

/**
 * Positional picker matching the inherited `t('en', '中文')` call shape —
 * call sites append their Vietnamese string as the third argument instead
 * of branching on the language themselves.
 */
export function useLT() {
  const language = useLanguageStore((s) => s.interfaceLanguage);
  return (en: string, zh: string, vi: string) => pickLocale(language, { en, zh, vi });
}
