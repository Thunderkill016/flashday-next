# W2-01 — Authority Claim Inventory (W2-G01 output)

Mission: W2-01 — Authority Guardrails.
Base: `main @ c2ef466` (post-W2-00R2).
Status: inventory + invariant guardrails only — **no runtime behavior changes**.

This document records every production read site of authority-sensitive legacy
state, its classification, and the Wave-2 DAG node that owns its migration.
The machine-readable twin is `src/lib/authority-guardrails/legacy-claim-sites.json`;
`src/lib/authority-guardrails/guardrail.test.ts` enforces that the inventory is
complete (new sensitive read → test failure) and current (removed read → stale
entry failure).

## Sources under guard

| Source family | Sensitive reads | Authority doctrine (STATE_AUTHORITY.md) |
|---|---|---|
| `records` | `records.accuracy`, `attempts`, `mistakes`, `lastPracticed`, `LearningRecord` values | History/analytics. `accuracy` is a *display statistic*, not ability. |
| `fsrs` | `fsrsCard.*`, `nextReview`, `last_review`, `accuracyToRating`, `gradeCard`, `previewRatings`, `buildReviewForecast` | Memory scheduling only. Due-ness ≠ mastery. |
| `sessions` | `sessions.completed`, `accuracy`, `startTime/endTime`, `TypingSession`, `lessonProgress` | History/analytics. Aggregates are display data. |
| `weakSpots` | `weakSpots.*`, `weakSpotType`, `resolved`, `WeakSpot` type, `sourceWeakSpotId` | Remediation candidate rows. `resolved` is user/system lifecycle, not recovery proof. |
| `pronunciationProgress` | `pronunciationProgress.*`, `PronunciationProgress` | Practice history. Not pronunciation mastery. |
| `assessment.currentLevel` | `currentLevel`, `useAssessmentStore`, `echotype_assessment`, `CEFRLevel` | **Advisory placement estimate only** (W2-00R2 boundary). Never capability truth. |
| `learningAttempts` | `learningAttempts.*`, `persistLearningAttempt`, `LearningAttempt`, `attempt.*`, `deriveTextCycle`, `introducedVocabularyToday` | Raw attempt history — fact-preserving replay source for W2-AT1. |
| `dailyTasks` | `dailyTasks.*`, `DailyTask`, `preferences:*`, `task.kind`, task lifecycle helpers | Executable planner cache + lifecycle + preferences rows. Not capability truth. |
| `dailyPlan` | `useDailyPlanStore`, `generateDailyPlan`, `syncPlanTasks*`, `PlanTask`, `getDailyPlanSignature` | Zustand planner cache — same class as `dailyTasks`. |

## Classification taxonomy

- **LEGIT_SCHEDULING** — drives *when/what to practice next* via FSRS due-ness or
  task lifecycle. Legitimate use of scheduling authority.
- **LEGIT_HISTORY** — transport, schema, export, hydration, fixtures, type
  declarations, and write-path persistence of history rows.
- **LEGIT_ANALYTICS** — aggregate statistics for dashboards/reports.
- **LEGIT_PRESENTATION** — renders stored values to the user as-is (counts,
  badges, lists) without elevating them to capability claims.
- **LEGIT_CANDIDATE_SIGNAL** — advisory input to ordering/recommendation/
  orientation. Permitted for placement (`currentLevel`) per the W2-00R2 boundary;
  for other sources it marks heuristic candidate selection owned by a Wave-2 node.
- **CAPABILITY_CLAIM** — a read that *produces or feeds a learner-facing or
  planner-facing capability assertion* (mastery, weakness, recovery, level,
  readiness). These are the sites W2 must migrate to kernel projection.
- **AMBIGUOUS** — forbidden in the final manifest (test-enforced).

## CAPABILITY_CLAIM findings

Three production sites turn legacy history into capability claims today.
Each is owned by a Wave-2 node; none is modified in this mission.

### C1 — `src/lib/daily-plan.ts` :: records → `W2-PL1`

`buildModulePriority` computes `weakness = 100 − avgAccuracy(records.accuracy)`
and feeds it into daily-plan module ordering. Raw typing accuracy is reused as
a *weakness model*. Under Wave 2, plan ordering must consume kernel projection
(due memory work + capability gaps), not record statistics.

### C2 — `src/lib/chat-analytics.ts` :: records → `W2-CS1`

`collectLearningSnapshot` labels contents with `records.accuracy < 70` as
"weaknesses" and injects them into the AI tutor's context. The tutor then
speaks as if those were diagnosed weaknesses. Under W2-CS1 the tutor context
must carry kernel-derived remediation constructs (correction episodes,
recurring-error ledgers) or nothing.

### C3 — `src/components/learning/lesson-workshop.tsx` :: weakSpots → `W2-WS2`

`weakSpot.resolved` drives a learner-facing "Resolved" recovery claim and
gates the workshop resolution flow. A lifecycle flag stands in for demonstrated
remediation. W2-WS2 replaces this with the kernel's remediation constructs
(correction episodes, retest surfaces, support lifecycle).

## Claim-surface audit

Learner-facing surfaces that assert or imply capability, traced to source:

| Surface | Claim | Source | Classification | Owner |
|---|---|---|---|---|
| Daily-plan module ordering | "you need more of module X" (implicit) | `records.accuracy` weakness heuristic | CAPABILITY_CLAIM | W2-PL1 |
| AI tutor context "Weaknesses" | diagnosed weak areas | `records.accuracy < 70` | CAPABILITY_CLAIM | W2-CS1 |
| Lesson workshop "Resolved" | remediation achieved | `weakSpots.resolved` | CAPABILITY_CLAIM | W2-WS2 |
| Today-review ordering | weakest-first sort | `record.accuracy` ordering heuristic | LEGIT_CANDIDATE_SIGNAL | W2-MB1 |
| Daily-task weak-spot card | "retry a recent difficulty" | `weakSpots[0]` candidate | LEGIT_CANDIDATE_SIGNAL | W2-PL1 |
| Dashboard "Accuracy" card | aggregate % | `sessions`/`records` aggregates | LEGIT_ANALYTICS | W2-CS1 |
| Dashboard "Weak spots" entry | open count | `weakSpots` unresolved count | LEGIT_PRESENTATION | W2-WS2 |
| Review queue / forecast | due items, upcoming load | `fsrsCard.due`, `nextReview` | LEGIT_SCHEDULING | W2-MB1 |
| Favorites review | due favorites | `favorites.fsrsCard` | LEGIT_SCHEDULING | W2-MB1 |
| Pronunciation studio "N/48 practiced" | practice coverage | `pronunciationProgress` rows | LEGIT_PRESENTATION | W2-PR1 |
| Learn pages "step done" | lesson completion | `sessions.completed` via `lessonProgress`, `learningAttempts` via `deriveTextCycle` | LEGIT_PRESENTATION | W2-CS1 |
| Assessment "Current level" | placement estimate | `assessment.currentLevel` | LEGIT_PRESENTATION (advisory) | W2-AS1 |
| Recommendations/difficulty hints | level-appropriate suggestions | `assessment.currentLevel` | LEGIT_CANDIDATE_SIGNAL (advisory) | W2-AS1 |
| AI tutor level context | tutor difficulty tuning | `assessment.currentLevel` → `cefrLevel` | LEGIT_CANDIDATE_SIGNAL (advisory) | W2-AS1 |

`currentLevel` consumers are all advisory placement uses (display, adaptive
question distribution, recommendation/tutor context) — none gates missions or
tasks, matching the W2-00R2 placement boundary. W2-AS1 still owns the relabel
(estimate wording) and consumer audit.

## Adversarial review (spec §12)

- **A — "mastered" from `record.accuracy > 80`:** would appear as a new
  `records` read not in the manifest → guardrail test fails. The scanner treats
  *any* sensitive read as requiring classification, so a hidden mastery claim
  cannot slip in without an explicit `CAPABILITY_CLAIM` + owner entry.
- **B — FSRS ordering disguised as capability:** `fsrsCard.due` reads are
  detected and classified `LEGIT_SCHEDULING`; the suite additionally asserts no
  `fsrs` entry may carry `CAPABILITY_CLAIM` — scheduling state can never be a
  capability source, enforcing the memory boundary in both directions.
- **C — `weakSpot.resolved` in render paths:** detected via the `weakSpots`
  family; the lesson-workshop site is already marked `CAPABILITY_CLAIM → W2-WS2`.
- **D — `currentLevel` for onboarding:** detected via the assessment family and
  held to `LEGIT_CANDIDATE_SIGNAL`/`LEGIT_PRESENTATION` — any gating use would
  need a new manifest entry reviewed against the placement boundary.
- **E — alias/helper hiding:** detection keys on type imports
  (`LearningRecord`, `TypingSession`, `WeakSpot`, `LearningAttempt`, `DailyTask`,
  `PronunciationProgress`, `FSRSCardData`) and helper names
  (`deriveTextCycle`, `introducedVocabularyToday`, `persistLearningAttempt`,
  `lessonProgress`, sync/task helpers), so a helper that funnels the read is
  itself flagged. Limitation: a helper reading a field via a fresh local
  variable name with no type import could evade the patterns — mitigated by
  code review + the doc-level claim-surface audit, which traces UI claims to
  their data source rather than to identifiers.

## Guardrail mechanics

- `patterns.ts` defines the detection families (file-level, bounded regexes —
  deliberately no parser dependency; type tokens provide alias coverage).
- `legacy-claim-sites.json` is the test-owned manifest: `{file, source,
  classification, reason, migrationNode}` per (file, source) pair.
- `guardrail.test.ts` enforces:
  1. every detected (file, source) has a manifest entry — *new reader → fail*;
  2. every manifest entry still detects its source — *stale entry → fail*;
  3. classifications are known; `AMBIGUOUS` is forbidden;
  4. every `CAPABILITY_CLAIM` names a `migrationNode` present in
     `docs/flashday/W2_MIGRATION_DAG.json`;
  5. adversarial fixtures A–E verify the detector itself.

## Scope statement

Docs + test-owned static inventory only. No runtime changes, no writer freeze,
no dual-write, no event emission, no schema split, no merge without explicit
authorization.
