# FD-VS01 — Implementation Plan (proposal, not authorized)

**Depends on:** `docs/flashday/FD_VS01_RESEARCH.md` (sections A–K)
**Status:** proposed for human/external review — DO NOT implement before
FD-VS01-I is authorized.
**Goal:** one learner (product owner), one article, 5 chunks, ~3 days,
answering: *can the learner use the target ~24h later in a changed
context without answer-bearing support?*

**New concepts introduced: 1** — the derived `Vs01TargetRecord` (a read
model over existing tables; no new persisted entity, no new authority).
Everything else reuses existing stages, tables, and validators.

## Change 1 — Pilot fixture (content, not code)

- **Learner-visible:** nothing new — "My Morning Routine" already appears
  as a lesson after seed; the 5 chunk items appear as a small wordbook.
- **Reuses:** `contents` table, `learning-units.ts` lesson building,
  builtin seed path (`src/lib/seed.ts` + `src/lib/seed-data/`).
- **Modification:** one seed/fixture file adding the pinned article
  reference and 5 `word`-type `ContentItem`s
  (`title` = English chunk, `text` = Vietnamese cue), grouped under one
  wordbook collection tagged `vs01`. May also be authored manually in
  Library → then the fixture file documents the exact items instead.
- **Test:** unit test that the fixture parses into valid `ContentItem`s
  and that each chunk is a verbatim substring of its source sentence.
- **Enables:** targets T1–T5 with stable `targetId`s.

## Change 2 — Persist failed immediate-recall submissions

- **Learner-visible:** identical UI — a wrong typed answer still shows
  "wrong" and retries; the only difference is the miss is recorded.
- **Reuses:** `savePracticeSession` (`src/lib/daily-plan-progress.ts`),
  `sessions` table, `isWordBookWriteMatch`
  (`src/lib/wordbook-write-target.ts`).
- **Modification:** in `WordBookPractice.handleSubmit`
  (`src/components/shared/word-book-practice.tsx:422-427`), persist a
  `completed:false` session (accuracy 0, `endTime`) before showing
  `wrong`. ~15 lines. Optionally cap one failed record per attempt burst
  to avoid spam rows.
- **Test:** vitest — a wrong submit writes one `sessions` row with
  `completed:false`; a subsequent correct submit writes the success row.
- **Enables:** `immediateRecallOutcome`/`delayedRecallOutcome` failures —
  the difference between "forgot" and "never tried". **This is the only
  strictly-required runtime change.**

## Change 3 — Telemetry reader (pure, derived)

- **Learner-visible:** none — devtools/console or a JSON export button
  behind the dogfood flag.
- **Reuses:** `learningAttempts`, `sessions`, `records`, `lookupHistory`,
  `deriveTextCycle` — all already persisted; the reader replays them.
- **Modification:** new pure module `src/lib/vs01-telemetry.ts`:
  `(targets, dbSnapshot) => Vs01TargetRecord[]` implementing the record
  shape in research §F. ~150 lines, zero writes.
- **Test:** fixture attempts/sessions → expected per-target records
  including the four required distinctions (understood-but-forgot /
  recalled-not-produced / produced-not-transferred / transferred).
- **Enables:** outcome capture (stage 7) and the failure taxonomy —
  inspectable locally, no dashboard.

## Change 4 — Dogfood runbook (doc, not code)

- **Learner-visible:** none.
- **Reuses:** existing daily-task surfacing
  (`buildTextCourseTasks` → dashboard `/review`) — the schedule is
  already pushed to the learner; the runbook just says *when* the
  dogfooder sits down (day 1 learn, day 2 recall+transfer, day 3
  cleanup) and what honest recording means (no peeking before rating).
- **Modification:** `docs/flashday/FD_VS01_DOGFOOD.md` — checklist +
  per-target record template.
- **Test:** none (doc).
- **Enables:** honest ~24h measurement — `delayedAttemptAt` timestamps
  come from real sessions across days, never a shortened clock.

## Change 5 (optional, only if Change 3 shows a gap) — chunk-level
recall surfacing inside the lesson

- **Learner-visible:** a small "chunk recall" card under the lesson when
  a chunk item is due — deep-link or embedded `WordBookPractice`.
- **Reuses:** `WordBookPractice`, FSRS `due` on the chunk's record.
- **Modification:** one conditional block in `lesson-workshop.tsx`;
  skipped entirely if the dogfooder is fine using `/review/today`.
- **Test:** renders only when a chunk record is due.
- **Enables:** convenience only — cut if scope pressure demands.

## Explicitly not in this plan

- No kernel/contract/evidence changes (`src/vnext/**` untouched).
- No new Dexie table, no new Zustand store, no new route.
- No AI/ASR evaluator; production/transfer stay self-report + the
  existing deterministic validators + human review.
- No 24h fake-clock in dogfood (fake clocks OK in unit tests only).
- No PC1 cherry-pick (`7ecfe3f`/`5a66dff`/`89b60c1` all NOT_NEEDED_YET).

## Estimated size

| Metric | Estimate |
|---|---|
| Runtime files changed | 2 (word-book-practice, seed fixture) + 1 new pure module |
| Test files | 2 (fixture validity + telemetry reader) |
| New persisted entities | 0 |
| New concepts | 1 (derived record) |
| New subsystems | **0** |

## Dogfood observation plan (3 days, 1 learner)

- **Day 1:** lesson understand → immediate recall (5 chunks) →
  production + correction. Records: comprehension attempt, 5 sessions,
  output + revision attempts.
- **Day 2 (≥20h later):** due recall surfaced on dashboard; per-chunk
  recall via review; transfer `apply` per chunk. Records: recall
  attempts w/ ratings+assist flags, chunk sessions, `personal-example`
  attempts w/ `cycle.expression`.
- **Day 3:** remaining dues; derive `Vs01TargetRecord[]`; label each
  target + failureReason; write a short failure memo.
- **Decision gate:** the memo, not a metric, decides whether a 10-learner
  pilot or a product change is next.
