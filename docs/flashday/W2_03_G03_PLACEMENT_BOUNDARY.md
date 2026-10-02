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
  `difficultyFitScore` — placement silently steered *which* recurring
  tasks/content the daily plan selected (a planner-authority leak, since
  the permitted uses are orientation/onboarding/initial-content only).
- `use-recommendations.ts` sent it to `/api/recommendations` as
  `userLevel`, which injected "recommend content appropriate for this
  proficiency level" into every AI recommendation prompt — recurring
  personalization, not initial-content recommendation (cut in R2).
- `chat-panel.tsx` exposed an `updateUserLevel` tool letting the chatbot
  *write* the level with no provenance, sent the level as `userLevel` to
  `/api/chat` (which told the tutor to match that CEFR level across
  practice, search, exercise generation and tool calls), and fell back to
  `cefrToDifficulty(level)` for the `generateContent` tool's difficulty.
  The reads were cut in R3; the claim writer stays.
- `app/api/assessment/route.ts` used it to tune the next quiz's question
  distribution (producer-side input to the placement flow itself).
- `chat-analytics.ts` read `parsed.state?.currentLevel` — a path that
  never existed in the flat persisted payload, so the snapshot's
  `cefrLevel` was always `null`. The first G03 pass "fixed" that read,
  which turned a dead path into a live edge: `showAnalytics` hands the
  snapshot to the tutor, which can suggest exercises from it. R3 removed
  `cefrLevel` from the machine-consumed snapshot entirely.

None of these are capability authority — but nothing in the type system
or storage schema said so, and the daily-plan edge crossed into planner
authority. G03 makes the boundary explicit **and cuts the leak**.

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
  score + timestamp and appends the result to `history` unchanged. This is
  the ONLY way `source: 'placement_test'` can be produced.
- `setPlacementEstimate(level)` — takes no source argument; the writer
  hard-codes `source: 'chat_tool'` / `method: 'chat_tool'`, so even an
  untyped JS caller passing a second argument cannot forge quiz provenance.
- `hydrate()` — accepts the legacy `{ currentLevel, history }` payload and
  lifts it to `placement` with `source: 'legacy_payload'`,
  `method: 'hydrated_legacy'`, `score: null`, `completedAt: 0`. The bare
  legacy level never proved which history entry (if any) produced it — a
  chat claim could have overwritten it — so provenance is honestly
  unknown rather than inferred from a colliding level string.
- `isPlacementEstimate()` validates the full shape including
  source↔method↔score↔timestamp correlation (`placement_test` ⇒ numeric
  score + `completedAt > 0`; `chat_tool` ⇒ `score: null` +
  `completedAt > 0`; `legacy_payload` ⇒ `score: null` + `completedAt === 0`);
  malformed persisted objects hydrate to `null`, never to a trusted estimate.
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
| `dashboard/today-plan.tsx` | **none** — placement read removed entirely | cut (see §3a) |
| `lib/daily-plan.ts` | **none** — `levelEstimate` option removed | cut (see §3a) |
| `stores/daily-plan-store.ts` | **none** — `levelKey` invalidation removed | cut (see §3a) |
| `lib/learning-goals.ts` | **none** — `level` param removed from plan explanation | cut (see §3a) |
| `hooks/use-recommendations.ts` | **none** — `userLevel` no longer sent | cut (see §3a) |
| `app/api/recommendations/route.ts` | **none** — `userLevel` no longer read or injected into the prompt | cut (see §3a) |
| `assessment/assessment-section.tsx` | display + seeds next quiz | advisory |
| `app/api/assessment/route.ts` | question-distribution tuning | advisory producer |
| `chat/chat-panel.tsx` | **write only** — `updateUserLevel` → `setPlacementEstimate(level)`; no `userLevel`, no difficulty fallback | writer (see §3a) |
| `app/api/chat/route.ts` | **none** — `userLevel` no longer read or injected into the system prompt | cut (see §3a) |
| `lib/chat-analytics.ts` | **none** — `cefrLevel` removed from `LearningSnapshot` | cut (see §3a) |
| `(app)/layout.tsx` | `hydrate()` call only | plumbing |

### 3a. The recurring-planner edge is cut, not reclassified

First-pass review found `levelEstimate` still steering recurring daily-plan
selection (`difficultyFitScore` in candidate scoring, `levelKey` plan
invalidation). A daily plan is a recurring planner — the doctrine permits
orientation/onboarding/initial-content recommendation only — so the edge
is removed structurally:

- `DailyPlanOptions.levelEstimate` deleted; `generateDailyPlan` has no
  placement input channel.
- `levelToDifficulty` / `difficultyFitScore` / `difficultyDistance` /
  `isWeeklyBalanceEligible` / `weeklyPriorityEligible` deleted — the whole
  difficulty-fit surface existed only to consume placement.
- `daily-plan-store.levelKey` deleted — placement changes no longer
  invalidate or regenerate plans.
- Plan explanation copy no longer claims level-driven difficulty.
- Selection now ranks by weakness + recency + goal with deterministic
  date-seeded rotation; content difficulty metadata is not a selector.
- R2: the same rule applies to AI content recommendations —
  `use-recommendations` no longer reads placement and `/api/recommendations`
  no longer accepts `userLevel`, so placement cannot shape generated
  recommendation content. Using placement as a long-term personalization
  signal would need its own ADR.
- R3 (reviewer ruling: cut): the chat tutor gets no placement input.
  `ChatPanel` no longer sends `userLevel`; `/api/chat` no longer accepts it;
  `generateContent` uses only the active content's own difficulty metadata
  (`activeContentItem?.difficulty`, a content property, not a learner
  claim); `LearningSnapshot` carries no `cefrLevel`.

Final boundary:

- **Placement readers:** dashboard orientation/reminder; the assessment
  flow itself (display + next-quiz seeding).
- **Placement writers:** placement test (`setResult`); explicit chat claim
  (`setPlacementEstimate`).
- **Zero placement input:** recurring planner, AI recommendations, chat
  tutor, generated content, analytics snapshot, kernel/projection, mission
  gating, evidence bridge, sync.

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

## 5. Regressions landed — `placement-boundary.test.ts` (16/16) + route/analytics pins

- legacy `{ currentLevel }` payload hydrates to an advisory estimate;
  `history` preserved verbatim — and a colliding history level does NOT
  donate its score/timestamp (provenance stays honestly unknown)
- `placement` persists round-trip through the `echotype_assessment` key
- `setResult`/`setPlacementEstimate` append **zero** rows to
  `db.evidenceEvents`
- `projectLearnerState` output is byte-identical with and without
  placement state
- a real mission session (`mission.meet_at_a_time`) serves, evaluates,
  and evidences identically regardless of placement — same
  `recognition_attempt` + `feedback` event pair, same deterministic ids
- **placement A1 vs C2 yields an identical recurring daily plan**
  (semantic task keys equal) and `generateDailyPlan` rejects a
  `levelEstimate` option at the type level (`@ts-expect-error` pin)
- `setPlacementEstimate` always writes `chat_tool` provenance even when an
  untyped caller passes `'placement_test'` as an extra argument (runtime
  pin, in memory and persisted); `isPlacementEstimate` rejects malformed or
  provenance-inconsistent persisted objects, including a `legacy_payload`
  claiming a known timestamp
- `/api/recommendations` builds an identical system/user prompt with and
  without a client-supplied `userLevel` (`route.test.ts`)
- `/api/chat` passes identical `system` + `messages` to `streamText` with
  and without `userLevel: 'C2'`, with no "CEFR" in the system prompt
  (`api/chat/route.test.ts`, drives the real `POST`)
- `collectLearningSnapshot` never reads `echotype_assessment` and its
  output contains no level/placement/CEFR (`chat-analytics.test.ts`)
- source scan: planner, recommendations, chat route, chat analytics and
  chat tool executor contain no placement tokens and no
  `userLevel`/`cefrLevel` channel; `ChatPanel`'s only assessment-store
  access is the `setPlacementEstimate` selector
- sensitive-read inventory unchanged by authority: scanning
  `evidence-bridge/**` + `vnext/**` for the placement token family
  detects nothing
- evidence-bridge APIs are not callable as a generic placement bus (the
  store holds no reference to them)
- `daily-plan.test.ts` re-pins selection as placement-independent
  (difficulty-neutral deterministic rotation)

## 6. Verification gates

- `pnpm vitest run src/lib/evidence-bridge/placement-boundary.test.ts` — 16/16
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
- The chat-tutor `userLevel` question raised in R2 was ruled **cut** and
  is done in R3 (§3a).

`PLACEMENT BOUNDARY CONFIRMED — ESTIMATE IS NOT CAPABILITY TRUTH`
