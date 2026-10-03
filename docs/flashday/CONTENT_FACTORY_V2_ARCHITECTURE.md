# Content Factory V2 — Architecture

Mission: FD-CONTENT-FACTORY-01. Scope: deterministic content factory + V2 library (~142 lessons), zero new learning engine.

## Data flow

```
NEP corpus + Oxford + VN phonetic contrast
        │  scripts/extract-knowledge.mjs
        ▼
src/lib/content-factory/knowledge/*.generated.ts   (155 entries + 4,954 headwords)
        │
        ▼
authored LessonSpec[]  (src/lib/fd-content-v2/lessons/*.ts)
        │  spec()/target() helpers — honest defaults only
        ▼
validateLibrary()  ← QA gate, fails closed (Part 8)
        │
        ▼
compilePack() — deterministic → ContentItem[] + CollectionItem[] + PackManifest
        │
        ▼
seedV2Pack() — idempotent, never resurrects deleted rows, FSRS untouched
        │
        ▼
existing runtime surfaces: /learn → TextCyclePractice (articles),
VocabularyWorkspace (word items: meaning/spelling/dictation/application)
```

## Key invariants

- **Attempt before reveal** — compiled cloze masks the chunk (`___`); validators reject leaks.
- **FSRS schedules only** — seeder never writes `records`; no mastery derived from scheduler state.
- **Fail-closed provenance** — `origin:'derived'` requires exact `sourceRefId` in a derivable class; restricted sources can only inform (`origin:'authored'`).
- **Determinism** — same inputs → byte-identical compiled output (pinned by test).
- **No new runtime** — factory emits existing `contents`/`collections` rows; learners use existing practice surfaces.

## Module map (src/lib/content-factory/)

| file | role |
|---|---|
| types.ts | LessonSpec/Target/CefrLevel/TrackIdV2 + FIELD_CONSUMERS map |
| tracks.ts | 8 track registry (learner-facing meta) |
| sources.ts | corpus source manifest w/ rights classes |
| research.ts | research manifest (V1 superset + factory principles) |
| knowledge/ | generated normalized entries (can-do, fn, collocation, grammar, microskill, painpoint, phonetic, situation, oxford levels) |
| graph.ts | prerequisite/recycling graph + topo order + cycle detection |
| compile.ts | LessonSpec→ContentItem/CollectionItem, packManifest builder |
| validate.ts | validateLesson + validatePack + validateLibrary |
| quality.ts | duplicate/overload analysis |
| coverage.ts | coverage report (tracks, levels, capabilities, functions, sources, research, L1, Oxford priors) |
| recycling.ts | chunk lifecycle report (recycled downstream vs never) |
| seed.ts | fail-closed idempotent seeder |
| factory.test.ts | 22 tests pinning semantics + safety |

## CLI (scripts/content-cli.ts)

`inventory | validate | compile | coverage | inspect <id> | quality | recycling | build | extract` — Node 24 native TS. Reports land in `content-corpus/reports/`.
