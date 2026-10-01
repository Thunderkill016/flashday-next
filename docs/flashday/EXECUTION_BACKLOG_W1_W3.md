# FlashDay Next — Execution Backlog (Wave 1–3)

**Source:** `docs/flashday/FLASHDAY_MASTER_PLAN.md`  
**Scope:** executable backlog for Wave 1, Wave 2, Wave 3  
**Rule:** do not skip wave gates; do not merge without explicit user instruction.

---

# Priority model

- **P0 — Blocker:** must finish before downstream work can start safely.
- **P1 — Core:** required for the wave to be accepted.
- **P2 — Hardening:** important quality work; may run after the core path is stable, but before wave exit if listed in the exit gate.

Every item must produce inspectable evidence. "Reviewed" or "looks fine" is not a deliverable.

---

# Critical path

```text
W1-00
  ↓
W1-01 ──→ W1-02 ──→ W1-05
  │          │          ↓
  ├─→ W1-03 │       W1-06 ──→ W1-07 ──→ W1-08
  └─→ W1-04 │
             └──────────────────────────────┐
                                            ↓
                                         W1-09
                                            ↓
                                      WAVE 1 GATE
                                            ↓
                                         W2-00
                                            ↓
                 ┌──────────────────────────┼────────────────────┐
                 ↓                          ↓                    ↓
              W2-01                     W2-02                 W2-03
                 │                          │                    │
                 └─────────────┬────────────┴────────────┬───────┘
                               ↓                         ↓
                            W2-04                     W2-05
                               └────────────┬────────────┘
                                            ↓
                                         W2-06
                                            ↓
                                         W2-07
                                            ↓
                                      WAVE 2 GATE
                                            ↓
                                         W3-00
                      ┌─────────────────────┼─────────────────────┐
                      ↓                     ↓                     ↓
                   W3-01                 W3-02                 W3-03
                      └──────────────┬──────┴──────────────┬──────┘
                                     ↓                     ↓
                                  W3-04                 W3-07
                                     ↓                     │
                                  W3-05                    │
                                     ↓                     │
                                  W3-06                    │
                                     └─────────────┬───────┘
                                                   ↓
                                                W3-08
                                                   ↓
                                                W3-09
                                                   ↓
                                                W3-10
                                                   ↓
                                             WAVE 3 GATE
```

---

# WAVE 1 — FDN-ARCH-001: Deep Audit + Vietnam-First Foundation

## Wave objective

Understand the inherited EchoType codebase well enough to make evidence-based architecture decisions, while removing Chinese-first defaults and making Vietnamese the first-class/default product language without changing FlashDay learning semantics.

## Wave exit deliverables

Required documents:

- `docs/flashday/ECHOTYPE_DEEP_AUDIT.md`
- `docs/flashday/STATE_AUTHORITY.md`
- `docs/flashday/VIETNAMIZATION_AUDIT.md`
- `docs/flashday/LICENSE_MATRIX.md`

Required implementation:

- `vi | en | zh` first-class UI language support;
- fresh install defaults to Vietnamese regardless of browser locale;
- explicit existing en/zh preference survives;
- translation/support default becomes Vietnamese;
- active Chinese-first hard-coded defaults removed or explicitly classified;
- key parity and browser E2E coverage;
- PR #1 evidence semantics unchanged.

Speech/OpenPronounce remains frozen.

---

## W1-00 — Establish exact baseline and mission factory

**Priority:** P0  
**Goal:** Prove the wave starts from the intended repository state and is reproducible.

**Deliverables:**
- dedicated branch from exact current accepted main;
- mission file created through repo work factory;
- baseline gate output;
- exact starting SHA recorded;
- PR #2 state recorded as frozen/draft.

**Dependencies:** none.

**Acceptance criteria:**
- working tree clean before mission work;
- starting SHA matches accepted main or discrepancy is documented before proceeding;
- existing baseline verification has run;
- no Speech branch commit is present in Wave 1 branch;
- mission explicitly forbids merge, Speech, curriculum expansion and broad cleanup.

**Stop condition:** if baseline is already red for unrelated reasons, document and isolate before modifying product code.

---

## W1-01 — Inherited architecture inventory

**Priority:** P0  
**Goal:** Map the actual production architecture from code, not documentation.

**Deliverables:**
- architecture map covering routes, API routes, stores, DB tables, localStorage, sync, learning subsystems, import, providers, native/Tauri/iOS layers;
- quantitative inventory where useful;
- list of major write/read paths;
- stale/duplicate subsystem candidates.

**Dependencies:** W1-00.

**Acceptance criteria:**
- every production Zustand store is accounted for;
- every Dexie table and meaningful persisted client state is accounted for;
- every learning-related API/state subsystem is named;
- production paths are distinguished from tests/docs/dead code;
- findings cite concrete files/symbols;
- document clearly distinguishes observation from architectural recommendation.

---

## W1-02 — State authority map

**Priority:** P0  
**Goal:** Determine which states currently claim learning truth and where conflicts exist.

**Deliverables:**
- `STATE_AUTHORITY.md`;
- authority matrix for evidenceEvents, legacy learning attempts/records, progress/course state, daily plan, weak spots, FSRS, CEFR/assessment, pronunciation progress, Speak history, mission state and other discovered learning state;
- disposition for each subsystem: KEEP / ADAPT / DEMOTE / RETIRE / DELETE CANDIDATE.

**Dependencies:** W1-01.

**Acceptance criteria:**
For each state:
- storage location identified;
- writers identified;
- readers identified;
- semantic claim stated;
- current authority stated;
- future authority stated;
- conflict risk stated;
- reload/sync behavior stated;
- disposition justified.

No subsystem may be marked for deletion solely because it "looks legacy."

---

## W1-03 — Security and privacy audit

**Priority:** P1  
**Goal:** Identify material security/privacy risks before more features inherit them.

**Deliverables:**
- findings classified CRITICAL/HIGH/MEDIUM/LOW/INFO;
- credential/API-key path review;
- auth/session/account-switch review;
- learner isolation review;
- cloud sync/export/delete/restore review;
- import SSRF/XSS/file-validation review;
- expensive API abuse/rate-limit review;
- speech/audio lifecycle review without changing Speech implementation.

**Dependencies:** W1-01.

**Acceptance criteria:**
- each HIGH/CRITICAL finding has reproduction or concrete data-flow evidence;
- false positives are removed;
- no raw secret is copied into report;
- severe bounded defects may be fixed only with regression tests;
- broader fixes are converted into explicit backlog items for later waves.

---

## W1-04 — Dependency, asset and license provenance audit

**Priority:** P1  
**Goal:** Know what FlashDay legally and operationally inherits.

**Deliverables:**
- `LICENSE_MATRIX.md`;
- direct production dependency inventory;
- notable runtime/bundle/maintenance risks;
- bundled content/model/font/audio/image provenance classifications.

**Dependencies:** W1-01.

**Acceptance criteria:**
- repository license is not treated as proof of all asset licenses;
- AGPL/GPL/copyleft boundaries are explicitly identified;
- model code, model weights and dataset licenses are separated where applicable;
- unknown provenance is labeled `UNKNOWN — BLOCK REUSE`;
- no mass dependency upgrade is performed.

---

## W1-05 — i18n and Chinese-first assumption inventory

**Priority:** P0  
**Goal:** Determine every active place where EchoType assumes English/Chinese UI or Chinese translation target.

**Deliverables:**
- `VIETNAMIZATION_AUDIT.md` baseline section;
- registered namespace inventory;
- all active binary language branches;
- all active `zh`, `zh-CN`, Chinese default occurrences classified as legitimate support vs inherited default.

**Dependencies:** W1-01, W1-02.

**Acceptance criteria:**
- language store initialization path traced;
- dictionary/provider/html-lang path traced;
- settings selector path traced;
- translation target defaults traced across stores/API/UI;
- tests/current migration behavior documented;
- active vs dead occurrences distinguished.

---

## W1-06 — Vietnamese first-class UI language

**Priority:** P0  
**Goal:** Make Vietnamese the fresh-install product default without breaking explicit existing choices.

**Deliverables:**
- UI language type supports `vi | en | zh`;
- fresh install defaults to Vietnamese;
- explicit saved English/Chinese survives;
- `<html lang>` tracks active language;
- language selector exposes Tiếng Việt / English / 中文;
- safe migration for corrupt/unsupported saved values.

**Dependencies:** W1-05.

**Acceptance criteria:**
- fresh en-US browser → Vietnamese;
- fresh zh-CN browser → Vietnamese;
- fresh vi-VN browser → Vietnamese;
- saved en → en after reload;
- saved zh → zh after reload;
- switching language updates immediately and persists;
- invalid saved locale fails safely without erasing unrelated data.

---

## W1-07 — Vietnamese support/translation default and Chinese-default cleanup

**Priority:** P0  
**Goal:** Separate UI language from learner support language and make Vietnamese the default support target.

**Deliverables:**
- centralized default translation/support target `vi`;
- Vietnamese added to target-language selector;
- hard-coded Chinese-first defaults removed from active production flows;
- existing explicit target preference preserved.

**Dependencies:** W1-05, W1-06.

**Acceptance criteria:**
- fresh user target = vi;
- explicit existing target remains unchanged;
- no active production flow silently forces zh/zh-CN because of inherited default;
- legitimate Chinese feature support remains functional;
- UI language changes do not automatically overwrite an explicit translation target.

---

## W1-08 — Vietnamese namespace parity and user-visible regression suite

**Priority:** P1  
**Goal:** Prevent "Vietnamese supported" from meaning partial fallback to English.

**Deliverables:**
- real Vietnamese values for every active production namespace;
- key parity test en↔vi↔zh;
- Playwright coverage for major reachable surfaces;
- regression test against direct binary `zh ? : en` branching where practical.

**Dependencies:** W1-06, W1-07.

**Acceptance criteria:**
- missing Vietnamese production key fails tests;
- Dashboard/Today, Mission entry, Library/import, Listen, Read, Write, Speak entry, Settings and applicable auth surfaces render Vietnamese;
- no silent fallback caused by missing namespace on those surfaces;
- reload/navigation preserves language;
- PR #1 typed mission path still works.

---

## W1-09 — Audit synthesis, exact-head verification and draft PR

**Priority:** P0  
**Goal:** Close Wave 1 with an evidence-backed architecture decision package.

**Deliverables:**
- all four required audit docs complete;
- exact-head gate results;
- unresolved findings converted into Wave 2 backlog;
- draft PR with exact base/head and limitations.

**Dependencies:** W1-02, W1-03, W1-04, W1-08.

**Acceptance criteria:**
- typecheck/lint/Biome/Vitest/relevant Playwright/full repo-required gate pass on exact final HEAD;
- CI status is reported honestly as CI or local only;
- no commit landed after verification without rerun;
- PR #2 remains untouched;
- no architecture cleanup beyond bounded approved fixes;
- report ends `READY FOR EXTERNAL REVIEW` or `BLOCKED`.

---

# WAVE 1 EXIT GATE

Wave 2 may start only when all are true:

1. W1-09 is externally reviewed.
2. The authority map is accepted as sufficiently complete.
3. Vietnam-first behavior is green.
4. No unresolved CRITICAL security defect makes consolidation unsafe.
5. The user explicitly allows architecture consolidation to begin.

---

# WAVE 2 — Architecture Consolidation / Legacy Authority Cleanup

## Wave objective

Move from "we know the duplicate systems" to "FlashDay has one coherent learner truth and one planner authority," while preserving compatibility and replayability.

Wave 2 must be decomposed into bounded PRs. Do not perform a single repo-wide rewrite.

---

## W2-00 — Architecture decision record and migration plan

**Priority:** P0  
**Goal:** Convert Wave 1 dispositions into an explicit migration order.

**Deliverables:**
- ADR defining authoritative state owners;
- ordered subsystem migration plan;
- compatibility/backfill/rollback approach;
- list of state writes to freeze first.

**Dependencies:** Wave 1 exit gate.

**Acceptance criteria:**
- every RETIRE/DELETE CANDIDATE has a consumer migration path;
- every ADAPT/DEMOTE state has its future semantics defined;
- no destructive step lacks rollback/replay strategy;
- migration order avoids circular dependencies.

---

## W2-01 — Freeze conflicting semantic writes

**Priority:** P0  
**Goal:** Stop new contradictory learning truth from being created before deletion/migration.

**Deliverables:**
- identified legacy semantic writers disabled, redirected or marked non-authoritative;
- compatibility reads retained where required;
- regression tests showing legacy surfaces still function without minting competing mastery.

**Dependencies:** W2-00.

**Acceptance criteria:**
- no chosen legacy system can independently mint a mastery/proficiency claim that contradicts FlashDay projection;
- old UI/history may still display legacy data where intentionally retained;
- state freeze does not destroy existing user data.

---

## W2-02 — Planner authority consolidation

**Priority:** P0  
**Goal:** Establish one "what should learner do next?" authority.

**Deliverables:**
- legacy daily planner classified/redirected/demoted;
- Next For You uses the accepted learner projection + memory inputs;
- planner reason remains inspectable;
- duplicate scheduling logic removed from decision authority.

**Dependencies:** W2-00, W2-01.

**Acceptance criteria:**
- one production planner owns next learning action;
- no legacy planner silently overrides it;
- memory due-ness can influence selection without equaling proficiency;
- selected task always carries a reason;
- deterministic reference mode remains available for falsification.

---

## W2-03 — Learner-state authority consolidation

**Priority:** P0  
**Goal:** Demote legacy weak-spots/progress/course/accuracy semantics to derived/history/presentation where retained.

**Deliverables:**
- adapters/projections replacing direct authoritative reads;
- write paths redirected or frozen;
- UI mappings updated;
- migration tests.

**Dependencies:** W2-00, W2-01.

**Acceptance criteria:**
- evidence projection is the ability source of truth for migrated capabilities;
- course completion no longer implies mastery;
- accuracy/activity records do not mint proficiency;
- weak-spots data is either derived from evidence or explicitly non-authoritative;
- reload/replay remains deterministic.

---

## W2-04 — FSRS/memory boundary hardening

**Priority:** P1  
**Goal:** Make the MemoryState ≠ ProficiencyState boundary architectural, not documentary.

**Deliverables:**
- explicit memory-domain interfaces;
- capability-domain interfaces;
- integration seam used by planner;
- regression tests preventing direct FSRS→mastery writes.

**Dependencies:** W2-02, W2-03.

**Acceptance criteria:**
- FSRS outputs affect scheduling only;
- no FSRS state transition can directly promote capability state;
- planner can combine memory due-ness and capability need without merging their schemas.

---

## W2-05 — Replay, migration and compatibility verification

**Priority:** P0  
**Goal:** Prove consolidation does not reinterpret or lose learner history.

**Deliverables:**
- migration/backfill tests where needed;
- replay identity tests;
- old-state compatibility fixtures;
- account/sync/reload scenarios.

**Dependencies:** W2-03, W2-04.

**Acceptance criteria:**
- same accepted evidence set reproduces the same learner projection;
- migration is idempotent;
- interrupted migration is recoverable;
- old users do not silently lose explicit preferences/history;
- multi-tab/sync does not create duplicate semantic truth.

---

## W2-06 — Retire obsolete authority surfaces

**Priority:** P1  
**Goal:** Remove code only after its writers/readers have migrated.

**Deliverables:**
- obsolete authority modules retired;
- dead state fields/tables scheduled or removed with migration;
- docs updated;
- deprecation telemetry if required.

**Dependencies:** W2-02, W2-03, W2-05.

**Acceptance criteria:**
- no production reader remains for deleted state;
- no write path remains;
- tests prove user-facing flow still works;
- deletion does not break historical display/export if those are promised.

---

## W2-07 — Architecture consolidation verification

**Priority:** P0  
**Goal:** Establish a clean foundation for Speech and future multimodal features.

**Deliverables:**
- consolidated architecture diagram;
- updated state-authority document;
- exact-head full verification;
- draft PR(s) or final consolidation PR set ready for external review.

**Dependencies:** W2-05, W2-06.

**Acceptance criteria:**
- one learner ability authority;
- one planner authority;
- FSRS isolated to memory;
- no known duplicate mastery writer remains in active product path;
- all migrations tested;
- exact-head gates green;
- user explicitly approves Wave 2 completion before Wave 3 implementation work.

---

# WAVE 2 EXIT GATE

Wave 3 implementation may begin only when:

1. learner ability authority is consolidated;
2. planner authority is consolidated;
3. FSRS boundary is enforced;
4. replay/migration tests pass;
5. Speech PR #2 is still draft or intentionally superseded;
6. the user explicitly resumes Speech/Pronunciation work.

Research tasks W3-01/W3-02/W3-03 may be prepared near the end of Wave 2 only if they do not modify Speech production code.

---

# WAVE 3 — Speech / Pronunciation Research Lab + Production Path

## Wave objective

Build a high-quality speaking/pronunciation path by first learning from top products, then benchmarking free/open technologies, then integrating only the components that meet FlashDay's evidence, quality, privacy and cost requirements.

Free/open/local is preferred when quality is competitive.

---

## W3-00 — Speech research mission and benchmark harness

**Priority:** P0  
**Goal:** Define how Speech decisions will be measured before choosing technology.

**Deliverables:**
- Speech research mission;
- benchmark dimensions;
- test corpus policy;
- hardware/runtime matrix;
- candidate registry;
- cost/privacy/license comparison template.

**Dependencies:** Wave 2 exit gate for production work; may be drafted earlier.

**Acceptance criteria:**
- metrics include accuracy, false positives/negatives where applicable, latency, memory/CPU/GPU, Vietnamese-accent robustness, privacy, license, offline/platform support;
- product research and technology research are separate artifacts;
- no candidate is pre-selected as winner.

---

## W3-01 — Top-product speaking/pronunciation benchmark

**Priority:** P0  
**Goal:** Extract proven/strong interaction mechanics before designing FlashDay's flow.

**Products to study at minimum:**
- ELSA Speak;
- Speak;
- Loora;
- BoldVoice;
- Speechling;
- Praktika;
- relevant Duolingo speaking/conversation features.

**Deliverables:**
- product comparison matrix;
- concrete mechanics to adopt/test;
- mechanics explicitly rejected;
- FlashDay flow hypotheses;
- evidence-contract implications.

**Dependencies:** W3-00.

**Acceptance criteria:**
- comparison is mechanic-level, not marketing-summary level;
- correction timing, feedback density, retry/repair loop, learner control and conversation flow are covered;
- engagement mechanics are separated from learning mechanics;
- every adopted mechanic maps to a learner problem and measurable outcome.

---

## W3-02 — Free/open speech technology benchmark

**Priority:** P0  
**Goal:** Determine the best practical stack rather than using the easiest API.

**Candidates at minimum:**
- browser Web Speech transport;
- whisper.cpp;
- faster-whisper;
- sherpa-onnx;
- Silero VAD;
- CMUdict;
- forced alignment tooling;
- Wav2Vec2/phoneme models;
- OpenPronounce;
- any clearly superior current open candidate discovered during research.

**Deliverables:**
- benchmark matrix;
- reproducible scripts/configs;
- exact model/version provenance;
- deployment cost estimates;
- architecture recommendation with fallback.

**Dependencies:** W3-00.

**Acceptance criteria:**
- exact model versions are pinned;
- free/open options are benchmarked, not dismissed by reputation;
- paid/proprietary options are included only when they may materially improve a product-critical metric;
- if a paid option wins, quality gap, cost, lock-in and fallback are documented;
- no model is granted pronunciation authority based on README claims alone.

---

## W3-03 — Vietnamese-accent evaluation protocol

**Priority:** P0  
**Goal:** Prevent pronunciation scoring from being calibrated only on other accents.

**Deliverables:**
- consent/legal-data protocol;
- Vietnamese-English test set design;
- target phoneme/contrast list;
- human annotation rubric;
- precision/recall/false-alarm metrics;
- minimum evidence required before authority promotion.

**Dependencies:** W3-00.

**Acceptance criteria:**
- no fabricated or license-unsafe product corpus;
- evaluation separates transcript accuracy from pronunciation diagnostic accuracy;
- human reference labels are part of the protocol;
- false positives receive explicit weight because wrong pronunciation correction is harmful;
- "insufficient data" is an acceptable outcome.

---

## W3-04 — Rebase/reopen Speech path and fix native stop/final ordering

**Priority:** P0  
**Goal:** Resume the existing Speech path only after architecture consolidation and reproduce the known lifecycle bug before fixing it.

**Deliverables:**
- refreshed branch or replacement branch on accepted post-Wave-2 base;
- regression reproducing final-result-after-stop ordering;
- lifecycle fix.

**Dependencies:** W3-01, W3-02, Wave 2 exit gate.

**Acceptance criteria:**
- regression fails before fix and passes after;
- `stop()` cannot lose a valid late final transcript;
- interim still cannot commit;
- errors/permission/no-speech states remain honest;
- no Speech capture can mint stronger semantic authority than allowed.

---

## W3-05 — Complete speech capture provenance

**Priority:** P0  
**Goal:** Make durable Speech evidence replayable and attributable.

**Deliverables:**
- capture provenance includes provider and exact model/version where available;
- server route returns actual provider/model after fallback;
- persistence/reload tests;
- fallback-chain provenance.

**Dependencies:** W3-02, W3-04.

**Acceptance criteria:**
- event can answer "which recognizer/model produced this transcript?";
- replay never infers historical model from today's configuration;
- fallback provider/model is the one actually used, not requested;
- unavailable confidence remains null, not fabricated.

---

## W3-06 — Real-device microphone and fallback smoke

**Priority:** P1  
**Goal:** Prove the transport path works outside test doubles.

**Deliverables:**
- physical microphone smoke procedure;
- at least one real browser run;
- fallback-path run where feasible;
- captured evidence inspection.

**Dependencies:** W3-04, W3-05.

**Acceptance criteria:**
- permission → capture → final transcript → learner review → commit works;
- stored capture provenance is correct;
- refresh/cancel/error paths mint no phantom attempt;
- virtual hardware tests remain for deterministic CI, but are not presented as physical-mic proof.

---

## W3-07 — Acoustic/pronunciation evaluator experiment

**Priority:** P1  
**Goal:** Decide whether OpenPronounce or another candidate is useful and at what authority level.

**Deliverables:**
- benchmark on legally usable evaluation material;
- Vietnamese-accent pilot when data exists;
- per-word/per-phoneme precision/recall;
- false-positive analysis;
- latency/runtime footprint;
- authority recommendation.

**Dependencies:** W3-02, W3-03.

**Acceptance criteria:**
- evaluator may be classified as feedback-only, diagnostic, or calibrated authority;
- no direct mastery integration if evidence is insufficient;
- OpenPronounce remains `EXPERIMENT MORE` unless new benchmark evidence justifies change;
- product decision accounts for runtime/ops cost, not accuracy alone.

---

## W3-08 — Speaking correction and repair-loop UX

**Priority:** P1  
**Goal:** Apply product-benchmark lessons without flooding learners with corrections.

**Deliverables:**
- correction-prioritization rule;
- conversation-preserving feedback flow;
- repair drill;
- self-listen/retry path where useful;
- UX tests/prototype.

**Dependencies:** W3-01, W3-06, W3-07 findings.

**Acceptance criteria:**
- learner is not shown every detected issue indiscriminately;
- 1–3 high-value corrections can be prioritized;
- correction produces an opportunity to repair;
- feedback source/provenance is visible internally;
- feedback-only signals do not mint mastery.

---

## W3-09 — Speech evidence-contract integration

**Priority:** P0  
**Goal:** Integrate Speech into FlashDay without weakening the evidence doctrine.

**Deliverables:**
- explicit contracts for communicative speaking vs pronunciation evidence;
- ASR capture path;
- acoustic diagnostic path if qualified;
- planner/session integration;
- delayed/transfer behavior where appropriate;
- regression suite.

**Dependencies:** W3-05, W3-08.

**Acceptance criteria:**
- ASR transcript success alone cannot mint independent pronunciation/intelligibility;
- communicative semantic scoring and acoustic pronunciation scoring remain separate;
- support use contaminates only the proper attempt;
- delayed retrieval/transfer require valid evidence;
- replay is deterministic;
- typed fallback remains available and semantically honest.

---

## W3-10 — Exact-head Speech verification and review verdict

**Priority:** P0  
**Goal:** Close Wave 3 with a defensible production decision.

**Deliverables:**
- exact-head unit/integration/E2E results;
- hardware-smoke result;
- benchmark report;
- model/provider provenance report;
- privacy/license summary;
- draft PR ready for external review.

**Dependencies:** W3-09.

**Acceptance criteria:**
- no stale test count;
- CI/local distinction explicit;
- known limitations listed;
- no unresolved P0 Speech semantic bug;
- any pronunciation authority claim is backed by benchmark evidence;
- final report ends `READY FOR EXTERNAL REVIEW` or `BLOCKED`;
- no merge without explicit user instruction.

---

# WAVE 3 EXIT GATE

Wave 3 is complete only when:

1. product and technology research are documented;
2. free/open candidates were genuinely benchmarked;
3. Speech capture is reliable and provenance-complete;
4. physical microphone smoke succeeds;
5. pronunciation scoring authority is explicitly bounded;
6. ASR and pronunciation semantics remain separated;
7. exact-head gates are green;
8. external review returns OK TO MERGE or blocker findings are resolved;
9. user explicitly authorizes merge.

---

# Execution order by priority

## Immediate queue

1. **W1-00** — baseline/factory
2. **W1-01** — architecture inventory
3. **W1-02** — state authority
4. **W1-05** — i18n/Chinese-first inventory
5. **W1-06** — Vietnamese UI default
6. **W1-07** — Vietnamese translation/support default
7. **W1-08** — namespace parity/E2E

Parallel after W1-01:
- **W1-03** security/privacy
- **W1-04** dependency/license

Then:
- **W1-09** synthesis and external review

## After Wave 1 approval

1. **W2-00** ADR/migration plan
2. **W2-01** freeze conflicting writes
3. **W2-02** planner authority
4. **W2-03** learner-state authority
5. **W2-04** FSRS boundary
6. **W2-05** replay/migration verification
7. **W2-06** retire obsolete authority surfaces
8. **W2-07** consolidation review

## After Wave 2 approval / Speech resume

1. **W3-00** benchmark harness
2. **W3-01** product benchmark
3. **W3-02** open/free technology benchmark
4. **W3-03** Vietnamese-accent evaluation protocol
5. **W3-04** native Speech lifecycle fix
6. **W3-05** provenance completion
7. **W3-06** physical-mic smoke
8. **W3-07** pronunciation evaluator experiment
9. **W3-08** correction/repair UX
10. **W3-09** evidence-contract integration
11. **W3-10** final verification/review

---

# Global execution rules

For every backlog item:

- read the current master plan first;
- clean base;
- exact starting SHA;
- factory-first;
- research before major feature design;
- reproduce before fixing a defect;
- regression test before implementation where practical;
- adversarial/counterexample testing;
- no semantic claim without evidence;
- no hidden source-of-truth changes;
- exact-head verification after final commit;
- local verification must not be called CI;
- draft PR first;
- never merge without explicit user instruction.

Backlog items may be split into smaller missions if necessary, but dependencies and wave gates may not be weakened without explicit review.
