# Content Factory V2 — Rights & Provenance

## Source classes (sources.ts)

| class | meaning | V2 usage |
|---|---|---|
| REUSABLE_CONTENT | ours/public domain — may embed | `fd-authored` (all lesson prose) |
| LINK_AND_DERIVE | may derive with citation | nep-* corpora, oxford-5000, connected-speech-notes, stage-0-curriculum |
| REFERENCE_ONLY | informs design, prose never embedded | english-for-it, nep-grammar-errors, exam banks |
| REJECTED | never used | pirate-mirrors |

## Fail-closed provenance (carried from FD-CONTENT-01 review)

- `input.origin:'derived'` **requires** `input.sourceRefId` naming the exact backing source (`derived-source-missing`).
- That id must appear in `lesson.sourceRefs` (`derived-source-not-cited`).
- That source must be LINK_AND_DERIVE or REUSABLE_CONTENT (`derived-from-restricted`).
- REFERENCE_ONLY sources appear in `sourceRefs` for transparency but never back a `derived` input — developer lessons are therefore all `origin:'authored'` even though `english-for-it` informs their design.

## What "derived" means here

V2 derived inputs are the phonetic/microskill lesson texts (listening + pronunciation tracks) — their *content decisions* (which contrasts, which minimal pairs, which reductions) come from `nep-phonetic-db` / `nep-microskills` / `connected-speech-notes`; the prose itself is written fresh. Provenance still declares the exact backing source per the fail-closed rule.

## Versioned provenance

- `packManifest()` records `sourceManifestVersion` + `compilerVersion` so a report can trace any compiled item to manifest + compiler.
- Every compiled `ContentItem` carries `metadata.fd` (packId, lessonId, trackId, sourceRefId) — provenance survives seeding into IndexedDB.

## Audio rights

All audio is `tts-synthetic` (browser SpeechSynthesis) — no recorded assets, no third-party audio rights involved.
