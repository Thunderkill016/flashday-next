# FD-VOA-CORPUS-01 — VOA Learning English Corpus

Mission: content acquisition / corpus normalization / curriculum enrichment. Zero new learning engine — VOA supplies authentic material, FlashDay authors curriculum, the kernel supplies learning truth.

## Data flow

```
VOA Learning English (learningenglish.voanews.com)
        │  scripts/voa/discover.ts — per-series adapters
        ▼
manifest.ndjson — canonical URL inventory (deduped)
        │  scripts/voa/fetch.ts — rate-limited, cached, rights-audited
        ▼
source.ndjson + rights.ndjson — raw records + per-asset rights
        │  scripts/voa/normalize.ts — fail-closed gate + enrichment
        ▼
resources.ndjson + media.ndjson — VoaLearningResource + resolvable media
        │  scripts/voa/links.ts — curriculum links + gap matches
        ▼
links.ndjson + search-index.json + reports/
        │
        ▼
existing Content Factory V2 / learning runtime (unchanged)
```

## Commands

```bash
pnpm content:voa discover   # series adapters → manifest.ndjson (incremental by series arg)
pnpm content:voa fetch      # manifest → source.ndjson + rights.ndjson (series arg optional)
pnpm content:voa normalize  # source → resources.ndjson + media.ndjson (+bounded HEAD checks)
pnpm content:voa links      # resources → links.ndjson + search-index.json + gap report
pnpm content:voa report     # regenerate reports/ from existing ndjson
pnpm content:voa build      # full orchestration (same passes as the staged commands)
```

## Discovery adapters (scripts/voa/discover.ts)

| type | use |
|---|---|
| `page` | course/teacher landing pages (`/p/<id>.html`) — all article links |
| `zone` | series archives (`/z/<id>?p=N`) — VOA caps pagination at ~page 100 |
| `rss-video` | official feeds (`/podcast/video.aspx?zoneId=<id>`) — items + enclosures |
| `chain` | linear episode walks via Related-block links (Anna courses have no index) |
| `articles` | explicit URL list (multilingual hubs) |

Filtered runs (`node scripts/voa/discover.ts voa-anna,...`) replace only their own series rows — incremental updates compose (§10).

## Rights model (src/lib/voa-corpus/rights.ts)

Asset-level, fail-closed. Keyword/credit detection can only **demote**; promotion to `VOA_ORIGINAL_PUBLIC_DOMAIN` requires positive evidence: no third-party credits + VOA-domain assets + a permissive series prior.

| status | meaning | learner-facing |
|---|---|---|
| `VOA_ORIGINAL_PUBLIC_DOMAIN` | verified VOA-produced | yes, with attribution |
| `MIXED_RIGHTS_REVIEW_REQUIRED` | VOA + third-party components | VOA parts only after review |
| `THIRD_PARTY_RESTRICTED` | non-VOA asset host | no |
| `UNKNOWN` | insufficient evidence | no |

Signals detected: AP/Reuters/AFP/Getty credit lines, "X reported this story. Y adapted it for VOA" wire adaptations, courtesy/licensed/copyright lines, non-VOA asset hosts.

Series priors: a prior may be `VOA_ORIGINAL_PUBLIC_DOMAIN` only for reliably VOA-produced formats (authored courses, teaching explainers, VOA-produced video). Zone-fed article archives where wire-derived items are known to occur default `MIXED_RIGHTS_REVIEW_REQUIRED` — a missed credit must never promote an item. A regression test pins this: `kind: article|story` + zone discovery ⇒ no PD prior.

## Pipeline states (§50)

`RAW → RIGHTS_VERIFIED → NORMALIZED → ENRICHED → REVIEWED → APP_READY`

The pipeline emits `ENRICHED` — `REVIEWED`/`APP_READY` remain human gates. No resource reaches learner surfaces without review.

## Enrichment (src/lib/voa-corpus/enrich.ts + level.ts)

Deterministic, no LLM in the path:

- Oxford 5000 band coverage with inflection fallback (`headword()`)
- proper-noun exclusion — names/places are not vocabulary load
- level inference = median-band mapping (`level.source` preserves VOA's own label, never overwritten)
- chunk candidates matched against the V2 chunk inventory + NEP collocations
- capability/grammar/listening probes from the existing ontology — never invented from titles

## Media registry (src/lib/voa-corpus/media.ts)

One `LearningMediaAsset` per unique asset URL: `voa-media:<sha256(url)[..16]>`. A `recorded` claim requires `resolvable: true` — HEAD-verified URL. Verification is bounded per run (`RESOLVE_CAP_PER_RUN`); unverified assets stay fail-closed until a later run reaches them. Audio, video, **and document** assets register — `audioRefs`/`videoRefs`/`documentRefs` on a resource are these canonical ids (never raw URLs), so every ref resolves to exactly one registry row.

The same asset URL can be observed from multiple source records with different rights states. `dedupeAssets` therefore merges order-independently and fail-closed: `sourceResourceIds[]` + `observations[]` keep full provenance, and merged `rightsStatus` is `VOA_ORIGINAL_PUBLIC_DOMAIN` only when **every** observation is clean — any restrictive observation wins regardless of corpus order (no rights laundering). `resolvable` is a property of the URL, so any prior verification proof survives the merge.

## Curriculum links (src/lib/voa-corpus/curriculum-links.ts)

- `authentic-reencounter` — V2 target chunk literally occurs in the resource
- `audio-candidate` — reencounter + **verified** audio: at least one bound `mediaAssetIds` entry is `VOA_ORIGINAL_PUBLIC_DOMAIN` + `resolvable: true`
- `audio-discovered` — reencounter + media URL exists but unverified/unclear (pending kind; never treat as usable media)
- `chunk-recycling` — matches for the uncovered-chunk gap list (same derivation as the coverage report)
- `grammar-support` / `authoring-reference` — series-role links

Every link row carries `rightsVerified` (source rights state) and, for audio kinds, `mediaAssetIds` (the exact registry ids that passed the gate) — the gate is bound into the row; consumers never reconstruct it.

The offline search index (`search-index.json`) and the LLE-1 mapping report use the same `isVerifiedUsableMedia` predicate, split into `discoveredAudioCount` vs `verifiedAudioCount` + `verifiedAudioAssetIds` + `hasUsableAudio`. A raw ref count can never read as usable audio — the verified gate cannot be bypassed by a parallel projection.

Encountering VOA material mints **no** evidence — §41 boundary stands: claims still require a FlashDay TaskContract + evaluator + EvidenceEvent.

## Learner-facing provenance contract (§31)

When a future mission compiles VOA items into `contents`, `metadata.fd.source` must carry:

```ts
{
  provider: 'voa-learning-english',
  resourceId,        // voa:<contentId>
  canonicalUrl,
  rightsStatus,      // must be VOA_ORIGINAL_PUBLIC_DOMAIN to ship
  attribution: 'Source: VOA Learning English — learningenglish.voanews.com',
}
```

## Source versioning (§28/§29/§38)

`VoaSourceRecord.contentHash` = sha256(title+body). A VOA page update produces a new hash → `sourceRevision` bump — TaskContract revisions bump **only** when learner-facing semantics change. Learner evidence is never silently retargeted to changed content.

## Crawler ethics (scripts/voa/http.ts)

~1 request / 1.2–2s, honest crawler UA, exponential backoff, disk cache (`content-corpus/voa/cache/`, gitignored), treats 200+empty-body as retryable (VOA rate-limit quirk).

## Fetch scope (SERIES_CAP in scripts/voa/fetch.ts)

The manifest keeps the FULL URL inventory for all 24 series. `fetch` bounds the first pass: Tier A courses + teacher resources fetch completely; large archives are capped per series (60–100 items). Deeper backfill is incremental — raise a cap and re-run; merge-by-id keeps prior records and `contentHash` tracks source revisions.

## Reports (content-corpus/voa/reports/)

`inventory` · `rights` · `levels` · `series` · `curriculum-links` · `recycling` · `gaps` · `lle1-mapping` (§33) · `anna-vi-comparison` (§35) · `inventory.discovery`

## Known limits

- Deep news zones: VOA itself caps listing at ~page 100 (~1212 items/zone); older history is unreachable via zone pages.
- `English on the Job` (zone 6020) retired upstream — feed and zone are empty.
- Anna series: EN 15 + VI 5 lessons published to date; each lesson has companion `LLE-A`/player pages that dedupe via content-id in the manifest.
- Resolvability verification advances incrementally — `media.ndjson` `resolvable` coverage grows per run.
- Capped series hold their newest N items; older items stay in `manifest.ndjson` for incremental backfill.
