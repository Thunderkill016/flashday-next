# W2-G04 — Projection Coverage Audit

**Mission:** W2-03 node `W2-G04` (`docs/flashday/W2_MIGRATION_DAG.json`)
**Branch:** `flashday/w2-g04-projection-coverage`
**Base HEAD:** `2b0bb79940d886767956e550f3db84b9312d1df2` (main after PR #11)
**Class:** audit only — no runtime change. Nothing in `src/vnext/**` was
modified; the only new code is a Vitest pin file proving existing behavior.
**Question:** does the evidence kernel expose a named, deterministic,
consumer-usable projection artifact for every semantic construct the
downstream nodes (W2-WS1 weakness mapping, W2-PL1 planner authority,
W2-WS2 weakness surfaces, W2-CS1 consumer sweep) must consume?
**Answer:** mostly — but three constructs are missing. **Verdict:
`PROJECTION_GAPS_FOUND`**, `missingConstructs =
["verified_consecutive_failure", "support_dependency",
"selection_decision_provenance"]`.

## 0. What "covered" means here

A construct is `PRESENT` only if a downstream consumer can import a named
kernel artifact and read the construct's semantics from it — without
recomputing evidence semantics in application code. A field that merely
shares the construct's name does not count. Constructs with only partial
implementation are `MISSING` (no `PARTIAL` status exists).

All findings are pinned by `src/lib/evidence-bridge/projection-coverage-audit.test.ts`
(23 pins) — replay-derived reproductions inside this repo, complementing
the vendored kernel's upstream suites (FlashDay `tests/vnext-*.mjs`).

## 1. Coverage table

| constructId | semantic requirement | downstream consumers | kernel artifact | exact function + output field | source file | evidence inputs | verification bar | lifecycle | proof | status | limitation | PC1 requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `capability_state` | per-capability state + milestones (INDEPENDENT/RETAINED/TRANSFERRED) minted only by verified evidence, replay-derived, learner-isolated | WS1, PL1, WS2, CS1 | `projectLearnerState` | `projectLearnerState(learnerId, events, capabilities, tasks).byCapability.get(capId).state` + `.milestones` | `src/vnext/projection.js:38,116` | attempt events, canonical `(occurredAt,id)` order, dup-id safe | `attempt.observed === true` + contract-registered task (`projection.js:89`); unobserved success cannot mint INDEPENDENT | milestones sticky; state = highest milestone (`:237`) | audit: order/learner isolation, dup-safe, unobserved-success pin | PRESENT | slot `.consecutiveFailures` is the loose counter — see `verified_consecutive_failure` | none |
| `verified_consecutive_failure` | consecutive fail/partial streak over **observed** attempts on registered task revisions — the counter hard-repair and weakness semantics may trust | WS1 (weakness construct), WS2 (weakness surfaces), PL1 | none consumer-facing | nearest: `byCapability[].consecutiveFailures` (`projection.js:205`), `failures.consecutiveFailures` (`learner-model.js:359`), internal `deriveTaskConsumption().observedFailStreak` (`next-for-you/task-resolver.js:68`) | `src/vnext/projection.js`, `src/vnext/learner-model.js`, `src/vnext/next-for-you/task-resolver.js` | — | exposed counters increment on **unobserved** self-reports and on **stale-revision** events that are simultaneously counted in `unverifiableEventCount` | counters reset on success | audit: unobserved fail → exposed counters 1 while `observedFailStreak` 0; stale-rev fail → counter 1 + unverifiable 1; `planNext` flips `independent_attempt`→`retry` on self-report | MISSING — partial implementation exists | correct semantics computed only inside the task-resolver map (requires consumer to assemble `taskByRev`); three names (`consecutiveFailures` / `observedFailStreak` / `observedFails`) with two divergent semantics; production `planNext` (`planner.js:259`) consumes the **loose** counter while `generateCandidates` (`candidate-generator.js:204`) consumes the strict one | expose a named verified-observed streak (observed + registered revision) on the learner-model failures block; define which counter the planner remediation gate consumes |
| `recurring_error` | an error that **recurs after repair was demonstrated** — not mere repetition, not a sticky historical flag | WS1 → correction-episode triggers (per DAG mapping), WS2 | `deriveCorrectionEpisodes` | `deriveCorrectionEpisodes({learnerId, events, capabilities, tasks, now}).episodes[].state === 'RELAPSED'` + `.relapseCount` + `.lastRelapseAt`; live view via `.openByCapability[capId]` | `src/vnext/correction-episodes.js:68,289,384` | verified attributed failures landing while REPAIRED_WAITING/RETEST_DUE | only VERIFIED events open/relapse episodes (`:27`) | RELAPSED keeps episode unresolved; VERIFIED is terminal — later failure opens a NEW episode | audit: miss→repair→retest-window→attributed fail → RELAPSED, `relapseCount` 1; second fail while OPEN absorbs (widens), relapseCount stays 0 | PRESENT | `learner-model.failures.recurringFunctions` (`learner-model.js:375`) is a **looser** signal (`misses≥2 || reopened`, never decays even when resolved) — consumers must use episode relapse, not that field | none for coverage; hygiene candidate: tighten/rename `recurringFunctions` so it cannot be mistaken for this construct |
| `function_gap_ledger` | per-capability record of functions missed vs resolved, attribution-verified | WS1, WS2 | `buildLearnerModel` failures block | `.capabilities[capId].failures.unresolvedFunctions` / `.resolvedFunctions` | `src/vnext/learner-model.js:110-112,381-383` | `evaluation.missingFunctions` on observed attempts under attributing contracts | unobserved miss opens no gap; resolution requires independent success on a task that exercises the function | unresolved → resolved on covering independent success; ledger keeps `misses`/`reopened` internally | audit: unobserved attributed miss → no gap; observed → opens; unrelated success → stays open; covering success → resolves | PRESENT | per-function ledger detail (`misses`, `reopened`, `lastMissAt`, `lastDemoAt`) is internal — only function-name lists are exposed | none |
| `support_dependency` | evidence of actual ongoing/persistent reliance — **not** "support used once" | WS1, WS2 | none consumer-facing for this semantics | nearest: `.capabilities[capId].support.dependent` (`learner-model.js:394`); `deriveSupportLifecycle` (`planner.js:54`) | `src/vnext/learner-model.js:385-395` | support-tagged attempts + support-demand lifecycle | `dependent = relied && (lastIndependentAt == null \|\| lastRelianceAt > lastIndependentAt)` where `relied = everUsed \|\| servedEpisodes>0 \|\| pendingFunctions.length>0` | clears on any later unaided success | audit: **one** aided success → `dependent` true while `servedEpisodes` 0 and `pendingFunctions` [] — a single support-bearing attempt mints "dependency" with zero demand-lifecycle evidence | MISSING — partial implementation exists | `dependent` is only "latest demonstrated reliance / no later unaided recovery" — exactly the spec trap "support used once ≠ support dependency"; no reliance-strength/persistence semantics; demand-derived fields empty without mission `roles` | define/expose a named support-dependency construct requiring evidence of ongoing/persistent reliance; keep one-off support usage as a separate fact; explicit open/clear criteria; reuse `deriveSupportLifecycle` where mission-scoped demand evidence exists. Threshold semantics belong to PC1/WS1, not this audit |
| `support_demand_lifecycle` | support demand: issued → pending → consumed by verified probe / cancelled by independent recovery, bounded reissue | WS1, WS2, PL1 | `deriveSupportLifecycle` | `deriveSupportLifecycle(learnerId, events, {capabilities, tasks, roles, policy})` → `{pending, resolved}` with per-demand status | `src/vnext/planner.js:54` | observed attributed misses on target capabilities whose missing function maps to a support capability | unobserved miss issues nothing; demand consumed only by verified support-probe success exercising the missing function | issue → pending → consumed/cancelled; reissue bounded by policy; learner-isolated | audit: observed miss → pending demand (target+fn+support cap ids); unobserved → none; verified probe → consumed w/ `resolvedByEventId`; no roles → empty | PRESENT | **mission-scoped**: requires mission `roles` (target/support/prereq sets); no cross-mission demand view | none |
| `correction_episode` | a repair obligation opened only by verified observed attributed failure on a taught capability | WS1, WS2 | `deriveCorrectionEpisodes` | `.episodes[]` + `.openByCapability[capId]` with `state`, `missingFunctions`, `failures`, `repairSurfaceTaskIds`, `relapseCount`, … | `src/vnext/correction-episodes.js:193,365` | observed attributed misses on taught capabilities | unobserved fail → no episode; untaught-capability miss → no episode; unrelated success does not close | OPEN → REPAIRING → REPAIRED_WAITING → RETEST_DUE → VERIFIED (terminal) / RELAPSED | audit: opens only on observed attributed miss on taught cap; unrelated success keeps OPEN; order-independent digest; foreign learner inert | PRESENT | — | none |
| `retest_surface` | the fresh, unburned, function-covering surfaces a retest may be served on | WS1, WS2 | `retestSurfaces` / `pickRetestSurface` / `burnedSurfaces` / `remainingOf` | `retestSurfaces(episode, tasks)` → task[]; `pickRetestSurface` → deterministic pick | `src/vnext/correction-episodes.js:153-191` | episode + task registry | purpose ∈ {delayed_retrieval, retrieval, production, interaction}; not burned; `requiredFunctions` covers a remaining missing function | burns: every failure surface, consumed remediation, repair surfaces, practiced retest surfaces | audit: repair → REPAIRED_WAITING, surfaces = retrieval+delayed tasks, burned remediation excluded, pick = `delayed.hear`; when every covering surface is burned → `[]`/`null` honestly | PRESENT | empty surface set = genuinely unservable retest — consumer must treat `[]` as "no fresh surface", not an error | none |
| `remediation_demand` | "capability owes repair/retest" = open episode + its retest surfaces | WS1, WS2, PL1 | `deriveCorrectionEpisodes().openByCapability` + `retestSurfaces()` | iterate `openByCapability` (all UNRESOLVED states); `retestSurfaces(ep, tasks)` serves it | `src/vnext/correction-episodes.js:365,173` | same as `correction_episode` | demand exists iff episode state ∈ OPEN/REPAIRING/REPAIRED_WAITING/RETEST_DUE/RELAPSED | retires when episode VERIFIES | audit: OPEN→…→RETEST_DUE transitions readable without rebuilding state | PRESENT | no single composite "demand" DTO — consumer composes two named exports (a lookup, not a semantic rebuild); if reviewers want the composite named, PC1 adds a trivial `deriveRemediationDemand` wrapper | optional convenience wrapper only |
| `consumer_learner_model` | deterministic, replay-derived, learner-isolated, serializable read model; separate dimensions; no hidden reimplementation | WS1, WS2, CS1, PL1 | `buildLearnerModel` | `buildLearnerModel({learnerId, events, capabilities, tasks, now, roles})` → `{capabilities, profile, …}` | `src/vnext/learner-model.js:148` | full evidence log | pure function of events+contracts; documented "no CEFR/mastery number" | rebuilt on each call; nothing persisted inside | audit + upstream `vnext-learner-model` suite | PRESENT | embeds the loose `consecutiveFailures` and the loose `recurringFunctions` (see those rows); support demand fields empty without `roles` | receives the new fields from PC1 items above |
| `next_action_candidates` | the pedagogically valid candidate set with facts + provenance, before any choice | WS2, PL1 | `generateCandidates` | `generateCandidates({learnerId, events, capabilities, tasks, roles, policy, now, mission, decisionContext, selection})` → candidate[] | `src/vnext/next-for-you/candidate-generator.js:87` | learner model + projection + task consumption facts | each candidate carries `provenance` labels (KERNEL/EVIDENCE/SAFETY/EXPERIMENTAL); hard-repair gate reads `observedFails` (strict counter, `:204`) | recomputed per selection | audit: B0 path consumes it deterministically | PRESENT | requires the full engine input bundle (mission, roles, decisionContext); mission-scoped, not a standalone per-learner projection | none |
| `next_action_selection` | one deterministic, fail-closed next-action decision | bridge `nextAction`, session flow, PL1 | `selectNextTask` | `selectNextTask(input)` → `{status, taskId, …}`; `SELECTION_MODES` = REFERENCE/B0/SHADOW_B0/B1/SHADOW_B1 | `src/vnext/next-for-you/selector.js:31,317` | events + mission + task registry + policy | unknown mode fails closed to REFERENCE (`:320`); B0/B1 decisions validated by `validateB0` | deterministic per input snapshot | audit: identical inputs → identical `decisionId`; bridge+session serve REFERENCE (`bridge.ts:235`, `session.ts:244`) | PRESENT | REFERENCE output is raw `nextMissionTask` payload — no candidates/decision record (see next row) | none for the artifact itself |
| `selection_decision_provenance` | every **served** selection traceable to its evidence-derived input via decisionId + input digest + audit record | PL1 (planner rows must record the decision id), CS1 | partial: `decisionInputSnapshot` / `stateDigest` / `createDecisionLog` / `decisionAuditRecord` | B0/B1: `selectNextTask` returns `decision.decisionId` bound to `inputDigest` (`selector.js:339`); `createDecisionLog().append` recomputes digest fail-closed (`decision-log.js:107-109`) and requires full provenance for nonterminal decisions (`:129-133`) | `src/vnext/next-for-you/decision-log.js`, `decision-context.js`, `selector.js` | canonical snapshot of events/roles/mission/tasks/policy/selection context | digest covers full decision input; append rejects caller-supplied mismatched digest; nonterminal decisions require missionId+revision+policy versions+episode id | decisionId embeds digest slice → bound to input state | audit: B0 decisionId stable across identical inputs and contains digest; `decisionAuditRecord` carries `decisionId`+`decisionInputDigest`+`taskId` | MISSING — partial implementation exists | **production path has none**: REFERENCE mode (the only mode bridge/session serve) returns `nextMissionTask` with `decision === undefined`, `inputDigest === undefined`; `referenceDecision()` exists but is invoked only inside SHADOW modes (`selector.js:356,383`) and its `ref:` id binds episode#ordinal+outcome — not the evidence digest | emit a digest-bound decision record on the REFERENCE-served path (wrap served selections so `decisionId`/`inputDigest`/provenance exist), or designate a decision-bearing production mode before PL1 |

## 2. The three gaps, in detail

### `support_dependency`

`buildLearnerModel().capabilities[].support.dependent` is defined as
`relied && (lastIndependentAt == null || lastRelianceAt > lastIndependentAt)`,
where `relied = everUsed || servedEpisodes > 0 || pendingFunctions.length > 0`
(`learner-model.js:385-395`). `everUsed` is set by a single attempt that
carried answer-bearing or disallowed support — so **one aided success with
zero demand-lifecycle evidence already mints `dependent: true`** (pinned:
`servedEpisodes === 0`, `pendingFunctions === []`).

That is the exact semantic trap this audit was told to catch: *support used
once ≠ support dependency*. The flag is a recency predicate ("latest
demonstrated reliance, no later unaided success"), not a dependency
construct WS1 can serve as weakness semantics. `deriveSupportLifecycle`
carries richer demand evidence but is mission-scoped (empty without
`roles`) and is not the dependency flag's input.

PC1 requirement (threshold semantics are PC1/WS1's design call, not this
audit): define/expose a named support-dependency construct whose lifecycle
requires evidence of actual ongoing/persistent reliance, keep one-off
support usage as a separate fact, define explicit open/clear criteria, and
reuse `deriveSupportLifecycle` where mission-scoped demand evidence exists.

### `verified_consecutive_failure`

Three counters exist, two semantics, one name collision:

| counter | where | counts | consumed by |
|---|---|---|---|
| `consecutiveFailures` | `projection.js:205`, re-exported via `learner-model.js:359` | every accepted attempt event with fail/partial — **including unobserved self-reports and stale-revision events** | `planNext` remediation gate (`planner.js:259`), `profile.fragile`, `currently_failing` reason |
| `observedFailStreak` | `task-resolver.js:68-85` | only `attempt.observed === true` on registered task revisions | `generateCandidates` hard-repair gate (`candidate-generator.js:204`) |
| `f.observedFails` | `candidate-generator.js:144` | copy of the strict map | candidate facts |

Audit reproduction (all pinned in the test file): a single **unobserved**
self-reported fail leaves `observedFailStreak` at 0 yet sets both
consumer-facing counters to 1 and flips production `planNext` from
`independent_attempt` to `retry`. A stale-revision fail does the same
while simultaneously landing in `unverifiableEventCount`. So the artifact
WS1/WS2 would naturally read (`failures.consecutiveFailures`) can mint
weakness semantics from evidence the kernel itself flags as unverified.
The strict computation exists but is not exposed on any consumer-facing
artifact and requires the consumer to assemble a `taskByRev` registry.

### `selection_decision_provenance`

The B0/B1 machinery is complete: canonical `decisionInputSnapshot`,
SHA-256 `inputDigest`, `decisionId` bound to the digest, fail-closed
append-time recomputation, provenance completeness enforcement. But the
only production-served path — `selectNextTask` in REFERENCE mode, used by
`bridge.nextAction` and the session flow — returns the raw
`nextMissionTask` output: no decision record, no digest. `referenceDecision()`
can wrap a served reference selection but is only called inside shadow
modes, and its `ref:` decisionId binds episode+ordinal+outcome, **not**
the evidence-state digest. Until PC1 lands, a planner-generated row in
W2-PL1 cannot record a verifiable decision id for the selection it
executed.

## 3. Deliberately not in this table

- **Memory/FSRS constructs** — out of scope by doctrine; W2-02.5 fixed the
  memory/capability boundary (spelling stays `MEMORY_ITEM`).
- **Placement** — advisory domain sealed by W2-G03; not a kernel construct.
- **Speech/pronunciation mastery** — frozen; no speech work in Wave 2.

## 4. Result

```json
{
  "status": "audited",
  "baseSha": "2b0bb79940d886767956e550f3db84b9312d1df2",
  "missingConstructs": [
    "verified_consecutive_failure",
    "support_dependency",
    "selection_decision_provenance"
  ],
  "coverageArtifact": "docs/flashday/W2_03_G04_PROJECTION_COVERAGE.md"
}
```

Rows: 13 — PRESENT: 10 — MISSING: 3.

Per the DAG stop condition, **W2-PC1 is now required** before W2-WS1 /
W2-WS2 / W2-PL1 consume the affected constructs. PC1's minimal scope is
exactly the three rows above; this audit implements nothing.

Blocked downstream nodes: W2-WS1 (needs `verified_consecutive_failure`
and `support_dependency` for the weakness constructs it maps), W2-PL1
(needs `selection_decision_provenance` to record decision ids on served
selections). W2-WS2 / W2-CS1 are transitively blocked through those.
