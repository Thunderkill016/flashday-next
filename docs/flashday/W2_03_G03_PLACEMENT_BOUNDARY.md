# W2-G03 — Placement Boundary Contract

**Mission:** W2-03 node `W2-G03` (`docs/flashday/W2_MIGRATION_DAG.json`)
**Branch:** `flashday/w2-03-g03-placement-boundary`
**Base HEAD:** `9851b1d2233b383b6adc55ff0e76698b25ae5465` (main after W2-02.x checkpoint)
**Question:** is `assessment-store.currentLevel` a learner-ability authority, or an
advisory placement estimate?
**Answer:** advisory estimate. It is now an explicit `PlacementEstimate` domain
that never enters the evidence kernel.

```text
PlacementEstimate != CapabilityState
PlacementEstimate != EvidenceEvent
```

## 1. The defect — implicit ability authority

`assessment-store.currentLevel` persisted a bare CEFR string under
`localStorage["echotype_assessment"]` and was consumed as if it were
demonstrated ability:

- `daily-plan.ts` fed it through `levelToDifficulty` into
  `difficultyFitScore` — silently shaping plan-task ranking.
- `use-recommendations.ts` sent it to the AI recommendations API as
  `userLevel`.
- `chat-panel.tsx` exposed an `updateUserLevel` tool letting the chatbot
  *write* the level with no provenance.
- `app/api/assessment/route.ts` used it to tune the next quiz's question
  distribution.
- `chat-analytics.ts` read `parsed.state?.currentLevel` — a path that
  never existed in the flat persisted payload, so the analytics level was
  silently always `null` (latent broken read, fixed).

None of these are capability authority — but nothing in the type system
or storage schema said so. The field's shape invited capability truth
interpretation; G03 makes the boundary explicit.

## 2. The boundary — `PlacementEstimate`

`src/stores/assessment-store.ts` now carries one advisory domain object:

```ts
export interface PlacementEstimate {
  levelEstimate: CEFRLevel;
  source: 'placement_test' | 'chat_tool' | 'legacy_payload';
  score: number | null;
  completedAt: number;
  method: 'adaptive_quiz' | 'chat_tool' | 'hydrated_legacy';
  version: 1;
}
```

- `setResult(assessment)` — quiz completion mints an estimate with real
  score + timestamp and appends the result to `history` unchanged.
- `setPlacementEstimate(level, source)` — chat/self-report claims mint an
  estimate with `score: null` and provenance source `chat_tool`.
- `hydrate()` — accepts the legacy `{ currentLevel, history }` payload and
  lifts it to `placement` with `source: 'legacy_payload'`,
  `method: 'hydrated_legacy'`. If a matching level exists in `history`,
  the newest matching score/timestamp is reused; otherwise `score: null`,
  `completedAt: 0`. **No fabricated evidence.**
- The persisted payload still carries `currentLevel` as a compatibility
  mirror so older builds/readers keep working; it is a projection of
  `placement.levelEstimate`, never an input.

`placement` is **not** an `EvidenceEvent`, is never appended to
`db.evidenceEvents`, never enters `projectLearnerState` inputs, and no
capability/prerequisite/gating path reads it. `submitAttempt` /
`submitObservation` exist only inside `src/lib/evidence-bridge/**` — the
store has no API surface that could mint evidence.

## 3. Consumer classification — 0 forbidden reads

Every consumer of the store was inventoried and classified:

| File | Read | Class |
|---|---|---|
| `dashboard/page.tsx` | reminder + display copy | advisory presentation |
| `dashboard/today-plan.tsx` | `levelEstimate` → plan signature/explanation | advisory presentation |
| `lib/daily-plan.ts` | `levelEstimate` → `difficultyFitScore` ranking | advisory recommendation |
| `hooks/use-recommendations.ts` | `levelEstimate` → API `userLevel` hint | advisory recommendation |
| `assessment/assessment-section.tsx` | display + seeds next quiz | advisory |
| `app/api/assessment/route.ts` | question-distribution tuning | advisory producer |
| `chat/chat-panel.tsx` | context + `updateUserLevel` tool | advisory (write path → `setPlacementEstimate`) |
| `lib/chat-analytics.ts` | persisted-payload level for analytics | advisory analytics (read path fixed) |
| `(app)/layout.tsx` | `hydrate()` call only | plumbing |

Verified negatives (repo-wide):

- **0** imports of the assessment store from `src/vnext/` or
  `src/lib/evidence-bridge/`.
- **0** sync-engine references (`localStorage` prefs only, per DAG).
- **0** `/speak` module readers — the DAG claimed one; corrected in
  `W2_MIGRATION_DAG.json` (G03/AS1 `readers`).
- **0** readers in `learning-unit-repository`, selector, planner, or
  mission gating.

`FORBIDDEN_PLACEMENT_AUTHORITY_READS = 0`.

## 4. Guardrail + DAG updates

- `src/lib/authority-guardrails/patterns.ts`: the
  `assessment.currentLevel` sensitive-source family now also matches
  `levelEstimate`, `PlacementEstimate`, and `setPlacementEstimate` — the
  sensitive-read net tracks the whole advisory domain, not just the
  legacy token.
- `legacy-claim-sites.json`: occurrence lines re-synced for the 9 touched
  files; every site's classification unchanged, all occurrences still
  claimed (multiset equality holds, shared file+source splits preserved).
- `W2_MIGRATION_DAG.json`: G03 `readers` corrected to the real consumer
  set; G03 acceptance reworded so verbatim estimate-copy relabeling stays
  W2-AS1's scope (G03 owns the structural boundary only).

## 5. Regressions landed — `placement-boundary.test.ts` (10/10)

- legacy `{ currentLevel }` payload hydrates to an advisory estimate;
  `history` preserved verbatim
- `placement` persists round-trip through the `echotype_assessment` key
- `setResult`/`setPlacementEstimate` append **zero** rows to
  `db.evidenceEvents`
- `projectLearnerState` output is byte-identical with and without
  placement state
- a real mission session (`mission.meet_at_a_time`) serves, evaluates,
  and evidences identically regardless of placement — same
  `recognition_attempt` + `feedback` event pair, same deterministic ids
- sensitive-read inventory unchanged by authority: scanning
  `evidence-bridge/**` + `vnext/**` for the placement token family
  detects nothing
- evidence-bridge APIs are not callable as a generic placement bus (the
  store holds no reference to them)

## 6. Verification gates

- `pnpm vitest run src/lib/evidence-bridge/placement-boundary.test.ts` — 10/10
- `pnpm vitest run src/lib/authority-guardrails/` — 15/15
- `pnpm vitest run src/lib/evidence-bridge/` — full seam suite
- `pnpm test` — full Vitest suite
- `pnpm typecheck` (`tsc --noEmit`) — clean
- `pnpm lint` (Biome) — clean

GitHub CI/status is reported separately in the review thread — it is not
evidence for merge readiness.

## 7. Deferred + stop conditions

- **UI copy relabel** ("estimate" wording in vi/en/zh) is W2-AS1 scope —
  G03 lands the structural boundary; AS1 owns verbatim copy.
- Audited placement evidence is **not** implemented — per reviewer
  decision it would require a separate ADR (separate placement/history
  domain or non-capability ledger), not an `EvidenceEvent` extension.

`PLACEMENT BOUNDARY CONFIRMED — ESTIMATE IS NOT CAPABILITY TRUTH`
