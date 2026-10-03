# Content Factory V2 — Coverage

Source of truth: `content-corpus/reports/coverage.json` + `coverage.md` (regenerate: `node scripts/content-cli.ts build`).

## Headline (fd02, 142 lessons)

- 893 targets · 877 unique chunks
- Levels: a0 20 · a1 37 · a2 85 (a2-weighted by design — V1 was a0/a1)
- Listening: 17 lessons / 77 listening-kind targets
- Pronunciation: 16 lessons / 83 targets / 83 L1 contrast notes
- NEP functions: **10/10 covered** via capability→fn map

## How coverage is computed

- **capabilities** — direct lesson field; every id resolves in `capabilities.ts`
- **functions** — NEP fn.01–fn.10 reached through `CAPABILITIES[c].fns` (replaced the v0 text-match heuristic, which undercounted at 1/10)
- **sources/research** — union of `sourceRefs`/`researchRefs` across lessons; every registered id must back ≥1 lesson or appear in `gaps`
- **vocab prior** — Oxford level of each chunk's last content word
- **L1** — targets carrying `contrastVi`

## Exposed gaps (deliberate, not failures)

| gap | why |
|---|---|
| env-30min | pack-level time budget, not a lesson property |
| esl2-rights | factory rights model — applies to sources, not lessons |
| esl2-evidence-levels | evidence hierarchy for claims — pack-level |
| esl2-ilh | input+learning hypothesis — implicit in all listening input |
| sla-extensive-reading | no reading track in V2 scope (documented exclusion) |
| curriculum-graph | factory ordering principle — governs the pipeline itself |

## Recycling (reports/recycling.json)

- 877 unique chunks tracked
- **492 recycled downstream** (appear in a later lesson's input or targets)
- 385 never recycled — single-use by design (names, numbers, minimal-pair words that are drilled not retaught)

## Duplicates accepted

Quality analysis flags ~53 warnings; intentional classes:
- minimal-pair lessons share one contrast sentence across 4–6 targets (perception pedagogy)
- `Got it` ×3, `I would love to` ×2 — high-frequency chunks that legitimately recur across domains
