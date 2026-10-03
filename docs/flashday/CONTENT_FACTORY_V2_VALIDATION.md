# Content Factory V2 — Validation

Gate: `node scripts/content-cli.ts validate` — prints PASS or `id code message` rows and exits nonzero on any issue. Also runs inside `seedV2Pack` (fail-closed: a broken pack writes nothing) and `content-cli.ts build`.

## Levels

| fn | scope |
|---|---|
| `validateLesson(l, ctx?)` | one spec: structure, leakage, provenance, audio rules, capability + rationale checks |
| `validatePack(ls, id, ctx)` | duplicate ids, per-lesson issues, graph issues, recycle loops |
| `validateLibrary(ls, id, ctx)` | pack rules + required-track presence (the fd02 spine) |

`ctx` (`PackValidationContext`) is required at pack/library level:

- `knownCapabilities` — ontology ids; ghost capabilities fail closed (`unknown-capability`)
- `externalIds` — lesson ids in declared dependency packs; legitimate edge targets, still fails on anything else

Per-pack seeding calls `validatePack` — required tracks are a library property, not a pack property (split after the a1 pack failed seeding on missing-track).

## Issue codes

**structure**: `spec-version`, `target-count` (3–8), `duplicate-lesson-id`, `duplicate-target-id`, `empty-field`, `bad-id-format`
**retrieval/leakage**: `chunk-not-in-source`, `source-not-in-input`, `answer-visible`, `cue-leaks-answer`, `support-leaks-answer`
**production/transfer**: `no-production-pattern`, `transfer-missing`, `transfer-no-change`
**provenance/rights**: `derived-source-missing`, `derived-source-not-cited`, `derived-from-restricted`, `rejected-source`, `unknown-source`, `unknown-research`
**audio**: `audio-outside-listening`, `audio-source-undeclared`, `audio-source-unbacked`, `audio-ref-on-synthetic`, `missing-audio-path`
**ontology/evidence**: `unknown-capability`, `missing-prerequisite-rationale`
**graph**: `graph-self-edge`, `graph-unknown-node`, `graph-cycle`, `recycle-loop`
**library**: `missing-track`

## What the validator proved during authoring

- 7 real chunk-not-in-source + answer-visible pairs (author error, not noise)
- 16 support-leaks-answer hits when lesson noteVi was naively inherited into contrastVi — fixed by a dedicated lesson-level `contrastVi` field that never quotes targets
- `audio-source-undeclared` caught all 32 audio-track lessons before `tts-synthetic` became the declared default
- `graph-self-edge` caught a self-recycling bug in dv22

## Quality analysis (separate, non-blocking)

`analyzeQuality` reports near-duplicate chunks, over-repeated source sentences (≥3 targets sharing), overloaded lessons (8 targets). Minimal-pair lessons intentionally share one contrast sentence across 4–6 targets — flagged but accepted as designed.
