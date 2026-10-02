# State Authority Matrix — FDN-ARCH-001

Storage locations: Dexie `echotype:<scope>` (24 tables) · localStorage (stores).

Doctrine under audit:

```text
Evidence Log → Learner Projection → Planner → Mission → Execution surfaces
FSRS = memory scheduling only (not ability, not proficiency)
completion ≠ mastery · accuracy ≠ proficiency · STT transcript ≠ pronunciation
course position ≠ ability · AI score ≠ certified level
```

| STATE | STORAGE | WRITERS | READERS | CLAIM | CURRENT AUTHORITY | FUTURE AUTHORITY | CONFLICT RISK | DISPOSITION |
|---|---|---|---|---|---|---|---|---|
| evidenceEvents | Dexie | evidence-bridge commit | projection, falsification specs | durable attempt outcomes | FlashDay kernel | FlashDay kernel | none observed | KEEP |
| learningAttempts | Dexie | lesson/workshop flows | progress UI | rich learner artifact/attempt history | EchoType | keep as history; adapter/transaction may also write EvidenceEvent for semantic outcomes | medium — must not become a second mastery source; embedded self/AI feedback must not promote capability state directly | ADAPT — funnel semantic writes through bridge |
| records (FSRS) | Dexie | practice flows, import-schedule | review, today-review, dashboard | memory scheduling state | FSRS | FSRS (scheduling only) | medium — sometimes read as ability | KEEP but enforce scheduling-only reads |
| sessions | Dexie | practice completion | dashboard analytics, streaks | a practice session happened | EchoType | keep for history/analytics | low | KEEP (demote to analytics, not ability) |
| weakSpots | Dexie | chat-analysis, practice | review surfaces | "user is weak at X" | EchoType heuristics | evidence projection | high — heuristic vs evidence | DEMOTE pending projection parity |
| pronunciationProgress | Dexie | pronunciation studio | pronunciation page | per-sound practice progress | EchoType | calibrated acoustic EvidenceEvents (Wave 3 contract) | medium — mutable per-sound row must not become future acoustic authority | DEMOTE as ability authority; KEEP/ADAPT only as practice/diagnostic history |
| dailyTasks | Dexie | daily-task-planner | task queue UI | today's plan | EchoType planner | planner reading evidence projection | medium — planner not evidence-driven | ADAPT |
| learningUnits / lessons | Dexie | reconcileLearningUnits (derived index) | learn pages | content → unit/lesson index | derived | derived | none — rebuilt atomically | KEEP (derived, disposable — pruned/rebuilt) |
| contents / books / collections | Dexie | import, seed | all surfaces | material corpus | store-of-record | same | low | KEEP |
| favorites / favoriteFolders (content metadata) | Dexie | user actions (save, move, folder CRUD) | favorites surfaces, selection popup | saved learner item/context/translation/notes | store-of-record | same | low | KEEP |
| favorites.fsrsCard / nextReview | Dexie (fields on favorites rows) | favorite-store.gradeReview() + add/init | favorites review, due calculation, daily-task-planner (reads fsrsCard.last_review as review evidence) | memory scheduling state only | FSRS | FSRS memory scheduler | medium — due-ness must never imply capability mastery | KEEP — scheduling only |
| journals | Dexie | journal flows | journal page | learner notes | store-of-record | same | low | KEEP |
| conversations | Dexie | chat flows | chat history | speak/chat history | store-of-record | same | low | KEEP |
| lookupHistory | Dexie | word lookup | dictionary suggestions | lookups happened | store-of-record | same | low | KEEP |
| translationCache / alignmentCache / mediaBlobs | Dexie | import/TTS | reuse | cached derived blobs | cache | cache | none — disposable | KEEP |
| importJobs / importDrafts | Dexie | import pipeline | import resume | durable import state | pipeline | same | low | KEEP |
| syncConflicts / syncEntityState | Dexie | sync engine | sync diagnostics | sync bookkeeping | sync engine | same | low | KEEP |
| assessment (CEFR level) | assessment-store (localStorage) | assessment flow | dashboard reminder, speak | "user is CEFR level X" | self-report + AI eval | capability projection | high — AI score ≠ certified level | DEMOTE to advisory label |
| daily-plan / goals / streak | localStorage stores | goal dialogs, planner | dashboard | plan/goal prefs | prefs | prefs | low | KEEP |
| language / tts / provider / shortcuts / appearance / practice-translation / shadow-reading / read-aloud / speak / wordbook / book / chat / sync / updater / collection / preset-tags | localStorage | their settings UIs | consumers | user prefs | prefs | prefs | low | KEEP |

## Doctrine violations found

1. `weakSpots` heuristic feed surfaces "weakness" claims not backed by the
   evidence log → DEMOTE (projection must become the authority).
2. CEFR `currentLevel` (AI/self-report) is displayed as ability → DEMOTE to
   advisory; do not wire into gating.
3. `dailyTasks` planner consumes `records`/session heuristics, not the
   projection → ADAPT (bounded: planner already reads evidence for Next For
   You; legacy task kinds keep working meanwhile).
4. `accuracy` in `sessions`/`records` feeds dashboard "avgAccuracy" — display
   only, must not become proficiency → KEEP with display-only note.
5. `favorites.fsrsCard/nextReview` was previously folded into the favorites
   KEEP row; it is now split out as memory-scheduling substate — due-ness is
   never a mastery claim.
6. `pronunciationProgress` demoted from "ADAPT — practice cache" to DEMOTE as
   ability authority: independent pronunciation claims must arrive through
   explicit acoustic EvidenceEvents, not this mutable per-sound row.
7. `learningAttempts` stays a rich learner-artifact/history table; embedded
   self/AI feedback inside an attempt must not promote capability state —
   semantic outcomes only mint EvidenceEvents through the bridge.

No deletions executed in this mission — dispositions are audit output only.

## Wave-2 migration ownership (W2-01 / W2-G01)

Per-state migration owner nodes (see `W2_MIGRATION_DAG.json`; inventory +
guardrail manifest in `W2_AUTHORITY_CLAIM_INVENTORY.md` and
`src/lib/authority-guardrails/`):

| STATE | MIGRATION OWNER | READ-SITE GUARDRAIL |
|---|---|---|
| evidenceEvents | W2-AT1 (write path), W2-VR1 (replay verify) | kernel-only by construction |
| learningAttempts | W2-AT1 | manifest family `learningAttempts` |
| records (FSRS fields) | W2-MB1 | `records` + `fsrs` |
| records (accuracy/attempts/mistakes) | W2-AT1 (writers) / W2-CS1 (consumers) | `records` |
| sessions | W2-AT1 (writers) / W2-CS1 (consumers) | `sessions` |
| weakSpots | W2-WS2 | `weakSpots` |
| pronunciationProgress | W2-PR1 | `pronunciationProgress` |
| dailyTasks | W2-PL1 | `dailyTasks` |
| dailyPlan (zustand task cache) | W2-PL1 | `dailyPlan` |
| assessment.currentLevel | W2-AS1 (relabel + boundary), W2-G03 (contract) | `assessment.currentLevel` |
| sync transport (mapper/engine/backup) | W2-SY1 | per-family transport entries |

Guardrail contract (W2-01R2, site-level, multiplicity-safe): the manifest
freezes the sensitive-read baseline as an *occurrence multiset* — every
normalized sensitive line in production code is claimed by manifest sites with
counts preserved; any added/removed/edited/duplicated sensitive line fails
`src/lib/authority-guardrails/guardrail.test.ts` until a human re-classifies
it. `CAPABILITY_CLAIM` sites must name a DAG owner; `AMBIGUOUS` is forbidden.
Inventoried claims today: `daily-plan.ts` accuracy→weakness heuristic (W2-PL1),
`chat-analytics.ts` accuracy→"weaknesses" tutor context (W2-CS1),
`lesson-workshop.tsx` `resolved`+`canResolveTransfer` recovery claim (W2-WS2).
Two `currentLevel` planner inputs are flagged transitional (W2-AS1/W2-PL1).
