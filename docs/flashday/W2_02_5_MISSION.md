# W2-02.5 — Vocabulary Spelling Authority Boundary Pilot

**Status:** RUNNING  
**Class:** authority-domain falsification / prerequisite analysis  
**Stacked base:** `flashday/w2-02-semantic-commit`  
**Exact dependency HEAD:** `da0bafc1bd91988858394e135e304bf6b4009ba8`

This mission does **not** start official W2-03 and must not merge PR #7.

## Mission question

Is `vocabulary:spelling` capability evidence, or item-level memory evidence?

The action is attractive because it has a typed response and deterministic scoring, but determinism alone does not determine the authority domain.

FlashDay doctrine:

```text
MemoryState != ProficiencyState
```

and the current master plan treats vocabulary senses/forms as memory objects.

## Verified live spelling flow

```text
definition visible
target word hidden
→ learner types
→ Compare answer
→ response freezes
→ target/meaning/example/audio reveal
→ self-rating
→ persistence
```

Verified constraints:

- `content.title` is hidden before response;
- spelling audio is unavailable before reveal;
- Compare Answer requires a non-empty answer;
- textarea becomes disabled after reveal;
- "I don't know yet" sets `[not recalled]`;
- rating occurs only after reveal.

### Reveal semantics

`submission.revealed === true` is **post-response verification**, not pre-answer support.

Therefore the first spelling attempt must **not** map `revealed` into `event.support`.

### Rating semantics

Again/Hard/Good/Easy remain FSRS/memory-scheduling inputs only. They must not author capability outcomes.

## Required falsification

Before adding any production capability, create a test-only generic lexical-form capability/task using a deterministic exact-match evaluator and replay current projection.

Prove current kernel behavior:

```text
one independently correct lexical item
→ INDEPENDENT

another independently correct attempt >= retention delay
→ RETAINED
```

Then answer whether either state is an honest claim about a generic capability.

Expected concern:

- if the capability means "recall this exact word", the item identity is missing;
- if it means "recall learned word forms generally", one item is insufficient evidence.

Do not weaken the capability definition to make the pilot pass.

## Forbidden workaround

Do not create one production capability per vocabulary item during this mission.

That would duplicate the memory domain inside LearnerProjection and requires a separate architecture decision covering dynamic capability scale, replay, sync, deletion/versioning, planner semantics and FSRS duplication.

## Expected authority classification

Unless falsification disproves the concern:

```text
vocabulary:spelling
→ MEMORY_ITEM
→ NOT CAPABILITY EVIDENCE
```

Keep the audit action non-MAPPED_SAFE and strengthen its reason.

Do **not** register `eval.exact_match.v1` into vNext solely for spelling if there is no legitimate capability consumer.

## Preserve reusable findings

Document these as future activation invariants:

1. exact-match target must come from trusted authoritative data, never ordinary caller-authored evaluation context;
2. event id = `evt.<attemptId>`;
3. semantic `occurredAt` must be captured at the immutable performance boundary and reused on retries;
4. post-response reveal must not contaminate the original attempt's support;
5. deterministic correctness does not imply the observation belongs in LearnerProjection.

## Re-audit all 15 legacy actions by authority domain

Add one field/classification dimension:

- `MEMORY_ITEM`
- `CAPABILITY`
- `FEEDBACK_ONLY`
- `HISTORY_ONLY`
- `AMBIGUOUS`

Do not infer the classification only from evaluator availability.

At minimum scrutinize:

- vocabulary meaning;
- vocabulary spelling;
- vocabulary dictation;
- vocabulary application;
- vocabulary construction;
- learning-attempt comprehension;
- learning-attempt writing;
- learning-attempt retelling;
- learning-attempt personal-example;
- learning-attempt sentence-pronunciation;
- text-cycle understand/output/correct/recall/apply.

## Find the first genuine capability pilot

After the authority-domain audit, identify the smallest action that genuinely answers:

> What can this learner do?

rather than:

> Does this learner remember this item?

Investigate existing `production.write.personal_info_short` only if a real execution surface can be shown to elicit exactly that ability. Do not force a mapping.

No matching legacy action is an acceptable result.

## Required deliverables

1. `docs/flashday/W2_02_5_MEMORY_CAPABILITY_BOUNDARY.md`
2. updated W2-02 audit wording/classification;
3. authority-domain classification of all 15 actions;
4. projection counterexample tests;
5. recommendation for first genuine capability pilot;
6. master-plan update only if the analysis changes a project-level doctrine.

## Required regressions

- one lexical success promotes the test-only generic capability to INDEPENDENT;
- delayed second success promotes it to RETAINED;
- spelling does not alter `production.write.personal_info_short`;
- FSRS scheduling can change without capability projection change when no valid EvidenceEvent exists;
- post-response reveal is not treated as attempt support.

## Stop conditions

Return `BLOCKED_AS_CAPABILITY_PILOT` if:

1. one lexical item success overclaims a generic capability;
2. the only fix is one capability per item without an approved architecture;
3. memory and proficiency would be duplicated;
4. FSRS state would be read as ability;
5. evaluator determinism is being used to justify the wrong authority domain.

This is a valid mission outcome.

## Verification

Run on exact final HEAD:

- new authority-boundary tests;
- projection suite;
- W2-02 semantic-commit suite;
- W2-01 authority guardrail;
- full Vitest;
- `tsc --noEmit`;
- Biome.

Report local gates separately from GitHub CI/status.

## Final marker

End with exactly one of:

`MEMORY_BOUNDARY_CONFIRMED — SPELLING REJECTED AS CAPABILITY PILOT`

or, only if the concern is genuinely disproven:

`READY FOR EXTERNAL REVIEW`

Do not merge.

Do not start official W2-03 automatically.
