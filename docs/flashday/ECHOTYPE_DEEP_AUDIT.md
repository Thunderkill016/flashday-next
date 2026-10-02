# EchoType Deep Audit — FDN-ARCH-001

Base audited: `main @ 27191be48e43a6a6a0470fe41d95b6183b0e9dc7` plus the
Vietnam-first delta on `flashday/arch-vietnam-first`.

Method: code-derived inventory, not docs. Numbers measured on the branch HEAD.

---

## 1. Architecture map (from code)

```text
Next.js 16 App Router
  (app)/*                 37 client pages, all gated by (app)/layout.tsx
                          `{seeded ? children : null}` after Dexie seed
  api/*                   40 route handlers (see §1.3)
stores/*                  25 Zustand stores (localStorage-persisted slices)
lib/db.ts                 Dexie "echotype:<user|anonymous>" — schema v21, 24 tables
lib/sync/*                Supabase-backed sync engine + mapper
lib/evidence-bridge/*     FlashDay evidence kernel (attempts → EvidenceEvents)
lib/i18n/*                3-locale dictionary (en/vi/zh), 30+ namespaces
providers                 Vercel AI SDK, 15+ providers via provider-resolver
src-tauri/*               Tauri v2 shell: sidecar runs Next standalone
```

### Quantitative inventory

| Metric | Count |
|---|---|
| API routes | 40 |
| App pages | 37 |
| Zustand stores | 25 |
| Dexie tables | 24 |
| Unit test files | 188 |
| E2E specs | 73 |
| Production deps | 53 |
| TS/TSX LOC | ~106k |

Largest modules (LOC is a size signal, not a quality verdict):
`lib/wordbooks/scenarios.ts` 4525 · `app/(app)/settings/page.tsx` 3009 ·
`lib/builtin-collections.ts` 2901 · `components/shared/word-book-practice.tsx` 1669 ·
`app/(app)/read/[id]/page.tsx` 1394 · `listen/[id]/page.tsx` 1310.

`settings/page.tsx` at 3k lines is a settings monolith — candidate for
splitting by section, deferred (out of scope).

## 2. Architectural findings

1. **Layout seed gate.** `(app)/layout.tsx` renders `{seeded ? children : null}`;
   fresh-install seeding (9784 `contents` + 813 `lessons` + `reconcileLearningUnits`)
   takes ~15 s on a cold dev build. All pages sit behind it — first paint is
   blank. `data-seeded` attribute exposes the gate (used by e2e). *Finding:
   cold-start cost scales with bundled content; document as perf risk.*
2. **Provider key encryption is obfuscation.** `storage-crypto.ts` stores the
   AES-GCM key in the same localStorage (`echotype_dk`) as ciphertext — an
   attacker with same-origin script access reads both. Protects against casual
   shoulder-surfing only. See §security in this doc / MEDIUM.
3. **Dual persistence seams.** Learning state lives in Dexie (24 tables),
   while settings/credentials live in ~15 localStorage keys owned by stores.
   Cross-account isolation relies on per-user DB name
   (`echotype:anonymous` vs user-scoped) — verified: anonymous DB used on
   sign-out; no cross-learner leakage observed in falsification specs.
4. **Evidence kernel vs legacy loops coexist.** `evidenceEvents` +
   `learningAttempts` (FlashDay) sit beside `records`/`sessions`/`weakSpots`/
   `pronunciationProgress` (EchoType). Both write on learning events — see
   STATE_AUTHORITY.md for dispositions.

## 3. Duplicate / accretion findings (de-vibe)

| Finding | Evidence | Disposition |
|---|---|---|
| 13 separate `@ai-sdk/*` provider packages | package.json | KEEP (adapter cost is real) but consolidate via provider-resolver — already the case |
| `pdf-parse` + `pdfjs-dist` both present | package.json | DELETE CANDIDATE — verify which one `import/pdf` actually uses |
| `openai` SDK alongside `@ai-sdk/openai` | package.json | DELETE CANDIDATE — check direct usage |
| `records`/`sessions` accuracy loop vs `evidenceEvents` | db.ts | DEMOTE legacy to display-only (see STATE_AUTHORITY) |
| `weakSpots` vs evidence projection | stores/weak-spots-store.ts | RETIRE after projection parity proven |
| `pronunciationProgress` vs future speech evidence | db.ts | ADAPT — keep table, treat as practice cache |
| Daily planner vs Next For You | daily-plan-store vs evidence-bridge planner | ADAPT — planner already explainable; unify under evidence |
| iOS QA seed `targetLang: 'zh-CN'` fixture | ios-native-qa.ts:235 | KEEP — deterministic fixture, not a product default |
| Design-prototype HTML with inline Chinese | files under repo (biome warns) | DELETE CANDIDATE — dead prototype, not shipped |

## 4. Security / privacy findings

| Severity | Finding | Evidence |
|---|---|---|
| CRITICAL (dep) | `next@16.3.4` vulnerable — GHSA-vcvr-r3jv-pc5j, RCE in `next/og` ImageResponse | `pnpm audit`. `next/og` is **not imported anywhere** (`grep -r "next/og\|ImageResponse" src/` → 0 hits) so no reachable path today; still requires a patch bump `>=16.3.6` in a follow-up. |
| HIGH (dep) | `brace-expansion` DoS ×2 advisories | transitive; no direct usage |
| MEDIUM | Provider/TTS API keys AES-GCM-encrypted but key colocated in localStorage | `storage-crypto.ts:4` `KEY_STORAGE='echotype_dk'` |
| MEDIUM | SSRF guard is literal-IP only — no DNS-resolution check, no redirect re-validation | `web-page.ts:4-40` |
| MEDIUM | Rate limiting covers 12/40 routes; expensive proxies without it: `/api/stt`, `/api/tts/*` (6), `/api/translate/free`, `/api/import/*` (4), `/api/auth/*` | route audit |
| LOW | 10 vulns total per `pnpm audit` (1 crit / 2 high / 6 mod / 1 low) | full table in LICENSE_MATRIX §deps |
| INFO | Anonymous→authenticated DB boundary present; learner data scoped by DB name | layout + sync engine |

No severe defect met the fix bar (reproduction + regression + tight bound)
inside this mission — all are documented for dedicated missions.

## 5. Dependency & supply-chain notes

53 production deps. Notable:
- `@napi-rs/canvas`, `pdfjs-dist` — native/heavy client deps; confirm load path.
- `edge-tts-universal` — **AGPL-3.0** (see LICENSE_MATRIX).
- `jszip` — MIT OR GPL-3.0 dual (MIT election OK).
- `react-speech-recognition` — used only by legacy speak path; Speech mission owns.
- `fish-audio`, `mammoth`, `youtube-transcript`, `use-sound`, `canvas-confetti` —
  single-feature deps; re-verify usage before cleanup wave.

## 6. Performance risks

- Cold-install Dexie seed ~15 s blocks all pages (§2.1).
- `settings/page.tsx` 3009 LOC — large client bundle on one route.
- `wordbooks/scenarios.ts` 4525 LOC of literal data — bundle size; consider
  lazy-loaded content chunks.

## 7. Recommended cleanup waves (deferred — do NOT start here)

1. Patch `next` to >=16.3.6 (critical CVE, even though next/og unused).
2. Extend rate limiting to TTS/STT/translate-free/import routes.
3. Decide `records`/`weakSpots` demotion per STATE_AUTHORITY dispositions.
4. Investigate pdf-parse vs pdfjs-dist duplication; drop one.
5. Split settings page; lazy-load wordbook/scenario datasets.
6. Resolve `edge-tts-universal` AGPL exposure (replace, or accept boundary).
