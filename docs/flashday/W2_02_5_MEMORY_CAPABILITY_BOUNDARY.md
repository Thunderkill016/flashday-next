# W2-02.5 — Memory / Capability Authority Boundary

**Mission:** `docs/flashday/W2_02_5_MISSION.md`
**Branch:** `flashday/w2-02-5-memory-capability-boundary`
**Dependency HEAD:** `da0bafc1bd91988858394e135e304bf6b4009ba8` (PR #7, draft — unmerged)
**Question:** is `vocabulary:spelling` capability evidence, or item-level memory evidence?
**Answer:** item-level memory evidence. Deterministic scoring does not change the domain.

```text
MemoryState != ProficiencyState
```

## 1. The falsification — the projection DOES overclaim

A test-only generic lexical-form capability was registered through the
real authoring gate (`checkCurriculum`) and scored by a test-only
deterministic exact-match evaluator, then replayed through the real
`projectLearnerState` (`src/lib/evidence-bridge/memory-capability-boundary.test.ts`,
23 tests — nothing registered in production `fixtureRegistry` /
`EVALUATORS` beyond each test's lifetime):

| Observation | Projection result | Honest? |
|---|---|---|
| One independently correct lexical item (`helpful`) | `INDEPENDENT` on the generic capability | No — one item is not evidence of a general ability |
| A second correct attempt `>=` retention delay (`portable`) | `RETAINED` | No — two items' recall is not retention of a capability |
| Two different items (`helpful`, `xylophone`) | Same capability promoted; the slot cannot say *which* item evidenced it | No — item identity is erased by construction |

The counterexample is the failure mode in both directions the mission
named:

- If the capability means *"recall this exact word"* — the item identity
  is missing from the capability claim; that claim already lives in the
  memory domain (the FSRS `records` row per `(contentId, mode)`).
- If it means *"recall learned word forms generally"* — one item is
  insufficient evidence; the projection would promote it anyway.

The only third reading — one capability per item — is the forbidden
workaround: it duplicates the memory domain inside `LearnerProjection`
and demands a separate architecture decision (dynamic capability scale,
replay, sync, deletion/versioning, planner semantics, FSRS duplication).
Not taken.

**Conclusion:** deterministic correctness is necessary for capability
evidence but NOT sufficient. The authority domain is the gate, and
spelling is `MEMORY_ITEM`.

## 2. Audit rewording — spelling stays non-MAPPED_SAFE

`LEGACY_CONTRACT_AUDIT` (`src/lib/evidence-bridge/adapter.ts`) keeps
`vocabulary:spelling` at `BLOCKED_PENDING_W2_03` with the strengthened
reason:

> item-scoped orthographic recall — deterministic scoring ≠ capability
> evidence; a generic lexical-form capability overclaims on one item,
> per-item capabilities duplicate the memory domain (W2-02.5 boundary
> analysis)

`eval.exact_match.v1` is **not** registered into `src/vnext/evaluators.js`
— there is no legitimate capability consumer for it today, and shipping
it for spelling alone would hang a deterministic contract on the wrong
authority domain.

## 3. Authority-domain classification — all 15 legacy actions

New field `authorityDomain` on `LegacyAuditEntry`, argued from the
evidence claim (what would minting this event assert?), never inferred
from evaluator availability:

| Action | Domain | Grounding |
|---|---|---|
| `vocabulary:meaning` | `MEMORY_ITEM` | self-rated recall of a stored item; claim is per-item retention |
| `vocabulary:spelling` | `MEMORY_ITEM` | item-scoped form recall; falsification §1 |
| `vocabulary:dictation` | `MEMORY_ITEM` | item-scoped form recall cued by audio |
| `vocabulary:application` | `MEMORY_ITEM` | capability-shaped response, but the recorded claim is per-item command of the word; heuristic validation is not an evaluator |
| `vocabulary:construction` | `MEMORY_ITEM` | item-internal morphology assembly |
| `learning-attempt:comprehension` | `FEEDBACK_ONLY` | self/AI-assessed open-text comprehension — coaching data, no ability or item claim |
| `learning-attempt:writing` | `CAPABILITY` | free production IS ability-shaped; blocked on evaluator authority (self/AI cannot mint independent credit), not on domain |
| `learning-attempt:retelling` | `CAPABILITY` | spoken retelling is ability-shaped; blocked on ASR/evaluator honesty |
| `learning-attempt:personal-example` | `CAPABILITY` | self-composed production is ability-shaped; blocked on evaluator honesty + task scope |
| `learning-attempt:sentence-pronunciation` | `AMBIGUOUS` | sits between item-scoped accuracy and spoken-production ability; heuristic scoring resolves neither |
| `text-cycle:understand` | `FEEDBACK_ONLY` | observation artifact about the text episode |
| `text-cycle:output` | `FEEDBACK_ONLY` | source-visible supported production can never mint independence by construction |
| `text-cycle:correct` | `FEEDBACK_ONLY` | correction episodes are metacognitive metadata |
| `text-cycle:recall` | `MEMORY_ITEM` | delayed recall of learned text content — item-scoped retention |
| `text-cycle:apply` | `AMBIGUOUS` | transfer-shaped but self-rated and text-scoped; boundary needs a contract decision |

`HISTORY_ONLY` is an honest label nothing earned: every action above
carries at least observational learning content.

## 4. First genuine capability pilot — none exists among the 15

The mission asks which action genuinely answers *"what can this learner
do?"* rather than *"does this learner remember this item?"*

- The three `CAPABILITY`-domain actions (`writing`, `retelling`,
  `personal-example`) are blocked on **evaluator authority**, not domain:
  `INDEPENDENT_AUTHORITIES = {deterministic, human}` and none of these
  surfaces has either — self-rating and AI feedback are both excluded by
  design.
- `production.write.personal_info_short` (*"write one short
  personal-information response — name, country"*) was checked against
  real execution surfaces: `lesson-workshop` elicits comprehension,
  free writing on lesson content, retelling, personal examples, and
  sentence pronunciation; `text-cycle-practice` elicits recall/apply
  stages of learned texts. **No legacy surface elicits an identity-info
  written response** — no honest mapping exists.
- The vendored mission tasks (`task.meet.*`, `task.order.*`, …) are the
  capability domain's designed surface, but `submitAttempt` has **no
  production caller** — mission mode is vendored contract + tests only.
  Capability evidence will have its honest surface when mission execution
  ships; retrofitting legacy actions into it is not that.

**Recommendation:** report the boundary result and return contract
coverage to W2-03's DAG — the first genuine capability pilot is a
mission-scoped deterministic task with a real execution surface (the
vendored mission runner activating `submitAttempt` natively), not a
reclassified legacy action. `learning-attempt:writing` is the closest
future candidate *by domain* if a deterministic rubric for scoped free
production ever lands — it is not one today.

## 5. Reusable findings preserved (activation requirements, not shipped machinery)

The R1 review ruled the first implementation shipped *speculative
authority* — a `submitAttempt(..., trusted?)` parameter is not
structurally trusted because `submitAttempt` is a public export, and a
`useRef`-captured `attemptedAt` does not survive reload. Both were
removed; what remains are the **requirements** a real capability pilot
must satisfy, plus the cheap hardening that removes caller authority:

1. **Scoring truth must be seam-resolved, never caller-authored** —
   `checkForgery` rejects `evaluationCtx.target` / `evaluationCtx.scoring`
   and `evaluation.scoredAgainst` on every submission, so the future
   channel cannot be impersonated. A declared contract whose evaluator
   abstains fails closed rather than minting outcome-less evidence.
   The actual trusted-resolution seam (authoritative source read inside
   the commit transaction) is a design requirement for the real pilot —
   NOT a generic API shipped speculatively.
2. **Event identity** — `evt.<attemptId>` pinned at the mint point; a
   payload-carried id can never redirect it (W2-02 invariant).
3. **Immutable `occurredAt`** — a future semantic attempt must persist a
   stable attempt identity object (`attemptId`, `occurredAt`, frozen
   response identity) and retries must reuse it; wall-clock at persist
   time must never backdate or refresh it. The durable persistence model
   is deferred — a `useRef` timestamp is lost on reload and spelling is
   not a semantic producer, so nothing was built for it here.
4. **Post-response reveal is not attempt support** — the producer
   declares no `revealed` flag on the semantic action; the kernel's
   answer-bearing support kinds (`hint`, `modelAnswer`, `translation`,
   `transcript`, `repeat`) are a closed set it cannot enter anyway.
5. **Determinism ≠ authority domain** — a deterministic evaluator scores
   truthfully and still must not mint `LearnerProjection` state for
   item-level memory evidence.
6. **`scoredAgainst` provenance** — when a real evaluator consumer
   exists, the event should stamp which authoritative artifact supplied
   the target and its canonical scored form. Kept as a requirement; the
   stamping machinery was removed with the trusted channel.
7. **Canonical normalization** — `src/vnext/normalize.js`
   (`canonicalExactText`) is shared *text normalization only* — no
   scoring contract, no registered evaluator. The legacy
   `normalizeSpelling` delegates so UI and any future scorer cannot
   diverge; the test-only falsification evaluator uses the same
   definition.
8. **`authorityDomain` audit dimension** — the classification field on
   `LEGACY_CONTRACT_AUDIT` is the permanent record of §3.

## 6. Regressions landed

All in `src/lib/evidence-bridge/memory-capability-boundary.test.ts` unless
noted:

- one lexical success → test-only generic capability `INDEPENDENT` ✅
- delayed second success → `RETAINED` ✅
- real `vocabulary:spelling` submission: FSRS record advances,
  `evidenceEvents` stays empty, `production.write.personal_info_short`
  (and every registered capability) untouched ✅
- producer never declares `revealed` as attempt support — proven even
  through a test-injected mapping; answer-bearing support can never mint
  independence (kernel invariant) ✅
- all 15 actions classified; `semantic-commit.test.ts` asserts the audit
  carries a valid domain per entry and spelling's `MEMORY_ITEM` /
  non-`MAPPED_SAFE` status ✅
- scoring-truth forgery rejections (caller `target` / `scoring` /
  `scoredAgainst`) and fail-closed evaluator abstention ✅
- `evt.<attemptId>` pinned on the mapped producer path ✅
- deterministic scorer owns the outcome — a self-rating cannot launder
  a miss ✅

## 7. Verification gates

Local (exact HEAD):

- `pnpm vitest run src/lib/evidence-bridge/memory-capability-boundary.test.ts` — 23/23
- `pnpm vitest run src/lib/evidence-bridge/` — includes projection-relevant seam suites
- `pnpm vitest run src/lib/authority-guardrails/` — W2-01 guardrail
- `pnpm test` — full suite
- `pnpm typecheck` (`tsc --noEmit`)
- `pnpm lint` / `pnpm format` (Biome)

GitHub CI/status is reported separately in the review thread — it is not
evidence for merge readiness.

## 8. Stop condition invoked

`BLOCKED_AS_CAPABILITY_PILOT` — conditions 1 and 5 fired (one lexical item
overclaims a generic capability; determinism was the only thing arguing
for the wrong domain). This is a valid mission outcome.

`MEMORY_BOUNDARY_CONFIRMED — SPELLING REJECTED AS CAPABILITY PILOT`
