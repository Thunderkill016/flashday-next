# Content Factory V2 — Versioning & Migration Safety

## Version scheme

- `specVersion: 'lesson-spec/v2'` — shape contract; breaking schema changes bump `/v3`
- `version: 'content/2.0.0'` — content lineage (V1 = `fd01` content/1.x)
- `PackManifest.version` per pack + `compilerVersion` + `sourceManifestVersion` recorded on every manifest

## Stable identity

- Content ids derive deterministically: `v2LessonContentId = <packId>.lesson.<lessonId>`, chunk items keep `target.id`, collections `<packId>.track.<track>` / `.chunks`
- Wording edits keep ids (pinned: manifest test asserts lessonIds/targetIds identical after title edits)
- `packManifest` sorts ids — same input set → same manifest

## Seed safety contract (pinned by factory.test.ts)

1. **Fail-closed** — `seedV2Pack` runs `validatePack` first; an invalid pack writes zero rows.
2. **Idempotent** — bulkGet before bulkPut; second run on unchanged data writes nothing.
3. **No resurrection** — rows with `deletedAt` are skipped (learner deletions win).
4. **FSRS untouched** — seeder never writes `records`; scheduler state survives re-seed.
5. **Pack-scoped** — required-track check is library-level; each pack seeds independently.

## Migration path

- V1 (`fd01`) content stays seeded; V2 packs depend on it (`dependsOn`) rather than replace it.
- Pack upgrade = bump `content/2.x` + re-seed; learners keep FSRS state because ids are stable.
- Rollback = delete V2 content ids (deterministic prefix `<packId>.`) — no schema migration exists to reverse.

## What changed from V1

| V1 | V2 |
|---|---|
| hand-built PackLesson literals | LessonSpec + spec()/target() helpers |
| pack.ts monolith per pack | factory modules + pack manifests |
| validator one file | validator + quality + coverage + recycling + graph |
| research prose in docs | researchRefs resolve into RESEARCH_MANIFEST |
