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

## B. Server egress policy — `src/lib/egress.ts` (FDN-SEC-001R)

External review found the first-pass guard had a **TOCTOU gap**: it resolved
and validated the hostname, then `fetch()`ed the hostname again — the socket
performed a second, uncontrolled DNS resolution (DNS-rebinding window). It also
found more caller-controlled egress than reported.

The fix is a shared egress module that binds validation to the connection:

- **Pinned connection**: `resolveEgressTarget` resolves the hostname once and
  validates every answer; `fetchEgress` then issues the request through a
  per-request undici `Agent` whose `connect.lookup` callback serves **only the
  validated addresses**. The socket never re-queries the system resolver, so a
  DNS answer flipping to private between check and connect cannot redirect the
  connection. TLS `servername`/SNI and `Host` still use the original hostname,
  and certificate verification is unaffected — only the destination IP is
  pinned.
- **Validated redirects**: `redirect: 'manual'` per hop; every `Location`
  target re-enters `resolveEgressTarget` (protocol + literal IP + hostname +
  DNS). Internal follow mode strips `Authorization`/`x-api-key`/`Cookie` on
  cross-origin hops and caps chains at 5.
- **Fail closed**: DNS errors, empty answers, non-http(s) protocols, or any
  private answer reject before any socket opens.
- **Blocked address space**: IPv4 `0.0.0.0/8`, loopback, RFC1918, CGNAT
  `100.64.0.0/10`, link-local/metadata `169.254.0.0/16`, documentation ranges,
  benchmarking `198.18.0.0/15`, multicast/reserved; IPv6 unspecified/loopback/
  multicast/unique-local/link-local/site-local, IPv4-mapped `::ffff:0:0/96`,
  NAT64 `64:ff9b::/96`, 6to4 `2002::/16`.

### Two egress classes

**Class 1 — hosted public fetch** (URL import, public provider endpoints):
http/https only → all-DNS-answers validated → connection pinned to the
validated set → no private/reserved destination → manual redirects, bounded.

**Class 2 — local/self-host provider** (Ollama, LM Studio, LAN Kokoro): a
hosted FlashDay server refuses to proxy arbitrary LAN/private targets from
unauthenticated callers. Private destinations are only permitted when the
**server operator** opted in:

- `FLASHDAY_SELF_HOST=1` — self-host mode (the Tauri sidecar sets this; its
  server binds to 127.0.0.1 and only the local app reaches it), or
- `FLASHDAY_LOCAL_PROVIDERS=http://localhost:11434,http://nas.lan:8880` —
  exact-origin allowlist for hosted operators.

Callers may still choose model/path within the permitted provider contract —
never an arbitrary host. Redirect hops off an allowlisted origin are
revalidated the same way (an allowlisted server cannot redirect the server
into private space).

### Caller-controlled egress matrix

| Route / path | URL source | Class | Policy applied |
|---|---|---|---|
| `src/lib/web-page.ts` (import/url, chat tools) | caller URL | public | pinned fetch, per-hop revalidation |
| `src/lib/ai-model.ts` → all AI SDK routes (`chat`, `speak`, `translate`, `ai/generate`, `collections/generate`, `model-recommendations`, `assessment`, `recommendations`, `tools/classify`, `journal/*`, `import/organize`, `learning/feedback`) | `providerConfigs.baseUrl` / `x-base-url` | both | `fetch: egressFetch` injected into every provider factory — validation + pinning at connection time; private → operator opt-in only |
| `/api/models` | `x-base-url`, `x-api-path` headers | both | `fetchEgress`; policy block → `403 egress_blocked` |
| `/api/ollama/warmup` | `baseUrl`, `apiPath` body | local | `fetchEgress`; block → `403 egress_blocked` |
| `/api/tts/kokoro/{speak,voices}` | `serverUrl` body | local | `fetchEgress`; block → `403 egress_blocked` |
| `/api/tts/openai/speak` | `baseUrl` body | public custom | `fetchEgress`; block → `403 egress_blocked` |
| `/api/tools/download` | `url` body | subprocess | `assertPublicEgressUrl` preflight before `yt-dlp` spawn |
| `/api/tools/extract` | `url` body | subprocess | platform-host allowlist (`supportedPlatforms`) + Vercel gate; **residual**: yt-dlp resolves DNS in-process (no pinning possible) — document |
| `src/lib/youtube-transcript.ts` | YouTube-derived URLs | public | `fetchEgress` (defense-in-depth on derived URLs) |
| `stt`, `import/transcribe`, `tts/align`, `translate/free`, `pronunciation`, `auth/token`, `fish` TTS | registry/env-fixed endpoints | fixed | no caller control — unchanged |

Regression coverage: `src/lib/egress.test.ts` (pin-bound connection — DNS
flips to private after validation and the socket still receives the validated
address; literal-IP/hostname/DNS-private refusals; redirect revalidation,
credential stripping, cap; self-host + origin-allowlist behavior) plus updated
`web-page-ssrf.test.ts`, `models/route.test.ts` (hosted refusal + allowlist),
`ollama/warmup/route.test.ts` (new — proxy refusal + allowlist + pinned public),
kokoro/openai-tts 403 mapping tests.

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

**Status:** this limiter is an *abuse guard*, not a quota architecture — per-IP
ceilings throttle a shared-NAT classroom/family behind one address. Accepted
for the personal proving-ground stage; before multi-user/classroom use the
target is an authenticated learner/account limiter + per-IP abuse backstop
(external review, FDN-SEC-001R — documented debt, not expanded here).

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
and the `/api/tts/kokoro/*` routes remain — self-hosted Kokoro is a legitimate
Class-2 provider: no AGPL dep, and after FDN-SEC-001R the routes enforce the
egress policy (private targets need the operator opt-in; arbitrary public
targets are pinned-validated).

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
