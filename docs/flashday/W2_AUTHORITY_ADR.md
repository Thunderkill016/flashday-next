# W2_AUTHORITY_ADR — State Authority Migration (Architecture Decision Record)

Status: proposed for external review · Mission: W2-00R · Base: `main @ 672b3f3`
Companion artifacts: `W2_MIGRATION_DAG.md` (readable plan), `W2_MIGRATION_DAG.json` (executable graph).

## 1. Decision

Learner-capability authority migrates to the FlashDay evidence kernel:
`evidenceEvents` (append-only) → `projectLearnerState`/`buildLearnerModel` →
planner/mission/surface consumers. EchoType heuristic stores are demoted to
history, analytics, cache, or prefs — **none are deleted in Wave 2**.

FSRS (`records.fsrsCard`, `favorites.fsrsCard`) stays the memory-scheduling
authority permanently. Scheduling is not ability.

## 2. Final domain authorities

| Domain | Authority | Legacy store becomes |
|---|---|---|
| Capability state (NOT_SEEN…FLUENT) | kernel projection | weakSpots / pronunciationProgress / assessment demoted |
| Memory scheduling | FSRS fields | unchanged, scheduling-only reads enforced (W2-MB1) |
| Attempt/artifact history | `learningAttempts`, `sessions` | history; semantic outcomes also mint events (W2-AT1) |
| Next-action selection | kernel `nextAction`/`selectNextTask` | `dailyTasks` = executable cache (planner rows only) |
| Weakness/remediation | correction episodes + support lifecycle | `weakSpots` = candidate signal, raw-synced compat |
| Level estimate | `placement_estimate` observation (contract W2-G03) | `currentLevel` = advisory label |
| Pronunciation capability | acoustic events (Wave 3, OpenPronounce gate) | `pronunciationProgress` = practice history |
| Corpus / prefs / caches / sync bookkeeping | existing stores | unchanged |

## 3. Transaction / failure semantics

`saveVocabularySubmission` already commits
`contents + records + sessions + learningAttempts + dailyTasks` in **one Dexie
transaction** (`vocabulary-repository.ts`); `learning-activity-persistence`
commits `learningAttempts + mediaBlobs` atomically. `db.evidenceEvents` lives
in the same Dexie instance, so it can join those transactions.

**Decision — single local transaction is the semantic commit boundary:**
evaluate → construct event → `db.transaction('rw', [legacy tables,
evidenceEvents])` → remote sync afterwards via the sync engine.

- **F1: legacy write succeeds, event write fails** — impossible by
  construction: one transaction commits or aborts as a unit.
- **F2: event succeeds, legacy write fails** — same answer; atomic.
- **F3: local commit succeeds, remote sync fails** — sync is a mirror, not
  authority. The sync engine retries; semantic truth is the local event log.
  Accepted: capability state is local-first; cross-device parity arrives via
  the W2-SY1 mirror, never via blocking the commit.

Invariant: **semantic truth must not depend on a later best-effort side
write.** If a future write path cannot join one transaction (e.g. a table in
a different DB), the required design is a durable outbox row inside the same
transaction, drained by a background flusher — never a fire-and-forget emit.

## 4. Migration principles

1. Additive or read-path-only steps; dual-write where needed.
2. Consumers migrate before any retirement is even considered.
3. Every step is independently revertible (see rollback doctrine).
4. No capability claim may be manufactured outside the event log.
5. Legacy UI keeps working on history during transition (dual-read).

## 5. Backfill doctrine

**NO SYNTHETIC SEMANTIC BACKFILL BY DEFAULT.** A label like
`source: 'backfill'` does not make an aggregate into evidence.

Per legacy source, classified as one of:

- `NONE` — stays live authority (FSRS scheduling state) or is out of scope.
- `FACT-PRESERVING CANDIDATE` — allowed only when history preserves the raw
  learner response, stable task identity/revision, context, evaluator inputs,
  and required support provenance — enough to re-evaluate against a frozen
  contract. Then: re-evaluate (never copy the old verdict), deterministic id,
  `provenance: 'historical_replay'`, separate external review (W2-BF1).
- `HISTORY ONLY` — aggregates and verdicts that cannot be reconstructed into
  an observation (session completion, `sessions.accuracy`, generic
  `weakSpots` rows, `currentLevel` CEFR label, pronunciation progress
  scores). They stay history/compat/analytics forever and **never mint
  ability EvidenceEvents**.

| Legacy source | Class | Rationale |
|---|---|---|
| `learningAttempts` rows with full `answer`/`prompt`/`cycle` + contract-mappable activity | FACT-PRESERVING CANDIDATE (W2-BF1 gate) | raw response exists; still needs task-revision + contract mapping proof per row |
| `learningAttempts` without evaluatable artifact | HISTORY ONLY | nothing to re-evaluate |
| `sessions` (completion, accuracy, wpm) | HISTORY ONLY | aggregate, no observation |
| `records`/FSRS | NONE | stays live scheduling authority |
| `weakSpots` rows | HISTORY ONLY | heuristic count/resolved, no observation |
| `dailyTasks` rows | HISTORY ONLY | generated cache; not evidence |
| `pronunciationProgress` | HISTORY ONLY | practice score ≠ acoustic observation |
| `assessment.currentLevel` | HISTORY ONLY | label ≠ placement observation contract |
| `favorites`, `journals`, `lookupHistory`, prefs | NONE | outside capability authority entirely |

## 6. Sync doctrine

Sync topology today: mapped tables (contents, records, sessions, favorites,
favoriteFolders, journals) via `sync/mapper`; raw-mirrored (books,
collections, weakSpots, pronunciationProgress, learningAttempts, dailyTasks);
**evidenceEvents is local-only**.

- `evidenceEvents` gains an **append-only Supabase mirror** (W2-SY1):
  immutable events → conflict = dedupe by deterministic id, never merge.
- Local projection is the computation point; the mirror enables multi-device
  replay parity.
- **Stale synced legacy row after writer freeze:** applies as history/
  compatibility — post-freeze no reader may treat it as authority, so it is
  inert for capability state.
- Anonymous → authenticated: events carry `learnerId`; the migration maps the
  anonymous namespace to the authed id at first sync (spec in W2-VR1).

## 7. Rollback doctrine

Three categories per node (`simple` | `dual-read` | `irreversible`):

- `simple` — revert the emit/read path; nothing else to undo.
- `dual-read` — both sources coexist; flip the read selector back.
- `irreversible` — **no P0/P1 node may be irreversible.** Backfill output
  (W2-BF1) is `dual-read`: exclude `provenance='historical_replay'` to roll
  back. No destructive operation exists in this wave — table pruning is a
  separate post-W2 gate (W2-RT1).

## 8. Adversarial answers

| Case | Answer |
|---|---|
| Partial dual-write failure | Impossible — single Dexie transaction (§3). Outbox fallback if a table ever can't join. |
| Projection disagrees with legacy state | Projection wins for capability claims; legacy remains history. Divergence beyond expectations → keep dual-read, escalate (W2-WS2 stop condition). |
| Historical data lacks required evidence | HISTORY ONLY (§5). Never minted. |
| Old UI still needs history | Dual-read — history tables keep serving presentation. |
| Stale sync delivers legacy state | Applies as history; capability reads never consult it (§6). |
| Tabs run different app versions | Append-only events are forward-compatible; old versions ignore them, write legacy only — read back as history on upgrade. Dexie versioned schema upgrades are idempotent. |
| App rollback/downgrade | Legacy tables were never deleted — downgrade is safe; events sit unused in the downgraded build (table is additive in v15). |
| Anonymous → authenticated | Events carry `learnerId`; W2-VR1 documents the namespace merge at first sync. |
| Legacy daily task queued post-planner-migration | Executes as cache to completion; only *planner-generated* rows carry decision provenance (W2-PL1). |
| CEFR label conflicts with projection | Label is advisory placement, never compared as truth; projection is the only capability surface (W2-AS1/G03). |
| FSRS due while capability is TRANSFERRED | Scheduling vs ability are orthogonal by doctrine — due-ness schedules rehearsal of carrier material; it never modifies capability state. |
| pronunciationProgress strong, zero acoustic events | Presents as practice history only; capability claims require W3 acoustic events (W2-PR1). |

## 9. Non-decisions (explicitly out of scope)

- No runtime Wave-2 implementation in this mission.
- No writer freeze execution, no data migration, no table drops.
- No Speech/OpenPronounce work — acoustic eval is a Wave-3 gate.
- No `dailyTasks` schema split — row-class semantics documented only.
- No per-user auth/quota redesign (tracked as accepted debt).
- No WordBook schema work; no cold-seed performance work.
