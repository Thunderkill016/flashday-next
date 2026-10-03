# Content Factory V2 — Known Gaps & Exclusions

Honest inventory of what V2 does NOT cover yet. Generated `coverage.md` tracks the live version.

## Scope gaps (by design)

- **No b1 content** — V2 tops out at a2 (85 lessons); b1 needs a separate evidence pass.
- **No reading/writing tracks** — extensive reading (`sla-extensive-reading` stays an exposed gap) and compositional writing are out of scope; existing app modules cover the mechanics.
- **No recorded audio** — all audio is declared `tts-synthetic`; human-recorded or corpus audio is a future rights+cost decision.
- **No zh locale authoring** — `titleZh`/`descriptionZh` fall back to English text (schema requires the fields; Vietnam-first scope does not author Chinese).
- **385/877 chunks never recycled** — minimal-pair words, names, numbers are drilled once by design; chunk-recycling targets the reusable frames, which the report tracks separately.

## Research principles that back no single lesson (kept visible)

- `env-30min` — daily time budget: pack pacing property, not lesson data
- `esl2-rights`, `esl2-evidence-levels` — factory governance, documented in RIGHTS doc
- `esl2-ilh` — input+learning hypothesis underpins all listening design implicitly
- `curriculum-graph` — factory ordering principle, enforced by graph.ts itself
- `sla-extensive-reading` — no reading track (above)

## Carried-contract fields (honest label, not runtime)

`supportLadder`, `reviewVariants`, `productionPattern`, `transferContext`, `contrastVi`, `audioSource` are carried in `metadata.fd` and article text where a surface exists; where no runtime surface exists yet they are declared `carried-contract` in FIELD_CONSUMERS — not silently dropped, not claimed as enforced. (FD-CONTENT-01 review lesson.)

## Deferred from the research corpus

Same exclusions class as V1 (`CONTENT_RESEARCH_EXCLUSIONS_V1.md`): exam banks, pirate mirrors, RAG chunk ingestion, and AI-generated lesson text remain excluded — V2 content is authored, not generated.
