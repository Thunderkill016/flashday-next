# W2-01 / W2-01R / W2-01R2 — Authority Claim Inventory (W2-G01 output)

Mission: W2-01 → W2-01R (site-level guardrail revision) → W2-01R2
(multiplicity-safe coverage + owner correction, per external review).
Base: `main @ c2ef466` (post-W2-00R2).
Status: inventory + invariant guardrails only — **no runtime behavior changes**.

This document records every production occurrence of authority-sensitive
legacy state, grouped into logical sites with classifications and Wave-2
migration owners. The machine-readable twin is
`src/lib/authority-guardrails/legacy-claim-sites.json`;
`src/lib/authority-guardrails/guardrail.test.ts` enforces the frozen baseline.

## Site model (W2-01R)

The W2-01 manifest used `(file, source)` pairs — a file once inventoried for
`records` could gain further `records` reads undetected (documented bypass,
reproduced in the test suite). W2-01R replaces that with **occurrence-level
sites**:

- A *sensitive occurrence* is a normalized source line matching a source-family
  pattern (whitespace-collapsed; line content, not line numbers, is the
  identity).
- A *site* is a logical read path: `{id, file, source, anchor, occurrences,
  classification, reason, migrationNode, transitional?}`. Its `occurrences`
  list owns sensitive lines **with multiplicity preserved** — a line that
  legitimately occurs N times is listed N times (W2-01R2: set-based coverage
  collapsed duplicates, letting a verbatim copy pass undetected).
- Guardrail: per `(file, source)`, the claimed occurrence multiset must equal
  the detected occurrence multiset exactly — any added, removed, duplicated,
  or edited sensitive line fails until a human re-classifies it.
  Type/import/plumbing lines are owned by explicit `*-io`/`access` sites so
  semantic sites stay clean.

## Sources under guard

| Source family | Sensitive reads | Authority doctrine (STATE_AUTHORITY.md) |
|---|---|---|
| `records` | `records.*` member access, `record.accuracy/attempts/mistakes/lastPracticed`, `r.`/`a.`/`b.` callback reads of those fields, `LearningRecord` | History/analytics. `accuracy` is a *display statistic*, not ability. |
| `fsrs` | `fsrsCard.*`, `nextReview`, `last_review`, `FSRSCardData`, `accuracyToRating`, `gradeCard`, `previewRatings`, `buildReviewForecast`, `Rating.*` | Memory scheduling only. Due-ness ≠ mastery. No `CAPABILITY_CLAIM` may cite this family (test-enforced). |
| `sessions` | `sessions.*`, `session.completed/accuracy/endTime/startTime`, `s.` equivalents incl. `totalWords/module/contentId`, `TypingSession`, `lessonProgress` | History/analytics. Aggregates are display data. |
| `weakSpots` | `weakSpot(s)`, `weakSpotType`, `resolved`, `WeakSpot`, `sourceWeakSpotId`, `canResolveTransfer`, `weak-spots` refs | Remediation candidate rows. `resolved` is lifecycle, not recovery proof. |
| `pronunciationProgress` | `pronunciationProgress.*`, `PronunciationProgress`, `evidence.pronunciation` | Practice history. Not pronunciation mastery. |
| `assessment.currentLevel` | `currentLevel`, `useAssessmentStore`, `echotype_assessment`, `CEFRLevel`, `levelToDifficulty`, `cefrToDifficulty` | **Advisory placement estimate only** (W2-00R2 boundary). Never capability truth. |
| `learningAttempts` | `learningAttempts.*`, `attempt.*` fields, `attempts.*`, `LearningAttempt`, `persistLearningAttempt`, `deriveTextCycle`, `introducedVocabularyToday`, `validateTextCycle*` | Raw attempt history — fact-preserving replay source for W2-AT1. |
| `dailyTasks` | `dailyTasks.*`, `DailyTask`, `preferences:*`, `task.kind`, task lifecycle helpers | Executable planner cache + lifecycle + preferences rows. Not capability truth. |
| `dailyPlan` | `useDailyPlanStore`, `generateDailyPlan`, `syncPlanTasks*`, `PlanTask`, `getDailyPlanSignature`, `isDailyPlanPractice` | Zustand planner cache — same class as `dailyTasks`. |

## Truthful counts (exact HEAD)

- **84** unique production files touched
- **167** (file, source-family) pairs
- **172** logical sites
- **990** sensitive occurrence lines frozen (909 distinct; multiplicity
  preserved — 81 lines occur more than once)
- Classification counts: `LEGIT_HISTORY` 56 · `LEGIT_SCHEDULING` 53 ·
  `LEGIT_PRESENTATION` 33 · `LEGIT_CANDIDATE_SIGNAL` 17 · `LEGIT_ANALYTICS` 10
  · `CAPABILITY_CLAIM` 3 · `AMBIGUOUS` 0 (forbidden by test)

## CAPABILITY_CLAIM sites (owned, unmodified)

| Site | Claim | Owner |
|---|---|---|
| `lib-daily-plan.records-weakness-heuristic` | `moduleRecords` avg `accuracy` → weakness score → module priority | W2-PL1 |
| `lib-chat-analytics.records-weakness-claim` | `records.accuracy < 70` → "weaknesses" in AI tutor context | W2-CS1 |
| `components-learning-lesson-workshop.weakSpots-resolve-claim` | `weakSpot.resolved` + `canResolveTransfer` heuristic → learner-facing "Resolved" | W2-WS2 |

## Mixed-use splits (W2-01R item E)

- `today-review.ts :: records` → three sites: `io` (load/types, HISTORY),
  `display` (subtitle fields, PRESENTATION), `sort` (`a.accuracy − b.accuracy`
  weakest-first ordering, CANDIDATE_SIGNAL → **W2-CS1**; corrected in W2-01R2 —
  legacy-accuracy ordering is a review-surface consumer heuristic, not an FSRS
  memory-boundary concern. W2-MB1 keeps only the `fsrsCard.due/nextReview`
  sites).
- `daily-plan.ts :: records` → `io` (HISTORY) + `weakness-heuristic`
  (CAPABILITY_CLAIM → W2-PL1).
- `dashboard/page.tsx :: sessions` → `aggregates` (ANALYTICS) +
  `recent-activity` (PRESENTATION).
- `lesson-workshop.tsx :: weakSpots` → `resolve-claim` (CAPABILITY_CLAIM →
  W2-WS2) + `context` (CANDIDATE_SIGNAL → W2-WS2).
- `chat-analytics.ts :: records` → single `weakness-claim` site (the only
  semantic use is the claim).
- `daily-task-planner.ts` — reviewed: per-source use is semantically uniform
  (task-completion evidence / task lifecycle) → single sites kept.

## Transitional advisory sites (W2-01R item F)

`assessment.currentLevel` consumers are advisory placement uses — none gates
missions or tasks. Two are explicitly marked `transitional: true` because they
feed *ongoing* daily-plan generation rather than one-time orientation:

- `lib-daily-plan.assessment-currentLevel-advisory-difficulty`
  (`currentLevel → levelToDifficulty → generateDailyPlan`) — owner W2-AS1,
  co-owned by W2-PL1. Will not survive final planner authority unless the
  W2-00R2 placement boundary explicitly justifies it.
- `components-dashboard-today-plan.assessment-currentLevel` (`currentLevel →
  plan input + levelKey invalidation`) — same transitional status.

## Claim-surface audit

Learner-facing surfaces that assert or imply capability, traced to source:

| Surface | Claim | Source site | Classification |
|---|---|---|---|
| Daily-plan module ordering | implicit "you need module X" | `lib-daily-plan.records-weakness-heuristic` | CAPABILITY_CLAIM → W2-PL1 |
| AI tutor "Weaknesses" | diagnosed weak areas | `lib-chat-analytics.records-weakness-claim` | CAPABILITY_CLAIM → W2-CS1 |
| Lesson workshop "Resolved" | remediation achieved | `…lesson-workshop.weakSpots-resolve-claim` | CAPABILITY_CLAIM → W2-WS2 |
| Today-review ordering | weakest-first sort | `…today-review.records-sort` | LEGIT_CANDIDATE_SIGNAL → W2-CS1 |
| Daily-task weak-spot card | "retry a recent difficulty" | `…daily-task-queue.weakSpots` | LEGIT_CANDIDATE_SIGNAL → W2-PL1 |
| Dashboard stats | aggregate %/counts | `…dashboard.sessions-aggregates`, `records`, `fsrs` forecast | ANALYTICS / SCHEDULING |
| Review queue / forecast | due items | `fsrs` sites | LEGIT_SCHEDULING → W2-MB1 |
| Pronunciation studio "N/48" | practice coverage | `pronunciation-studio` site | LEGIT_PRESENTATION → W2-PR1 |
| Learn pages "step done" | lesson completion | `lessonProgress`/`deriveTextCycle` sites | LEGIT_PRESENTATION → W2-CS1 |
| Assessment level display | placement estimate | `assessment.currentLevel` sites | PRESENTATION / CANDIDATE_SIGNAL → W2-AS1 |

## Adversarial review (spec §12 + W2-01R H)

- **Same-file new read (the documented W2-01 bypass):** adding
  `records.filter((r) => r.accuracy > 80)` to an inventoried file leaves the
  legacy `(file, source)` check green but produces an *uncovered occurrence* →
  site-level test fails. Reproduced and regressed in `guardrail.test.ts`.
- **Identical-line duplication (the W2-01R bypass):** duplicating an
  already-inventoried line verbatim (`accuracy: record.accuracy,` appended to
  `today-review.ts`) leaves set-based coverage green — both copies satisfy
  `owned.has(line)` — but detected count 2 ≠ claimed count 1 → multiset test
  fails. Reproduced and regressed in `guardrail.test.ts`.
- **A — accuracy-threshold mastery:** `record.accuracy > 80` detected.
- **B — FSRS ordering:** `fsrsCard.due` detected; suite asserts no `fsrs` site
  may carry `CAPABILITY_CLAIM` (memory boundary, both directions).
- **C — `weakSpot.resolved` render reads:** detected; the resolve-claim site
  already carries `CAPABILITY_CLAIM → W2-WS2`.
- **D — `currentLevel` onboarding:** detected; transitional advisory sites are
  flagged and owned.
- **E — alias/helper hiding:** type tokens (`LearningRecord`, `TypingSession`,
  `WeakSpot`, `LearningAttempt`, `DailyTask`, `PronunciationProgress`,
  `FSRSCardData`, `CEFRLevel`), helper names (`deriveTextCycle`,
  `introducedVocabularyToday`, `persistLearningAttempt`, `lessonProgress`,
  `levelToDifficulty`, `cefrToDifficulty`, `canResolveTransfer`), and short
  iterator vars (`r.`, `a.`/`b.` comparators) are all detected. Strengthened
  patterns caught 5 additional (file, source) pairs vs the original run —
  all benign word-match `r.accuracy` categorical reads, classified honestly.

## Three-layer limitation model (W2-01R item I)

1. **Mechanically frozen** — any added/removed/edited/duplicated
   sensitive-token line in production code changes a `(file, source)`
   occurrence multiset → test fails until a human classifies it.
   Type/import/plumbing lines are frozen too.
2. **Review-policy frozen** — the scanner sees *read lines*, not downstream
   value flow: `const acc = record.accuracy` stays frozen, but a later
   `showMastered(acc)` in a file with no sensitive token would not be caught
   by static scanning alone. Mitigation: the claim-surface audit traces UI
   claims to data sources, and review policy requires mapping any new
   capability-shaped surface to a manifest owner.
3. **Future migrated** — inventoried `CAPABILITY_CLAIM` / transitional sites
   remain runtime-unchanged by design; each names the W2 node that owns its
   migration to kernel projection.

## Scope statement

Docs + test-owned static inventory only. No runtime changes, no writer freeze,
no dual-write, no event emission, no schema split, no merge without explicit
authorization.
