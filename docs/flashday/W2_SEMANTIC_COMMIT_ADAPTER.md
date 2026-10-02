# W2-02 — Semantic Commit Adapter (W2-G02 + W2-AT1)

Mission class: first Wave-2 runtime semantic migration.
Base: `main @ eb4456c` (post-W2-01R2 merge).
Status: **seam implemented; pilot returns BLOCKED — contract coverage prerequisite.**

## Verdict on contract coverage

The vendored kernel registers only the seven mission curricula
(`meet_new_person`, `order_drink`, `meet_at_time`, `complete_order`,
`buy_item`, `find_place`, `self_family`). Every registered task is a
mission-scoped communicative contract — modalities `spoken_production`,
`spoken_interaction`, `listening`; response shapes `spoken_turn`,
`partner_turn`, `choice`, `audio_line`, `dialogue`, `cued_prompt`, `none`;
evaluators score communicative `requiredFunctions`.

Correction (W2-02R review): the capability *graph* also declares
reading/writing constructs — `reception.read.simple_sign_or_menu_item`,
`production.write.personal_info_short` — but `fixtures.js` registers no
TaskContract bound to them. They therefore provide no legal bridge mapping;
the zero-coverage verdict is unchanged.

No registered contract covers any EchoType legacy action shape. Per §7, a
mapping is MAPPED_SAFE only when the construct, capability, modality, purpose,
response shape, and evaluator all honestly match — similarity is not enough.
Therefore **zero actions are MAPPED_SAFE** and no events are minted. The audit
is enforced by `LEGACY_CONTRACT_AUDIT` in `src/lib/evidence-bridge/adapter.ts`
and tested in `semantic-commit.test.ts`.

## Mapping matrix

| Legacy action | Registered contract | Status | Gap for W2-03 |
|---|---|---|---|
| vocabulary `meaning` | none | BLOCKED_PENDING_W2_03 | vocabulary-retrieval contract (self-rated recall authority) |
| vocabulary `spelling` | none | BLOCKED_PENDING_W2_03 | typed orthographic-production contract (no typed response shape exists) |
| vocabulary `dictation` | none | BLOCKED_PENDING_W2_03 | dictation contract + orthographic evaluator |
| vocabulary `application` | none | BLOCKED_PENDING_W2_03 | fresh-context transfer contract for word usage; `validateVocabularyApplication` is a heuristic, not an evaluator |
| vocabulary `construction` | none | BLOCKED_PENDING_W2_03 | morphology-assembly contract |
| learningAttempt `comprehension` | none | BLOCKED_PENDING_W2_03 | text-comprehension contract |
| learningAttempt `writing` | none | BLOCKED_PENDING_W2_03 | free-production contract outside mission scope |
| learningAttempt `retelling` | none | BLOCKED_PENDING_W2_03 | retelling contract + evaluator |
| learningAttempt `personal-example` | none | BLOCKED_PENDING_W2_03 | personal-example production contract |
| learningAttempt `sentence-pronunciation` | none | BLOCKED_PENDING_W2_03 | pronunciation contract; pronunciation scoring is not a communicative-function evaluator |
| text-cycle `understand` | none | BLOCKED_PENDING_W2_03 | exposure/comprehension observation contract |
| text-cycle `output` | none | BLOCKED_PENDING_W2_03 | supported-production contract w/ honest support provenance |
| text-cycle `correct` | none | BLOCKED_PENDING_W2_03 | correction-episode contract binding |
| text-cycle `recall` | none | BLOCKED_PENDING_W2_03 | registered `delayed_retrieval` contract (cycle rating is not kernel authority, §18) |
| text-cycle `apply` | none | BLOCKED_PENDING_W2_03 | fresh-context transfer contract (looks transfer-like ≠ transfer, §18) |

Bookkeeping rows (`sessions`, `records`/FSRS fields, `dailyTasks` lifecycle,
`mediaBlobs`) are not learner actions — they remain history/scheduler state
under the W2-01 inventory and are not candidates for minting.

## Identity contract (W2-02R)

`currentLearnerId()` in `src/lib/db.ts` returns `activeUserId` or a
**persistent unique local subject** `local.<uuid>` — generated once, stored
in `localStorage` (browser) / a process-local store elsewhere, stable across
reloads, never derived from mutable session/display state, never rewritten.
The same function now backs `mission/page.tsx` (previously an inline
`'local.anonymous'` constant — a named constant is not a unique subject and
two anonymous installs would collide).

Events are stored in the per-account database (`echotype:user:<id>` /
`echotype:anonymous`), so a stamped `learnerId` is stable for that store and
**immutable after commit**. An anonymous→authenticated transition swaps
databases (`switchDatabaseForUser`); existing events are never rewritten and
the anonymous subject stays `local.<uuid>` on return — association is a
W2-09/VR1 replay concern, not a mutation.

## Event identity

Deterministic: `evt.<immutable submission/attempt id>`. Retried submissions
redeliver the identical event → dedupe; same id with different content →
fail-closed conflict (no last-write-wins). Idempotent retry is therefore a
property of identity, not of bookkeeping.

## Atomicity

The semantic seam owns the mapped transaction: `mapLegacyAttempt` resolves
the audit-gated mapping outside the transaction, then
`runSemanticCommit({ database, tables, historyTable, mapped, learnerId,
writeHistory, verify })` opens the single Dexie transaction itself —
every caller-declared history table plus `evidenceEvents` plus the
canonical `historyTable`. Unmapped actions keep the exact legacy
transaction shape — zero behavioral change while every audit entry is
unmapped.

W2-02R2 — the coupling is **structural**: the event append primitive
(`appendMappedEvent`) is module-private and the only export is the
transaction-owning coordinator.

W2-02R3 — the seam does **not** trust `writeHistory`'s return value (a
callback's `return true` is a claim, not evidence). Inside the transaction
the seam reads the canonical history row `historyTable.get(mapped.attemptId)`
BEFORE and AFTER `writeHistory()`:

- row absent before + matching row present after → append the event
- row present before → never mint (retry or pre-cutover; no event repair)
- row absent before + absent after → throw; the whole transaction rolls
  back — a lying or empty `writeHistory` cannot mint

The verified id is `mapped.attemptId` — seam-derived, so a caller cannot
satisfy the proof with a row under a different key. `verify` runs
post-append in the same transaction (account-switch guard) and still runs
on the pre-existing-history path. Defense-in-depth invariants remain: the
append asserts `Dexie.currentTransaction` and `evidenceEvents`
participation. Native mission surfaces keep standalone `submitAttempt`.

| Path | Transaction tables (mapped case) |
|---|---|
| `saveVocabularySubmission` | contents, records, sessions, learningAttempts, dailyTasks, **evidenceEvents** |
| `persistLearningAttempt` | learningAttempts, mediaBlobs, **evidenceEvents** |

Remote sync is outside the semantic transaction (F3): no sync call was added;
`evidenceEvents` is not in `SYNC_TABLES` (W2-SY1 owns that).

## Failure matrix

| Case | Behavior | Proof |
|---|---|---|
| F1 — event append fails inside tx (conflict) | all legacy writes roll back | `semantic-commit.test.ts` mechanism + real-path tests |
| F2 — legacy write fails inside tx | the event rolls back | mechanism test (forced legacy failure) |
| F3 — remote/sync failure after commit | irrelevant — local commit already durable; nothing calls sync | by construction; no sync in the seam |
| Duplicate submit | `learningAttempts.get(id)` early-return → seam sees the row → no mint; identical event → dedupe | wired-path test |
| Same attempt id, divergent content | history row already exists → seam never appends; original event stays immutable | redelivery immutability test |
| Account switch mid-tx | `database !== db` / `isCurrent()` guards roll back history AND event | guard runs after the commit call |
| Event-only commit | inexpressible — append primitive is module-private; `runSemanticCommit` mechanically verifies a new `historyTable[mapped.attemptId]` row materialized inside the transaction | escape-hatch + lying-callback + empty-tables + wrong-id tests (W2-02R2/R3) |
| `writeHistory` claims success but writes nothing | seam reads the row itself → throw → full rollback | lying-callback regression (R3-A/B) |
| `writeHistory` writes a row under a different id | `get(mapped.attemptId)` still absent → throw → rollback | wrong-id regression (R3-C) |
| Pre-existing history row (retry/pre-cutover) | seam sees row before the write → never mints (no event repair) | pre-cutover regression (R3-E) |
| Post-append `verify` throws | history AND event roll back | post-append verify regression (R3-G) |
| `MAPPED_SAFE` w/o provenance mapper | `mapLegacyAttempt` throws | mapper-contract tests |
| Mapper drops declared support fact | `mapLegacyAttempt` throws `dropped support provenance` | laundering-guard test |
| Unmapped action | history persists, zero EvidenceEvents | production-path test |

## Forward-only cutover

No discriminator column is needed: events are minted only inside the live
submission transaction, and the seam itself reads the canonical row before
`writeHistory` — a row that predates the adapter is seen as existing and
can never gain an event (W2-02R3; no event repair). No read path mints
either (§10, §12, §27: no upgrade/hydration/sync backfill).

## MAPPED_SAFE is a mapper contract, not a flag (W2-02R)

An audit entry is activatable only with an action-specific provenance
`map(action) → ObservedAttempt`. The mapper authors observed reality only
(`response`, `support`, `feedback`, `occurredAt`, `evaluationCtx`); event
identity (`id`/`attemptId`) and `taskId` stay adapter-owned, and capability,
purpose, transfer, freshness, and evaluation authority remain
contract-derived inside the bridge.

Two fail-closed guards make the seam honest:

- `MAPPED_SAFE` with no `map` → `mapLegacyAttempt` throws (a bare
  `{status, taskId}` entry cannot mint).
- Every support fact declared true on the action (`revealed`,
  `translation`, `assisted`, `sourceRevealed`) must survive into the mapped
  submission verbatim; a mapper that drops one throws
  `dropped support provenance` — an assisted recall can never mint as
  independent evidence.

### W2-03 unblock condition (reframed)

Activating an action requires **all** of: a registered `TaskContract` whose
capability/modality/purpose honestly matches the action, an honest
evaluator, a complete action-specific provenance mapper, and mapping
regression tests. Anything less remains `BLOCKED_PENDING_W2_03`.

## What W2-02 did NOT do

No planner/consumer migration, no FSRS semantics change, no placement change,
no event sync, no historical backfill, no legacy writer freeze, no projection
changes, no new capability semantics — and no fabricated task contracts.

## Files

- `src/lib/evidence-bridge/adapter.ts` — audit table + `mapLegacyAttempt` +
  `runSemanticCommit` (the single adapter surface; `appendMappedEvent` is
  module-private)
- `src/lib/db.ts` — `currentLearnerId()` (persistent `local.<uuid>` subject)
- `src/app/(app)/mission/page.tsx` — mission path shares `currentLearnerId()`
- `src/lib/vocabulary-repository.ts` — tx list + seam call
- `src/lib/learning-activity-persistence.ts` — tx list + seam call, widened
  `evidenceEvents?` signature (narrow test DBs unchanged; a mapped action on a
  DB without the table fails closed)
- `src/lib/evidence-bridge/semantic-commit.test.ts` — audit, mechanism F1/F2,
  identity, dedupe/conflict, wired-path proofs
- `src/lib/authority-guardrails/legacy-claim-sites.json` — reclassified the
  seam's sensitive occurrences (new `learningAttempts-semantic-seam` site;
  vocabulary tx-list lines updated per family)
