# License & Provenance Matrix — FDN-ARCH-001

Repo license: MIT (EchoType). Below: exceptions & provenance notes, not a
restatement of every MIT dep.

## Dependencies — notable licenses

| Package | License | Class | Note |
|---|---|---|---|
| ~~edge-tts-universal~~ | ~~AGPL-3.0~~ | **REMOVED (FDN-SEC-001)** | AGPL network clause resolved by removal — Edge TTS path deleted; persisted `edge`/`kokoro` selections fail safe to browser speech. |
| jszip | MIT OR GPL-3.0 | COMMERCIAL-SAFE (MIT election) | backup-zip — fine under MIT; do not remove the election notice. |
| pdf-parse, pdfjs-dist | Apache-2.0 | COMMERCIAL-SAFE | both present — duplication flagged in deep audit |
| mammoth | BSD-2-Clause | ATTRIBUTION-REQUIRED | docx import |
| openai | Apache-2.0 | COMMERCIAL-SAFE | |
| ts-fsrs, dexie, zustand, react*, next, ai + @ai-sdk/*, radix-ui, lucide-react, recharts, cmdk, clsx, tailwind-merge, class-variance-authority, framer-motion, youtube-transcript, fish-audio, react-speech-recognition, use-sound, zod, @supabase/*, @upstash/*, @tauri-apps/*, @napi-rs/canvas, nanoid, react-markdown | MIT | COMMERCIAL-SAFE | |
| canvas-confetti | ISC | COMMERCIAL-SAFE | |

`pnpm audit` (FDN-SEC-001 HEAD): **8 vulns — 0 critical / 2 high / 5 moderate /
1 low**:
- `next@16.3.6` — GHSA-vcvr-r3jv-pc5j **closed** (`next/og` RCE; was never
  imported in src/, now off the tree entirely).
- `brace-expansion` ×3, `fast-uri` ×2, `ip-address` ×2 — all **dev-only**
  transitives (eslint/minimatch, shadcn → @modelcontextprotocol/sdk →
  ajv / express-rate-limit). Not shipped in the prod bundle; land with the
  next toolchain refresh.
- `@ai-sdk/provider-utils` (<4.0.33, low — resource consumption) — the only
  prod advisory; 21 paths via `@ai-sdk/*`. Deferred to a Wave-2 dependency
  mission (requires coordinated `@ai-sdk/*` bump).
- `baseline-browser-mapping` — resolved transitively by the next bump.

See `SECURITY_GATE_W1_W2.md` for the full gate report (SSRF hardening,
route-level rate limits, AGPL removal, AES/localStorage documented debt).

## Content / assets provenance

| Asset | Source | Class | Note |
|---|---|---|---|
| Source code | EchoType (repo) | COMMERCIAL-SAFE | repo MIT |
| `wordbooks/scenarios.ts` phrase lists | EchoType-authored (unverified) | UNKNOWN — verify before reuse beyond repo | Chinese-first schema (`name`=zh); content origin undocumented |
| `builtin-collections.ts` (107 collections) | EchoType-authored | UNKNOWN — verify | same caveat |
| `seed` lessons/contents (~10.6k rows) | bundled | UNKNOWN — BLOCK bulk reuse | may embed third-party texts (e.g. graded readers); origin not documented in-repo |
| NGSL/VOA content | postponed workstream | — | out of scope per mission |
| Icons | lucide-react | COMMERCIAL-SAFE | ISC/MIT |
| Fonts | Poppins / Open Sans | ATTRIBUTION-REQUIRED | OFL — keep license notices |
| Audio | none bundled | — | TTS is runtime-generated |
| Pretrained models | none bundled | — | providers are remote |
| Dictionaries | wordbooks (above) | UNKNOWN | |

## Rules applied

- Do not copy `wordbooks`/`builtin-collections`/seed corpus into new channels
  until provenance verified (UNKNOWN items above).
- `edge-tts-universal` AGPL boundary **resolved by removal** (FDN-SEC-001) —
  no AGPL code remains in the dependency tree.
- No content replacement executed in this mission.
