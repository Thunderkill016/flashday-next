# Vietnamization Audit — FDN-ARCH-001

## 1. Original i18n architecture (inherited)

- `language-store.ts`: `InterfaceLanguage = 'en' | 'zh'`, browser-locale
  detection made Vietnamese users fall back to English.
- `i18n/dictionary.ts`: per-namespace `{ en, zh }` bundles, `useI18n(ns)` hook.
- ~493 inline `t(en, zh)` positional helpers and ~93 `zh ? … : …` branches
  scattered through components — no third locale could plug in.
- Learner-support defaults (`tts-store.targetLang`, `/api/translate/free`
  fallback, settings pickers) hard-coded Chinese.

## 2. Registered namespaces (from `messages/` loaders)

33 production namespaces now ship `en`/`vi`/`zh` bundles with enforced key
parity (dictionary.test.ts asserts shape equality per namespace plus a
real-translation check — vi may not silently equal en).

## 3. Chinese-first assumptions found & corrected

| Location | Before | After |
|---|---|---|
| language-store | `en|zh`, browser-detect default en | `vi|en|zh`, policy default `vi`; explicit prefs preserved |
| `detectInterfaceLanguage` | zh browser → zh | any browser → vi unless saved pref |
| `tts-store` default targetLang | implicit zh | `DEFAULT_TRANSLATION_TARGET='vi'` (centralized in `locale.ts`) |
| `/api/translate/free` fallback | `'zh'` | `DEFAULT_TRANSLATION_TARGET` |
| `journal-store` | zh target default | reads tts-store targetLang |
| `vocabulary-practice` | zh target default | reads tts-store targetLang |
| `ios-native-qa` mock translation | zh prefix only | zh + vi branches |
| settings language selector | English/中文 | Tiếng Việt/English/中文, vi first |
| settings target-language list | zh-first list | vi first, 10 languages |
| `t(en, zh)` helpers (493 call sites) | two-arg | three-arg `t(en, zh, vi)` or `useLT()` |
| `zh ? a : b` branches (93 sites) | binary | `pickLocale`/Localized objects |
| `DailyTask` title/reason | `titleZh`/`reasonZh` render | +`titleVi`/`reasonVi` populated at generation |
| `StudioSound.tip` | en/zh tips | +`tipVi` for all 49 sounds incl. consonantVi |
| `builtin-collections` (107) | title/titleZh, description/descriptionZh | +`titleVi`/`descriptionVi` |
| `MATERIAL_LABELS` | `{en, zh}` | `{en, zh, vi}` Localized |
| import errors | `describeImportError(zh: boolean)` | `describeImportError(lang)` |
| provider descriptions | en/zh LOCALES | en/zh/vi LOCALES |
| nav/section nav/sidebar | en/zh | en/zh/vi |
| `aria-label="Source URL"` hard-coded | en only | localized `t()` |
| `html lang` | en/zh | reflects vi via I18nProvider (already reactive) |

## 4. Defaults before → after

| Surface | Before | After |
|---|---|---|
| Fresh-install UI language | en (zh browser → zh) | vi (all browsers) |
| `<html lang>` | en/zh | vi/en/zh reactive |
| Translation/support target | zh | vi |
| Selector order | en, zh | vi, en, zh |

## 5. Migration behavior

- Saved `{interfaceLanguage: 'en'|'zh', hasExplicitPreference: true}` → kept.
- Corrupt/unknown stored language → vi, no data loss.
- Saved `targetLang:'zh'` (legacy) → migrated to `'zh-CN'` on hydrate;
  unknown targets dropped → default `vi`.

## 6. Coverage

- 33/33 reachable namespaces have vi bundles (parity test enforced).
- `mission` copy authored vi-native in PR #1 — untouched.
- Vietnamese authored for learners (concise, not machine-bulk); provider and
  technical names left untranslated per policy; `{{placeholders}}` preserved
  (verified by parity test after `youSaid` fix).

## 7. Deferred surfaces (documented, not localized or structural)

- `WordBook.name` is the *Chinese* name (`nameEn` = English, no `nameVi`) —
  schema itself is Chinese-first. Content-level rename deferred.
- iOS QA seed fixture `targetLang:'zh-CN'` — deterministic test data, kept.
- Design-prototype HTML file (inline Chinese, not shipped) — DELETE CANDIDATE.
- TTS voice names/labels stay canonical.
- Date/number formatting now routes through `LOCALE_TAGS` (vi-VN).

## 8. Regression coverage

- `e2e/i18n.spec.ts` — 14 tests: fresh→vi under en-US/zh-CN/vi-VN, explicit
  en/zh preserved, corrupt/unknown→vi, vi↔en↔zh switching + reload/nav
  persistence, `html lang`, URL-import localization (vi + zh), all learning
  surfaces vi, translation-target default vi + explicit preserved.
- `dictionary.test.ts` — namespace registration + en/vi/zh parity + real-vi.
- `language-store.test.ts` — detection policy pins.
- `tts-store.test.ts` — target default/migration/invalid-drop pins.
- `mission-falsification` (3) + `mission-meet-person` (1) e2e — evidence
  invariants unchanged.
