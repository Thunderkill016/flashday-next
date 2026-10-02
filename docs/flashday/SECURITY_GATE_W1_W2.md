# FDN-SEC-001 — Pre-Wave-2 Security & License Gate

Scope: close the Wave-1 security findings that met the fix bar before any
Wave-2 migration work starts. Branch: `flashday/sec-gate` from clean
`main @ 0285fdd5` (post-PR-#3 merge).

## A. Dependency patch — next@16.3.6

- `next` bumped `16.3.4` → `16.3.6` (smallest safe release).
- Closes **GHSA-vcvr-r3jv-pc5j** (critical RCE in `next/og`). `next/og` is not
  imported anywhere in `src/` — no reachable path existed, but the vulnerable
  build is now off the tree regardless.
- `baseline-browser-mapping` bumped transitively with the Next release.

## B. SSRF hardening — `src/lib/web-page.ts`

URL import fetches user-supplied links; the previous guard compared hostnames
against a literal-IP blocklist only. Replaced with:

- **Per-hop DNS resolution** via `node:dns/promises` `lookup` — every request
  host is resolved and every returned address is classified before connect
  (defeats DNS rebinding between the check and the fetch).
- **Manual redirects** (`redirect: 'manual'`) — each `Location` target is
  resolved and re-validated through the same DNS + IP checks, capped at
  `MAX_REDIRECT_HOPS = 5` (previously undici auto-followed redirects with no
  revalidation).
- **Fail closed**: DNS errors, empty answer sets, or disallowed address
  families reject the fetch.
- **Blocked address space** (`isUnsafeAddress`): IPv4 `0.0.0.0/8`, loopback,
  RFC1918, CGNAT `100.64.0.0/10`, link-local/metadata `169.254.0.0/16`,
  documentation ranges, benchmarking `198.18.0.0/15`, multicast/reserved;
  IPv6 unspecified/loopback/multicast/unique-local/link-local/site-local,
  IPv4-mapped `::ffff:0:0/96`, NAT64 `64:ff9b::/96`, 6to4 `2002::/16`.
- Retry behaviour and the BBC HTTP→HTTPS fallback are preserved.

Regression coverage: `src/lib/web-page-ssrf.test.ts` (12 tests — rebinding,
redirect-to-private, safe redirects, DNS failure, redirect cap, IPv4-mapped/
NAT64/6to4 forms) + `web-page.test.ts` / `web-page-retry.test.ts` updated to
mock `lookup` (32 tests total in the SSRF surface).

**Residual:** `src/app/api/ollama/warmup/route.ts` still proxies a
caller-supplied `baseUrl` (self-hosted Ollama by design). It is now
rate-limited; hardening it is deferred — it is an intentional local-network
feature, documented here rather than silently "fixed".

## C. Shared route-level rate limiting

`src/lib/platform-provider.ts` gained a route-level limiter on top of the
existing platform-Groq infrastructure (same in-memory + Upstash dual backend,
same `60 s` sliding window):

- `enforceRouteRateLimit({ headers, bucket })` — keyed by client IP
  (`x-forwarded-for` → `x-real-ip` → `cf-connecting-ip`), independent of whose
  provider credential funds the call. Previously only platform-Groq requests
  were limited; user-key requests were unlimited.
- `rateLimitResponse` — uniform `429` + `Retry-After` + `{ error, code:
  'rate_limited' }` body.
- Buckets (requests / 60 s / IP): `stt` 15 · `tts` 40 · `translate-free` 60 ·
  `import` 12 · `generate` 12 · `download` 30 · `metadata` 60.

Wired into 19 routes: `/api/stt`, `/api/tts/align`, `/api/tts/{fish,google,
kokoro,openai}/{speak,voices}`, `/api/translate/free`, `/api/import/{url,
youtube,pdf,extract-text,transcribe}`, `/api/ai/generate`,
`/api/collections/generate`, `/api/model-recommendations`, `/api/pronunciation`,
`/api/tools/download`, `/api/models`, `/api/ollama/warmup`.

Backends: Upstash Redis when `UPSTASH_REDIS_REST_URL` +
`UPSTASH_REDIS_REST_TOKEN` are set; per-process in-memory fallback otherwise
(correct for single-instance deployments; multi-instance deploys should set
Upstash — noted for ops).

## D. AGPL removal — `edge-tts-universal`

`edge-tts-universal@1.4.0` (AGPL-3.0) removed from `dependencies`. AGPL's
network clause made it a license boundary for a SaaS deployment; removal is
the clean resolution (Wave-1 LICENSE_MATRIX flagged it COPYLEFT-BOUNDARY).

Removed with it: `src/lib/edge-tts.ts`, `src/app/api/tts/edge/*` (3 routes +
2 test files), Edge voice loading/state in `use-tts.ts`, the Edge picker UI,
the settings option + config panel, Edge QA mocks in `ios-native-qa.ts`, and
Edge i18n keys (`settings.edge*`, `voice-picker.search.edge`,
`voice-picker.errors.edge`, `listen-detail.sources.edge`,
`listen-detail.browserFallbackNotice`).

Migration: `TTSSource` is now `'browser' | 'fish' | 'google' | 'openai'`.
Persisted `voiceSource: 'edge'` (and the already-retired `'kokoro'`) fails
safe to `browser` on hydrate (`normalizeSavedSettings` in
`src/stores/tts-store.ts`). Kokoro server settings are retained in the store
and the `/api/tts/kokoro/*` routes remain — they proxy a user-configured
self-hosted server, carry no AGPL dep, and are still functional API surface.

Consequence: the built-in word-boundary karaoke path that Edge provided now
uses browser SpeechSynthesis boundary events or Fish/Google/OpenAI audio
(`resolvedVoiceSource` already fell back to browser whenever boundary events
were required — semantics unchanged).

## E. Documented debt — AES-GCM key in localStorage (NO fake fix)

`src/lib/storage-crypto.ts` encrypts provider secrets with AES-GCM, but the
generated key is stored **raw in the same localStorage origin**
(`echotype_dk`) as the ciphertext it protects. Any XSS payload or malicious
extension context reads both key and ciphertext — the encryption only protects
against a casual `localStorage` skim, not a compromised runtime.

This is **documented, not fixed**: no client-side scheme can protect secrets
from code running in the same origin. The real fix is server-side secret
custody (provider keys live behind API routes / Supabase, never in the
browser), which is auth/provider redesign — explicitly a Wave-2+ mission, out
of scope here per the mission brief.

## Residual `pnpm audit` (this HEAD)

`8 vulns: 0 critical · 2 high · 5 moderate · 1 low`

| Package | Severity | Reach | Disposition |
|---|---|---|---|
| `@ai-sdk/provider-utils` (<4.0.33) | low — resource consumption | **prod**, 21 paths via `@ai-sdk/*` | deferred — fixing requires a coordinated `@ai-sdk/*` bump across 21 paths; a Wave-2 dependency mission, not a drive-by |
| `brace-expansion` ×3 | mod/high | **dev only** (eslint → minimatch, 82 paths) | dev toolchain; patch lands with the next toolchain refresh |
| `fast-uri` ×2 | high | **dev only** (shadcn → @modelcontextprotocol/sdk → ajv) | dev toolchain only, not shipped |
| `ip-address` ×2 | high | **dev only** (shadcn → @modelcontextprotocol/sdk → express-rate-limit) | dev toolchain only, not shipped |

No prod dependency remains on a known-vulnerable version except the single
low `@ai-sdk/provider-utils` advisory above.

## Out of scope (unchanged)

Wave-2 migration, Speech redesign, curriculum changes, auth/provider redesign,
cold-seed performance, WordBook rename, mass `@ai-sdk/*` upgrades, and any
merge without explicit user authorization.
