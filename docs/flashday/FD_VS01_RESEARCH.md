# FD-VS01-R — Recall → Production → Transfer Vertical Slice Research

**Mission:** FD-VS01-R (research only — no implementation, no merge)
**Branch:** `flashday/fd-vs01-r-slice-research`
**Base:** `0b8d17defe1cd2f4f6d7d45a33a4b3cfa456800e` (main, post-PR #12)
**Question:** can FlashDay help one real learner encounter useful English,
understand it, recall it later, produce it independently, and use it in a
changed context — and can we measure what failed?
**Method:** traced the executable path only. Nothing below is inferred from
docs or plans; every claim cites the code that runs.

## A. Current executable flow (what a learner can actually do today)

Entry: the **dashboard** renders `TodayWorkspace` → `DailyTaskQueue`
(`src/app/(app)/dashboard/page.tsx:408`,
`src/components/learning/today-workspace.tsx:6`,
`src/components/learning/daily-task-queue.tsx:130`). The queue calls
`buildTextCourseTasks(lessons, attempts, now)`
(`src/lib/text-daily-tasks.ts:57`), which derives the next stage per lesson
via `deriveTextCycle` and emits a deep-link task
`href: /learn/<unitId>?lesson=<id>&stage=<stage>` with EN/ZH/VI labels —
including a `recall` task carrying `dueAt` when a delayed recall is
scheduled (`text-daily-tasks.ts:71,107`). The same queue appears on
`/review` (`src/app/(app)/review/page.tsx:52`).

The learner lands on `/learn/<unitId>`
(`src/app/(app)/learn/[unitId]/page.tsx`), which builds lessons from
persisted `contents` records via `src/lib/learning-units.ts` (deterministic
lesson ids, exercises split by sentence/paragraph). `LessonWorkshop`
(`src/components/learning/lesson-workshop.tsx`) hosts the loop and reads
`?stage=` from the URL (`lesson-workshop.tsx:36-38`):

1. **Understand** — `comprehension` activity: learner explains the main
   idea and must quote a verbatim substring of the source
   (`validateLearningResponse`, `src/lib/learning-activity.ts:49`).
   Translation overlay + TTS available; use is tracked via
   `usedTranslation`.
2. **Output** — `writing` activity: a free original response; the cycle
   only counts it if it is not a copy of the source
   (`text-learning-cycle.ts:82`).
3. **Correct** — a genuine revision of the output (different answer,
   improvement note; `validateTextCorrection`,
   `text-learning-cycle.ts:23-40`). The revision starts the delay clock.
4. **Recall** — `TextCyclePractice` stage `recall`
   (`src/components/learning/text-cycle-practice.tsx`): source hidden,
   learner writes from memory, self-compares, self-rates
   again/hard/good/easy. `cycle.assisted`/`sourceRevealed`/`usedTranslation`
   are recorded; an assisted recall saves but does not count as success
   (`text-learning-cycle.ts:123-125`). First gate is exactly **24h** after
   the correction (`TEXT_CYCLE_INITIAL_DELAY = 86_400_000`,
   `text-learning-cycle.ts:3,96`), and `validateTextCycleAttempt` rejects
   early saves with `'not-due'` (`text-learning-cycle.ts:209`).
5. **Apply** — `TextCyclePractice` stage `apply`
   (`personal-example` activity): learner supplies `expression`,
   `context`, `answer`; `transferError`
   (`text-learning-cycle.ts:42-52`) requires the expression to be a
   verbatim substring of the source AND of the answer, the described
   context to NOT be a substring of the source, and the answer to not be
   a copy of the source. Only reachable after a successful unassisted
   recall (`text-learning-cycle.ts:213-215`).

Persistence: every stage appends an immutable `LearningAttempt` via
`persistLearningAttempt`
(`src/lib/learning-activity-persistence.ts`) into Dexie table
`learningAttempts`; revisions append via `parentAttemptId`, never mutate.
All cycle state is replay-derived by `deriveTextCycle`
(`text-learning-cycle.ts:55-179`) — no mutable progress row exists.

Scheduling: two systems coexist. The text cycle has its own delay ladder
inside `deriveTextCycle` (24h base, rating-scaled, capped at 90 days,
10-min retry after failed/assisted recall — `text-learning-cycle.ts:129-144`).
FSRS (`ts-fsrs`) drives `records`/`favorites`/`vocabulary`-item review
via `gradeCard` in `src/lib/daily-plan-progress.ts` and surfaces on
`/review/today`. FSRS is item-memory scheduling only.

Evidence authority: `mapLegacyAttempt`
(`src/lib/evidence-bridge/adapter.ts`) returns `null` for every
inventoried legacy action — all workshop/cycle attempts are **persisted
history, not kernel capability evidence**. `/mission`
(`src/app/(app)/mission/page.tsx:110`) is the only kernel-driving
surface, and it runs on `fixtureRegistry()`
(`src/lib/evidence-bridge/registry.ts:63-69`): vendored curriculum
fixtures, not learner content. No path registers real content as kernel
tasks.

Capture: text selection in readers offers translate + save-to-favorites
(`src/components/selection-translation/selection-translation-popup.tsx` —
`favorites` table rows carry `type: word|phrase|sentence`,
`sourceContentId`, `context`, own `fsrsCard`/`nextReview`;
`src/types/favorite.ts`). `lookupHistory` + `auto-collect`
(`src/lib/auto-collect.ts`) promote repeatedly-looked-up items. Weak spots
(`src/lib/weak-spots.ts`) are machine-detected errors with `targetHref`
back into practice; `/weak-spots` lists them and
`canResolveTransfer` (`learning-activity.ts:137-149`) requires a genuine
revision plus a later `personal-example` to resolve one.

Other modes: `/write/[id]` is visible-text copy-typing (not retrieval);
`word-book-practice` (`src/components/shared/word-book-practice.tsx:469+`)
is **hidden-answer cued exact typing** for `ContentItem`s — for
`type==='word'` the learner sees `item.text` (a prompt/definition) and
must type `item.title` (`src/lib/wordbook-write-target.ts:9-21`), with
normalized exact-match validation and a persisted `write` session on
success; hosted at `/learn/[unitId]` (wordbook units), `/review/today`,
`/write/book/[bookId]`. `/speak/[scenarioId]` is AI conversation —
no target-bound evaluator. `FavoritesReview`
(`src/components/favorites/favorites-review.tsx`) is reveal → self-grade
→ FSRS; recognition only, no typed production.

Auth/cloud: optional. `currentLearnerId()` (`src/lib/db.ts:773-785`)
falls back to a stable device-local `local.<uuid>`; the sync engine only
activates for authenticated users (`src/lib/sync/engine.ts`). **Nothing in
the slice requires sign-in or network beyond optional translation/AI
endpoints.**

## B. Reuse matrix

| Stage | Verdict | Executable implementation |
|---|---|---|
| 1. Encounter | **READY** | `/learn/[unitId]` lesson over a `contents` record; `ReadAloudContent` + TTS + `TranslationBar` in `lesson-workshop.tsx`. Lesson ids deterministic (`learning-units.ts`). |
| 2. Understand / minimal explanation | **READY** | `comprehension` attempt with verbatim `evidenceQuote` gate (`learning-activity.ts:49`); translation/lookup support tracked (`usedTranslation`, `lookupHistory`, favorites capture). Learner-facing, persisted. |
| 3. Immediate retrieval | **PARTIAL** | `word-book-practice` already does hidden-answer cued recall with normalized exact-match and persists a session on success — for `word`-type `ContentItem`s (hosted in `/learn` wordbook units, `/review/today`, `/write/book/[bookId]`). A target chunk authored as `title`=chunk / `text`=VN cue rides it with **zero code**. Caveat: failed submissions are local UI state only (`word-book-practice.tsx:424-426`) — failure is not persisted. Favorites review is reveal+self-grade (recognition) — insufficient alone per spec. |
| 4. Production | **READY** | `writing` output attempt, non-copy enforced by cycle (`text-learning-cycle.ts:82`); `personal-example` is the chunk-targeted variant. Evaluation is honest: self-review + advisory AI feedback (`/api/learning/feedback` is explicitly non-scoring, no audio, no CEFR). No deterministic chunk-in-production grader exists — dogfood grades by the deterministic validators + human review. |
| 5. Delayed recall (~24h) | **READY** (lesson-scoped) | `recall` stage: hard `>= correction+24h` gate enforced at save (`validateTextCycleAttempt` 'not-due'), assist tracking, resurfaced to the learner as a daily task with `dueAt`. Kernel `retention.minLagMs = 24h` exists too but only on the fixture mission path. Per-chunk delayed recall is **PARTIAL**: FSRS `nextReview` on chunk items gives scheduling, but the recall surface itself is the word-book typing component (works) — the honest "~24h" claim comes from the telemetry timestamp, not the scheduler. |
| 6. Transfer | **READY** | `apply` stage validators (`transferError`, `text-learning-cycle.ts:42-52`): expression ⊆ source ∩ answer; context ⊄ source; answer ⊄ source. `cycle.expression` on the persisted attempt binds the attempt to the chunk. Weakest link: context-change depth is enforced only as "not a substring of source"; sufficiency for the pilot must be defined in the fixture (Section D). |
| 7. Outcome capture | **PARTIAL** | `learningAttempts` (append-only, validated, carries `cycle.expression/context/rating/assisted`) + `deriveTextCycle` replay + `sessions`/`records` give enough to reconstruct every stage. Missing: a single per-target inspectable record (telemetry is scattered across attempts/sessions) and persistence of failed immediate-recall submissions. `mapLegacyAttempt → null`: all of this is history-only — correct for a pilot, must not be silently upgraded to mastery evidence. |

## C. Proposed single source

**Builtin seed article "My Morning Routine"**
(`src/lib/seed-data/articles.ts` — `type: 'article'`, `difficulty:
'beginner'`, `category: 'daily'`).

Why this source:
- Lowest cost: already executable — seeded into `contents`, becomes a
  lesson via `learning-units.ts`, zero importer work.
- Real English context: a coherent 8-sentence daily-routine narrative,
  not isolated items.
- Reproducible: fixed seed, byte-identical on every install — the
  pilot is re-runnable and tests can hard-reference it.
- Chunk density: everyday A1 patterns a learner plausibly reuses
  ("wake up at…", "have X with Y", "on the way", "feel ready to…").
- Understandability: beginner-level text; translation overlay exists for
  support when needed.

Rejected alternatives: YouTube/PDF/URL import paths (executor cost,
reproducibility), community scenarios (conversation-shaped, not
chunk-source), kernel fixtures (no real content registry).

## D. Proposed target chunks

From "My Morning Routine". Each target is a pattern/chunk, not a bare
word. `→` marks the variable slot.

| # | Source sentence | Target chunk | VN meaning (cue) | Why useful | Successful recall | Successful production | Transfer context |
|---|---|---|---|---|---|---|---|
| T1 | "Every morning, I wake up at seven o'clock." | `wake up at <time>` | thức dậy lúc ~ | Core daily-routine frame, infinite slot values | Type the chunk given VN cue + "seven o'clock" context | Free sentence using own wake time, no source visible | Weekend/travel context ("wake up at noon on Sundays") |
| T2 | "I usually have toast with butter and a glass of orange juice." | `have <food> with <thing>` | ăn/uống X kèm Y | Productive frame for meals/drinks | Type chunk given VN cue | New meal sentence with different foods | Drinks/people slots ("have coffee with a friend") — tests whether slot is understood as accompaniment, not just food |
| T3 | "I like to leave the house early so I can walk slowly…" | `leave the house <adv>` | rời nhà ~ | Fixed collocation, common learner error (*leave from house) | Type chunk given VN cue | Own sentence about leaving | Different subjects/purposes ("she left the house without her keys") |
| T4 | "On the way, I sometimes see my neighbors walking their dogs." | `on the way (<to~>)` | trên đường (đi đâu) | Discourse connector, high reuse | Type chunk given VN cue | Sentence about own commute | Non-commute use ("on the way to becoming a teacher") — figurative slot |
| T5 | "I feel ready to start a new day of learning." | `feel ready to <verb>` | cảm thấy sẵn sàng để ~ | Evaluative frame before any activity | Type chunk given VN cue | Own readiness statement | Different activity registers ("feel ready to give the presentation") |

5 targets, all present verbatim in one article. If a chunk proves bad in
dogfood (ambiguous cue, no natural transfer context), the constraint for
replacement is: **verbatim substring of the source article, 2–5 words,
one open slot, a plausible non-source transfer context**.

## E. Exact vertical loop (screen by screen)

Day 1 (~15–20 min):

1. **Encounter** — Dashboard task "Understand the source" →
   `/learn/<unitId>?lesson=<id>` opens the article lesson. Learner
   reads/listens (ReadAloudContent + TTS). *System records: lesson
   exercises → `sourceText`.*
2. **Notice + Understand** — Learner writes `comprehension` answer with a
   verbatim `evidenceQuote`. If needed, translation overlay (tracked as
   `usedTranslation`). *Record: `learningAttempts` row, activity
   `comprehension`.* Per-target: the 5 chunks are the pilot fixture —
   the learner confirms each VN cue is understood (supportUsed noted).
3. **Immediate retrieval** — Chunks live as `word`-type ContentItems
   (`title`=chunk, `text`=VN cue). `WordBookPractice` shows the cue,
   hides the chunk, learner types it; `isWordBookWriteMatch` validates.
   Failure → retry allowed; **needs one small change**: persist the
   failed submission so telemetry sees it (today it is local state).
   *Record: `sessions` row (module `write`, contentId = targetId).*
4. **Production** — `output`/`correct`: learner writes an original
   response and then a genuine revision (validators force non-copy and a
   real change). Production quality for the target chunks is additionally
   checked by the human dogfooder: did they use a target chunk unprompted?
   *Record: `learningAttempts` rows + revision chain; correction sets
   `dueAt = +24h`.*

Day 2 (~10 min):

5. **Delayed recall** — Dashboard surfaces "Recall without the source"
   (`dueAt` reached). Learner writes recall from memory, compares,
   self-rates. Assist flags are recorded; assisted ≠ success. Per-chunk:
   re-run `WordBookPractice` on the 5 items via `/review/today` (FSRS
   `due`) — the session timestamp is the honest `delayedAttemptAt`.
   *Record: recall attempt + chunk sessions.*
6. **Transfer** — `apply` stage: pick `expression` (a target chunk),
   describe a different situation, write the new example. Validators
   enforce chunk-presence + changed-context + non-copy.
   *Record: `personal-example` attempt with `cycle.expression/context`.*

Day 3:

7. **Outcome** — remaining due recalls/transfers finish; the pilot reads
   the derived per-target record (Section F) and labels each target
   UNDERSTOOD / RECALLED / PRODUCED / TRANSFERRED with a failureReason.

## F. Minimal persisted experiment record

No new table. One derived record per target, computed by a small pure
function over existing persistence (written alongside the slice or even
by a script — inspectable, replay-derived):

```ts
interface Vs01TargetRecord {
  targetId: string;            // contentId of the chunk item
  chunk: string;               // e.g. "wake up at <time>"
  sourceId: string;            // article contentId
  sourceSentence: string;
  encounteredAt: number;       // comprehension attempt createdAt (or first view session)
  initiallyUnderstood: boolean;
  supportUsed: string[];       // 'translation' | 'hint' | 'dictionary-lookup' | 'ai-feedback'
  immediateRecallOutcome: 'pass' | 'fail' | 'assisted' | 'skipped';
  productionOutcome: 'used-unprompted' | 'absent' | 'invalid' | 'n/a';
  delayedAttemptAt?: number;   // must be >= encounteredAt + ~20h to count as delayed
  delayedRecallOutcome?: 'pass' | 'fail' | 'assisted';
  transferPromptId?: string;   // apply attempt id
  transferOutcome?: 'pass' | 'fail';
  failureReason?: string;      // taxonomy, Section G
  notes?: string;
}
```

Sources: `learningAttempts` (stages 2/4/5/6, incl. `cycle.*`,
`usedTranslation`), `sessions`+`records` (stages 3/5 per chunk —
`contentId` is the targetId), `lookupHistory` (supportUsed). This is
exactly the spec's sketch, mapped onto tables that already exist.

## G. Failure taxonomy (operational, 8)

1. `DID_NOT_UNDERSTAND_SOURCE` — no valid comprehension attempt, or
   comprehension only after heavy translation support.
2. `EXPLANATION_INSUFFICIENT` — understood with support but immediate
   recall still failed; the cue/explanation did not stick.
3. `IMMEDIATE_RECALL_FAILED` — typed recall wrong at stage 3 (needs the
   failure-persistence change to be visible).
4. `RECALLED_WITH_SUPPORT` — delayed recall completed but
   `assisted`/`sourceRevealed`/`usedTranslation`.
5. `DELAYED_RECALL_FAILED` — rating `again`, or wrong typed recall at
   ≥ ~20h.
6. `PRODUCTION_FAILED` — no unprompted target-chunk use in output/correct,
   or `apply` rejected by `transferError` ('expression'/'new-answer').
7. `TRANSFER_CONTEXT_TOO_CLOSE` — validators pass but the described
   situation is a trivial reskin of the source (human judgment — the
   honest gap in the current validators).
8. `EVALUATION_UNTRUSTWORTHY` — self-report looks inflated
   (e.g. rated 'easy' while assisted flag absent but compare-behavior
   suggests otherwise); mark and exclude rather than fix the data.

## H. Current blockers (slice-scoped only)

1. **Failed immediate recall is invisible** — `word-book-practice`
   drops wrong submissions client-side. One ~15-line change: persist a
   `completed:false` session (or equivalent record) on failure.
2. **No per-target roll-up** — stage evidence is in three tables;
   readable but manual. Solved by the derived record (F) — a pure
   function, not a platform.
3. **Chunk capture is manual** — the pilot's 5 chunks are a fixed fixture
   (authored content items), not extracted at runtime. Acceptable: the
   spec caps scope at 3–5 fixed targets.
4. **Transfer depth is partially human-judged** — substring validators
   enforce mechanics, not semantic novelty. Pilot defines "changed
   context" per target in advance (Section D column 8) — honest
   constraint, not a code gap for a 1-learner pilot.
5. **No learner-facing prompt forcing production of the chunk** —
   `writing` asks for an original response, not "use this chunk".
   Whether unprompted use happens is itself a dogfood observation; if it
   never happens, the apply stage's explicit `expression` field is the
   fallback production-with-binding path.

## I. Parked architecture assessment (PR #13, frozen @ `ee3edfd`)

| Construct | Commit | Verdict | Why |
|---|---|---|---|
| `verified_consecutive_failure` | `7ecfe3f` | **NOT_NEEDED_YET** | The pilot's failure signal is per-target and directly observed (session results, cycle ratings, transfer validators). A streak artifact answers "how often did a capability fail" — there is no capability dimension in a 5-chunk slice. |
| `support_dependency` | `5a66dff` | **NOT_NEEDED_YET** | Support use is captured verbatim (`supportUsed[]`, `usedTranslation`, `cycle.assisted`). Dependency inference (demand ∩ unresolved gaps) matters when a planner acts on it — no planner consumes it on this path. |
| `selection_decision_provenance` | `89b60c1` | **NOT_NEEDED_YET** | No selector runs on the slice path: the loop is self-driven via daily tasks + deterministic stage gating. There is no decision to audit. |

None of the three is cherry-picked; the slice does not touch
`src/vnext/**`.

## J. Proposed implementation diff (design only — not code)

Smallest honest delta, reusing existing paths:

1. **`src/lib/seed-data/` (or a dogfood fixture module)** — 5 `word`-type
   `ContentItem`s (title = chunk, text = VN cue + source sentence) +
   the chosen article pinned as the pilot source. Content-only change.
2. **`src/components/shared/word-book-practice.tsx`** — persist failed
   submissions (session with `completed:false`, accuracy 0) instead of
   dropping them; ~15 lines + test. Unblocks telemetry stage 3/5.
3. **`src/lib/vs01-telemetry.ts` (new, pure)** — folds
   `learningAttempts` + `sessions` + `records` into `Vs01TargetRecord[]`;
   unit-tested against fixture attempts. No table, no writes — or at
   most a JSON export for the dogfooder.
4. **`src/components/learning/` or daily-task plumbing** — *optional*:
   nothing needed if the dogfooder navigates manually; a per-chunk
   "recall due" surfacing already exists via FSRS `nextReview` →
   `/review/today`.
5. **Test pins** — `text-learning-cycle` already has tests; add pins for
   the new failure-persistence path and the telemetry derivation only.

Estimated runtime files changed: **2–3** (word-book-practice, fixture,
telemetry reader). New subsystems: **0**. New persisted entities: **0**
(reuses `contents`, `learningAttempts`, `sessions`, `records`).

## K. Explicitly deferred

- Kernel evidence for slice outcomes (`mapLegacyAttempt` stays null —
  self-report + validators are honest dogfood telemetry, not mastery).
- PC1 cherry-picks (all NOT_NEEDED_YET — Section I).
- Chunk-level delayed scheduling tied to the 24h gate (per-chunk timing
  is measured, not enforced; lesson-level gate is enforced).
- Any LLM/ASR evaluator for production/transfer.
- Per-chunk UI inside the lesson (chunks live as separate wordbook items).
- Auth, cloud sync, multi-learner anything.
- Dashboard/telemetry UI — the record is inspected via devtools/JSON.
- Favorites/wordbook data-model unification.
- Speech path entirely (frozen since Wave 2 gate).
- W2-WS1, W2-PL1, all architecture nodes — paused by spec.
- Gamification, streaks, analytics, marketplaces, social.
