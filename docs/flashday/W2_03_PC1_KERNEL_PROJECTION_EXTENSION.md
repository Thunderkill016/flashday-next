# W2-PC1 — Kernel Projection Extension

**Status:** IMPLEMENTED — pending external review
**Class:** kernel repair mission (not a migration mission)
**Base:** `main @ 0b8d17defe1cd2f4f6d7d45a33a4b3cfa456800e` (post-G04 merge)
**Branch:** `flashday/w2-pc1-kernel-projection-extension`

## Mission question

Can the three projection-coverage gaps W2-G04 proved missing be
implemented as named, replay-derived, consumer-usable kernel constructs —
without a fourth construct, without WS1 mapping, and without migrating
legacy consumers?

Canonical G04 result (`docs/flashday/W2_03_G04_PROJECTION_COVERAGE.md`):

```json
missingConstructs = [
  "verified_consecutive_failure",
  "support_dependency",
  "selection_decision_provenance"
]
```

## Reproduction on this base (pre-implementation)

The PC1 pin suite
(`src/lib/evidence-bridge/kernel-projection-extension.test.ts`)
asserts the REQUIRED post-PC1 semantics and therefore fails on the base
for exactly the three documented reasons:

- `verifiedConsecutiveFailures` does not exist on the projection slot or
  learner model; production `planNext` routes remediation on the loose
  counter, so a self-reported (unobserved) fail flips
  `independent_attempt` → `retry`.
- `support.dependent` mints `true` from a single aided success with zero
  demand-lifecycle evidence; no `support.dependency` state exists.
- `selectNextTask` in `SELECTION_MODES.REFERENCE` returns
  `decision === undefined`, `inputDigest === undefined`; the only
  digest-bound identity machinery lives behind B0/B1/shadow modes that
  production never serves.

## Construct ledger

G04 remains an audit of its own base; this file records the resolution.
Regression pins: `src/lib/evidence-bridge/kernel-projection-extension.test.ts`
(28 pins) plus the resolution blocks in
`src/lib/evidence-bridge/projection-coverage-audit.test.ts`, the bridge
pin in `evidence-bridge.test.ts`, and the session pin in `session.test.ts`.

### `verified_consecutive_failure` — RESOLVED

| field | content |
| ----- | ------- |
| constructId | `verified_consecutive_failure` |
| G04 counterexample | `projection.consecutiveFailures` counted ANY attempt-typed outcome — an unobserved self-report and a stale-revision event both advanced the counter the same event set filed under `unverifiableEventCount`; production `planNext` flipped `independent_attempt → retry` on a self-report while `generateCandidates` read a different (strict) internal stream. |
| implemented artifact | `src/vnext/verified-attempts.js::deriveVerifiedAttemptFacts` — the one shared derivation. Exposed as `verifiedConsecutiveFailures` + `lastVerifiedObservedOutcome` on `projectLearnerState().byCapability` slots and `buildLearnerModel` `failures.*`; `consecutiveFailures` is now an alias of the verified streak (the loose counter is deleted, not just bypassed). |
| semantic contract | Consecutive `fail`/`partial` outcomes on the VERIFIED attempt trail: learner-scoped, id-deduped, canonical `(occurredAt, id)` replay order, exact registered `taskId@taskRevision`, `verifyEventTask` pass (capability identity, modality, purpose-allowed event type, binding/family/freshness/authority checks), event type ∈ performance `ATTEMPT_TYPES`, `attempt.observed === true`, `attempt.outcome != null`. `success` → 0; `fail`/`partial` → +1. |
| verification bar | `verifyEventTask` full contract + explicit `observed===true` + attempt-type gate. Self-reported, stale-revision, foreign-learner, duplicate, and context-typed events are invisible — they neither advance nor reset the streak (fail → unobserved success → fail stays 2; fail → stale success → fail stays 2). |
| open condition | First verified observed `fail`/`partial` → streak 1. |
| clear/reset condition | Verified observed `success` → 0. Untrusted events never reset. |
| consumer surface | `projectLearnerState` slots (`verifiedConsecutiveFailures`, `lastVerifiedObservedOutcome`, `consecutiveFailures` alias); `buildLearnerModel` `failures.*`; session `ProgressLine.verifiedConsecutiveFailures`; candidate `facts.verifiedConsecutiveFailures`/`facts.observedFails`. |
| authority consumers repaired | `planNext` rule 4 remediation gate now reads `verifiedConsecutiveFailures`; rule 2 due-check suppression reads `lastVerifiedObservedOutcome`; `deriveTaskConsumption().observedFailStreak` delegates to the shared derivation (no second loop); `generateCandidates` DUE_RETRIEVAL gate reads `lastObservedOutcome` (same stream); `policies.pickOrdinal` tie-break prefers `verifiedConsecutiveFailures`; `repair-proof` reads the shared-stream count; learner-model `fragile`/`currently_failing` now ride the verified streak (the alias). |
| regression proof | `kernel-projection-extension.test.ts` describes `PC1-A` (9 pins) + audit file `G04 verified_consecutive_failure — PRESENT (PC1 resolution)` (3 pins). |
| compatibility | `consecutiveFailures` retained as a strict alias — it can never diverge because the loose counter no longer exists. `lastAttemptOutcome` kept as the loose context signal (presence-of-attempt and latest raw outcome); documented non-authoritative for failure semantics. |
| downstream unlock | WS1 `consecutive failure` mapping can consume `verifiedConsecutiveFailures`; PL1 planner reads a streak that cannot be forged by self-report. |

### `support_dependency` — RESOLVED

| field | content |
| ----- | ------- |
| constructId | `support_dependency` |
| G04 counterexample | One aided success (`support: {hint:true}` on an attempt) flipped `support.dependent → true` with zero demand-lifecycle evidence — "support happened" collapsed into "dependency", and the G04 pin proved it. |
| implemented artifact | `buildLearnerModel` exposes `support.dependency = { state, demandedFunctions, dependentFunctions }` where `demandedFunctions` = functions that generated a support demand (pending AND resolved lifecycle episodes) and `dependentFunctions = demandedFunctions ∩ unresolvedFunctionGaps`. `support.dependent` becomes the strict alias `state === 'DEPENDENT'`; candidate facts carry `supportDependency` + strict `supportDependent`. |
| semantic contract | `UNMODELED` — mission `roles` absent or `roles.supports` not provided (the demand lifecycle cannot be computed — honest non-answer, never fake CLEAR); `CLEAR` — mapping available and no demanded function remains unresolved; `DEPENDENT` — ≥1 demanded function still lacks independent covering recovery. |
| verification bar | Demand evidence comes only from `deriveSupportLifecycle` (verified attributed miss + declared support provider). Consumed (probe-served) demands stay `demanded` — the episode consumed the demand, not the dependency. `everUsed`/`lastSupportAt`/`servedEpisodes` remain historical facts, not dependency. |
| open condition | Verified observed attributed miss → support demand issued for function `f` while `f`'s gap is unresolved. |
| clear/reset condition | Independent covering success resolves `f`'s gap → `f` leaves `dependentFunctions`. A supported (non-independent) success does not clear; a success on an unrelated function does not clear. |
| consumer surface | `buildLearnerModel().capabilities[c].support.dependency` + `.dependent`; candidate `facts.supportDependency`/`supportDependent`; uncertainty reason `support_dependent` and `profile.supportDependent` now ride the strict state. |
| authority consumers repaired | `candidate-generator` `support_dependency_fade` preference and its `why` string now trigger only on `DEPENDENT` (a one-off hint gets the neutral `succeeded with support — try unaided`); learner-model uncertainty/profile no longer mint dependency from usage recency. |
| regression proof | `kernel-projection-extension.test.ts` describe `PC1-B` (10 pins incl. consumed-probe-stays-DEPENDENT and roles-absent→UNMODELED) + audit file `G04 support_dependency — PRESENT (PC1 resolution)` (2 pins). |
| compatibility | `support.dependent` retained as the strict-state alias — it cannot express the old everUsed-recency semantics anymore. `everUsed`, `lastSupportAt`, `servedEpisodes`, `pendingFunctions` unchanged (usage facts). |
| downstream unlock | WS1 `support dependency` mapping consumes `support.dependency.state`/`dependentFunctions` directly. |

### `selection_decision_provenance` — RESOLVED

| field | content |
| ----- | ------- |
| constructId | `selection_decision_provenance` |
| G04 counterexample | `selectNextTask` in `SELECTION_MODES.REFERENCE` — the only mode bridge/session serve — returned raw `nextMissionTask` fields with `decision === undefined` and `inputDigest === undefined`; digest-bound identity machinery existed only behind B0/B1/shadow modes production never runs. |
| implemented artifact | `selectNextTask` now computes `engineState` + `sha256(decisionInputSnapshot(state))` for EVERY mode before dispatch; REFERENCE returns `{...nextMissionTask(referenceArgs), engineInput, inputDigest: 'sha256:<64hex>', decision: referenceDecision(reference, {missionId, missionRevision, inputDigestHex})}`. `referenceDecision` fails closed on a missing/malformed digest — an unbound decision id cannot exist. Shadow paths reuse `referenceProvenance(state)` — one identity scheme across REFERENCE/SHADOW_B0/SHADOW_B1. `decisionInputSnapshot` now includes canon-sorted `riskPriors` (the planner reads them — decision-relevant). |
| semantic contract | `decisionId = ref:<digest[:16]>:<status>:<taskId|'none'>@<revision>` — identical canonical input + identical output → identical id; any decision-relevant input change (event content, task revision surface, policy, risk priors, roles, `now`) moves the digest → new id. Terminal `idle`/`blocked` results carry honest provenance with `chosen.taskId = null`. |
| verification bar | The digest is the existing canonical `decisionInputSnapshot` machinery — learner-scoped deduped canonicalized events (+conflict detection), tasks@revision surface, mission@revision, capabilities, roles, policy, selection config, decisionContext, riskPriors, `now`. No lightweight digest; no caller-authored digest accepted. |
| open condition | Every `selectNextTask` call in any mode mints the record — including the fail-closed unknown-mode fallback to REFERENCE. |
| clear/reset condition | n/a — records are append-only provenance; a re-selection on changed input mints a new digest-bound id. |
| consumer surface | `NextTaskDecision.decision`/`inputDigest`/`engineInput` typed in the bridge (`SelectionDecision` interface); `nextAction()` returns them verbatim; `session.decision()` exposes the standing provenance-bearing decision under the live-task lock; `decisionAuditRecord()` carries `decisionId`/`decisionInputDigest`/`taskId`. |
| authority consumers repaired | REFERENCE production path (the only served mode). SHADOW_B0/SHADOW_B1 `referenceDecision` calls updated to the digest-bound contract — no orphan identity scheme remains. |
| regression proof | `kernel-projection-extension.test.ts` describe `PC1-C` (9 pins: equivalence, determinism, reorder/duplicate/foreign-learner invariance, content/revision/policy sensitivity, terminal provenance, unknown-mode fallback, audit-record binding, weak-digest rejection, cross-mode digest agreement) + audit-file provenance resolution pin + bridge `nextAction` pin + session standing-decision pin. |
| compatibility | Served payload is verbatim `nextMissionTask` output — `status`/`taskId`/`taskRevision`/`capabilityId`/`purpose`/`reason`/`skippedIntents` unchanged; provenance is additive only (`decision`/`inputDigest`/`engineInput`). The equivalence pin diffs the stripped result against bare `nextMissionTask` for `toEqual` identity. No REFERENCE→B0/B1 switch. |
| downstream unlock | PL1 can write `decisionId`/`decisionInputDigest` into `dailyTasks` against a contract that exists on the production path today. |

### Resolution summary

| constructId | status |
| ----------- | ------ |
| `verified_consecutive_failure` | RESOLVED |
| `support_dependency` | RESOLVED |
| `selection_decision_provenance` | RESOLVED |

```json
{
  "status": "implemented",
  "baseSha": "0b8d17defe1cd2f4f6d7d45a33a4b3cfa456800e",
  "sourceMissingConstructs": [
    "verified_consecutive_failure",
    "support_dependency",
    "selection_decision_provenance"
  ],
  "implementedConstructs": [
    "verified_consecutive_failure",
    "support_dependency",
    "selection_decision_provenance"
  ],
  "remainingMissingConstructs": [],
  "artifact": "docs/flashday/W2_03_PC1_KERNEL_PROJECTION_EXTENSION.md"
}
```

**Downstream status:** WS1 remains LOCKED pending external review + merge
authorization; PL1 remains blocked; no fourth construct was introduced;
no WS1/PL1/weakSpots/placement/FSRS/speech/sync work was performed.
