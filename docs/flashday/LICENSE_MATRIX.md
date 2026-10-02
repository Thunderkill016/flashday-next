# License & Provenance Matrix — FDN-ARCH-001

Repo license: MIT (EchoType). Below: exceptions & provenance notes, not a
restatement of every MIT dep.

## Dependencies — notable licenses

| Package | License | Class | Note |
|---|---|---|---|
| edge-tts-universal | **AGPL-3.0** | COPYLEFT-BOUNDARY | Edge-TTS path. AGPL reaches network use — review before shipping TTS through it in a SaaS context. Replace or isolate; flagged for dedicated mission. |
| jszip | MIT OR GPL-3.0 | COMMERCIAL-SAFE (MIT election) | backup-zip — fine under MIT; do not remove the election notice. |
| pdf-parse, pdfjs-dist | Apache-2.0 | COMMERCIAL-SAFE | both present — duplication flagged in deep audit |
| mammoth | BSD-2-Clause | ATTRIBUTION-REQUIRED | docx import |
| openai | Apache-2.0 | COMMERCIAL-SAFE | |
| ts-fsrs, dexie, zustand, react*, next, ai + @ai-sdk/*, radix-ui, lucide-react, recharts, cmdk, clsx, tailwind-merge, class-variance-authority, framer-motion, youtube-transcript, fish-audio, react-speech-recognition, use-sound, zod, @supabase/*, @upstash/*, @tauri-apps/*, @napi-rs/canvas, nanoid, react-markdown | MIT | COMMERCIAL-SAFE | |
| canvas-confetti | ISC | COMMERCIAL-SAFE | |

`pnpm audit` (this HEAD): **10 vulns — 1 critical / 2 high / 6 moderate / 1 low**:
- `next@16.3.4` < 16.3.6 — GHSA-vcvr-r3jv-pc5j (RCE in `next/og`; **not used**
  in src/ — no reachable path; patch still required in follow-up).
- `brace-expansion` DoS ×2 (transitive), `fast-uri` ×2, `ip-address` ×2,
  `baseline-browser-mapping`, `@ai-sdk/provider-utils` resource consumption.

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
- `edge-tts-universal` AGPL boundary documented — decision deferred.
- No content replacement executed in this mission.
