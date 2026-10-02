# W2-00 — ADR + Executable Migration DAG (State Authority)

Status: proposed for external review · Base: `main @ 672b3f3` (post PR #4)
Sources: `STATE_AUTHORITY.md` (audit matrix), `MIGRATION_MAP.md` (module map)

## Decision

Migrate learner-capability authority from EchoType heuristic stores to the
FlashDay evidence kernel **without deleting or rewriting legacy tables in
Wave 2**. Every migration step is additive or read-path-only: adapters
dual-write, consumers switch reads to the projection, legacy rows remain as
history/cache until a later gate explicitly approves pruning.

Final source-of-truth per subsystem (unchanged from audit dispositions):

| Subsystem | Final authority | Legacy table becomes |
|---|---|---|
| Capability/proficiency state | kernel `LearnerProjection` over `evidenceEvents` | none today (weakSpots/assessment/pronunciationProgress were the impostors) |
| Memory scheduling | FSRS fields (`records.fsrsCard`, `favorites.fsrsCard`) | unchanged — scheduling only, never ability |
| Attempt/artifact history | `learningAttempts`, `sessions` | rich history; semantic outcomes also mint `EvidenceEvent` via bridge |
| Daily plan | kernel `nextAction`/`selectNextTask` decision | `dailyTasks` = executable cache of decisions |
| Weakness claims | projection (support-demand lifecycle) | `weakSpots` heuristic = candidate signal only |
| Level claim | projection + placement observation | `assessment.currentLevel` = advisory label |
| Pronunciation capability | acoustic EvidenceEvents (Wave 3) | `pronunciationProgress` = practice history |
| Corpus/prefs/caches/sync | existing stores | unchanged |

## Migration DAG

Legend: `S#` = step; `[needs: …]` = hard dependency; each step lists
change → guard → rollback.

```
S0 (DONE) kernel vendored + bridge + evidenceEvents table + mission surface
   └─ S1 freeze new authority violations
        ├─ S2 attempt→event adapter (dual-write)
        │    └─ S3 projection coverage check
        │         ├─ S4 planner authority → dailyTasks as cache
        │         └─ S5 weakSpots read migration → projection
        ├─ S6 pronunciationProgress demotion (labels/readers)
        ├─ S7 assessment CEFR relabel + placement event
        └─ S8 consumer sweep (dashboard/review surfaces read projection)
              [needs: S4, S5, S6, S7]
               └─ S9 writer-freeze completion + falsification pins
                    └─ S10 OPTIONAL historical backfill (gated)
```

### S0 — Foundation (already landed)
Kernel `src/vnext/`, bridge `src/lib/evidence-bridge/`
(`submitAttempt`/`submitObservation`/`projectState`/`nextAction`),
Dexie `evidenceEvents` (append-only, learner-scoped), mission surface
`(app)/mission`. No action.

### S1 — Freeze new authority violations
- Change: repo rule — no new code may read `records.accuracy`,
  `nextReview`/due-ness, `weakSpots.resolved`, `pronunciationProgress`,
  or `assessment.currentLevel` as a capability/proficiency claim. Review
  checklist + this doc's invariant table are the enforcement.
- Guard: grep-able invariant — new `ability` consumers must originate in
  `evidence-bridge` (`projectState`).
- Rollback: n/a (policy only).

### S2 — Attempt→event adapter (dual-write)
- Writers: `src/lib/learning-activity-persistence.ts`,
  `src/lib/vocabulary-repository.ts` (write `learningAttempts`/`sessions` today).
- Change: after the legacy row commit, emit a semantic `EvidenceEvent` via
  `submitAttempt`/`submitObservation`. Embedded self/AI feedback inside an
  attempt stays context — never mints capability.
- Guard: attempt with a semantic outcome ⇒ matching event exists
  (same-learner replay check in `evidence-bridge.test.ts` style).
- Rollback: stop emitting; legacy tables untouched.

### S3 — Projection coverage check
- Verify `projectState` exposes slots for: recurring-error support demand
  (weakSpots replacement), task-selection inputs (planner), module
  capability dimensions the dashboard needs. Missing slots ⇒ kernel/contract
  work flagged before proceeding — do NOT fake coverage.
- Rollback: n/a (verification gate).

### S4 — Planner authority migration
- Readers/writers: `daily-task-planner`, `daily-task-queue`,
  `vocabulary-workspace`, `import-schedule`.
- Change: planner delegates selection to kernel `nextAction`/`selectNextTask`;
  `dailyTasks` rows become the executable cache of those decisions
  (decision id recorded on the row for audit).
- Guard: every `dailyTasks` insert traces to a `NextTaskDecision`;
  legacy task kinds keep rendering while flagged non-authoritative.
- Rollback: planner flag → legacy budget selection; rows remain valid.

### S5 — weakSpots read migration
- Readers: `lesson-workshop`, `use-review-summary`, `use-learning-workspace`.
- Change: surfaces read recurring-error/support state from `projectState`;
  `weak-spots-store`/`weak-spots.ts` keep writing as a *candidate signal*
  (not displayed as authority).
- Guard: no UI "weakness/resolved" claim without a projection source.
- Rollback: point readers back at the table.

### S6 — pronunciationProgress demotion
- Writer/reader: `pronunciation-studio`, `daily-task-queue` badge.
- Change: presentation reads as practice/diagnostic history; no ability
  claim until acoustic EvidenceEvents exist (Wave 3 OpenPronounce audit).
- Rollback: copy/read-path revert.

### S7 — assessment CEFR relabel
- Change: `assessment-store.currentLevel` → "placement estimate" copy;
  emits a placement `submitObservation`; stripped from any gating inputs.
- Rollback: copy revert; event emission stopped.

### S8 — Consumer sweep
- Dashboard/recommendations/review surfaces read capability exclusively
  from `projectState`; `sessions.avgAccuracy` stays display-only analytics.
- Guard: falsification specs re-pinned; no direct ability reads remain.
- Rollback: per-surface read-path revert.

### S9 — Writer-freeze completion
- Legacy writers write history only; adapter is the sole semantic-outcome
  path. Verification: mission falsification + meet-person specs,
  `web-page`/egress suites, full Vitest.
- Rollback: n/a (freeze).

### S10 — OPTIONAL historical backfill (gated)
- Derive `EvidenceEvent`s from `learningAttempts`/`sessions` for projection
  warm-start. Events marked `source: 'backfill'` at reduced confidence;
  never fabricated as ability proof.
- Requires explicit go-ahead; skipped by default.

## Invariants (per subsystem, enforced end-state)

1. `evidenceEvents` append-only; commits idempotent — duplicate/conflicting
   ids refused (existing store rule).
2. FSRS tables: only scheduling fields read/written; due-ness never implies
   mastery; no new ability readers.
3. `learningAttempts`: semantic outcomes mint events only through the bridge;
   embedded feedback never promotes capability directly.
4. `dailyTasks`: every row traces to a kernel decision id; planner never
   self-authorizes capability claims.
5. `weakSpots`: weakness/resolved claims shown only from projection;
   heuristic rows are candidate signals.
6. `pronunciationProgress`: display = practice history until W3 acoustics.
7. `assessment`: CEFR = placement label; never gates mission/content.
8. `sessions`: analytics display only.
9. Rollback property: every step revertible by reverting the read/emit
   path — no destructive ops this wave.
