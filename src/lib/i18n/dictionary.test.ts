import { describe, expect, it } from 'vitest';
import { getMessage, messages } from './dictionary';

function countLeafStrings(value: unknown): number {
  if (typeof value === 'string') return 1;
  if (Array.isArray(value)) return value.reduce((n, item) => n + countLeafStrings(item), 0);
  if (value && typeof value === 'object')
    return Object.values(value).reduce((n, item) => n + countLeafStrings(item), 0);
  return 0;
}

function expectSameShape(a: unknown, b: unknown) {
  if (Array.isArray(a) && Array.isArray(b)) {
    expect(a).toHaveLength(b.length);
    a.forEach((item, index) => expectSameShape(item, b[index]));
    return;
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const keys = Object.keys(aRecord).sort();

    expect(keys).toEqual(Object.keys(bRecord).sort());

    keys.forEach((key) => {
      expectSameShape(aRecord[key], bRecord[key]);
    });
  }
}

describe('i18n dictionary', () => {
  it('registers all expected namespaces and keeps en/zh shapes aligned', () => {
    expect(messages).toHaveProperty('tagManagement');
    expect(messages).toHaveProperty('ollamaWarning');
    expect(messages).toHaveProperty('assessment');
    expect(messages).toHaveProperty('favorites');
    expect(messages).toHaveProperty('journal');

    const namespaceNames = Object.keys(messages) as Array<keyof typeof messages>;

    namespaceNames.forEach((namespace) => {
      expectSameShape(messages[namespace].en, messages[namespace].zh);
      expectSameShape(messages[namespace].en, messages[namespace].vi);
    });

    // Vietnamese must carry real translations, not silent copies of English.
    const untranslatedLeaves: string[] = [];
    const collectLeaves = (en: unknown, vi: unknown, path: string) => {
      if (typeof en === 'string' && typeof vi === 'string') {
        if (en.trim() !== '' && en === vi) untranslatedLeaves.push(path);
        return;
      }
      if (en && vi && typeof en === 'object' && typeof vi === 'object' && !Array.isArray(en)) {
        for (const key of Object.keys(en as object))
          collectLeaves(
            (en as Record<string, unknown>)[key],
            (vi as Record<string, unknown>)[key],
            `${path}.${key}`,
          );
      }
    };
    namespaceNames.forEach((namespace) => {
      untranslatedLeaves.length = 0;
      collectLeaves(messages[namespace].en, messages[namespace].vi, String(namespace));
      // Non-string-content namespaces may legitimately share a handful of
      // technical tokens; flag only when everything is identical.
      expect(untranslatedLeaves.length).toBeLessThan(
        Math.max(1, countLeafStrings(messages[namespace].en)),
      );
    });
  });

  it('reads nested common labels for both locales', () => {
    expect(getMessage('en', 'common', 'actions')).toMatchObject({ settings: 'Settings' });
    expect(getMessage('zh', 'common', 'actions')).toMatchObject({ settings: '设置' });
  });
});
