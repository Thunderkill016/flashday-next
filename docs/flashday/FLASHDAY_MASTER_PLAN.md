# FlashDay Next — Master Product, Learning & Engineering Plan

**Status:** canonical living roadmap  
**Research refresh:** 2026-10-02  
**Repository:** `Thunderkill016/flashday-next`

This document is the project-level source of direction for FlashDay Next.

Individual missions may refine implementation details, but they must not silently change:

- learning authority;
- product doctrine;
- research gates;
- technology-selection rules;
- privacy/license rules;
- wave sequencing;
- merge authority.

If implementation and this document disagree, stop and review the disagreement explicitly.

---

# 1. Product thesis

FlashDay is not another collection of exercises and it is not an EchoType reskin.

The product goal is:

> Build a Vietnam-first English-learning system that can observe what a learner actually did, distinguish exposure from supported success and independent ability, schedule the right next action, and gradually move learning from guided practice to durable recall and changed-context transfer.

The system should support two complementary modes:

1. **Guided learning**
   - curriculum/capability goals;
   - missions;
   - diagnosis;
   - structured practice;
   - retrieval;
   - transfer;
   - assessment.

2. **Learn from real content**
   - video;
   - audio;
   - articles;
   - books;
   - transcripts;
   - learner-imported material;
   - vocabulary/sentence mining;
   - comprehension-aware difficulty.

Both modes must converge on the **same learner model**.

There must not be one progress system for courses and another contradictory system for immersion.

---

# 2. Current repository baseline

Foundation PR #1 is merged:

`27191be48e43a6a6a0470fe41d95b6183b0e9dc7`

It established the first evidence-kernel vertical slice.

Speech PR #2 remains a draft:

- branch: `flashday/speech-path`
- reviewed HEAD: `5932e31f4887e88367da21362e6de56b57755030`

PR #2 is intentionally frozen while architecture/Vietnam-first work is active.

Do not:

- merge PR #2;
- cherry-pick it into architecture work;
- continue OpenPronounce integration before the Speech research wave.

---

# 3. Non-negotiable learning doctrine

FlashDay must never collapse distinct claims into one progress score.

```text
activity       ≠ learning
exposure       ≠ successful recall
success        ≠ independent success
independence   ≠ retention
retention      ≠ transfer
memory         ≠ proficiency
course position ≠ observed ability
STT transcript ≠ pronunciation evidence
AI feedback    ≠ learner ability
lesson completion ≠ mastery
```

FSRS is a **memory scheduler**.

It is not:

- a proficiency estimator;
- a speaking score;
- a capability graph;
- a CEFR classifier.

The UI does not author learning truth.

Execution surfaces may report observed reality:

- task shown;
- support used;
- learner response;
- latency;
- audio/transcript provenance;
- feedback delivered.

The FlashDay kernel/evaluator decides what semantic evidence that observation supports.

---

# 4. Learning-science foundation

The product must be designed around mechanisms with credible support, while avoiding claims stronger than the evidence.

## 4.1 Retrieval before passive repetition

Important knowledge and constructions should eventually require retrieval from memory.

A learning loop should not end at:

```text
see → understand → mark complete
```

It should progress toward:

```text
encounter
→ comprehend
→ supported retrieval
→ unsupported retrieval
→ delayed retrieval
→ changed-context use
```

## 4.2 Spacing

Long-term memory needs re-verification after meaningful delay.

FlashDay should schedule memory resurfacing using FSRS or a validated memory scheduler, but the resulting due date is only a memory decision.

A due card does not mean a capability has been lost.

A high FSRS stability value does not mean a learner can perform a communicative capability.

## 4.3 Feedback followed by repair

Feedback should create another opportunity to perform correctly.

Preferred loop:

```text
attempt
→ diagnostic feedback
→ focused repair
→ retry
→ later independent use
```

Avoid feedback that simply shows the answer and immediately upgrades learner state.

## 4.4 Transfer

The product should deliberately test whether a learner can use an ability in a meaningfully changed context.

Examples:

- different partner;
- different wording;
- different setting;
- different surface vocabulary;
- different media;
- different prompt family.

A rehearsed prompt must not be re-labelled as transfer.

## 4.5 Progressive support

Support is a legitimate learning tool, but support-bearing success must remain distinguishable from unaided success.

Examples of answer-bearing support:

- model answer;
- translation;
- transcript reveal;
- strong hint.

Support usage belongs permanently to that attempt's evidence history.

## 4.6 Metacognition without self-report inflation

FlashDay can ask:

- confidence;
- perceived difficulty;
- preference;
- fatigue;
- goals.

Those signals can guide scheduling and UX.

They must not directly mint independent ability.

---

# 5. Capability and evidence model

Target state ladder:

```text
NOT_SEEN
→ EXPOSED
→ SUPPORTED
→ INDEPENDENT
→ RETAINED
→ TRANSFERRED
→ FLUENT
```

`FLUENT` stays reserved until FlashDay has calibrated evidence for the construct.

## 5.1 Capability graph

Capabilities represent things a learner can meaningfully understand or do.

Examples:

- understand a basic greeting;
- greet someone;
- understand a name question;
- state own name;
- ask another person's name;
- repair a misunderstanding;
- understand a clock time.

Hard graph edges are allowed only for **true performance dependencies**.

Use this test:

> If capability A were absent, could capability B still be meaningfully performed and evaluated?

If yes, A should probably not be a hard prerequisite for B.

Pedagogical order belongs in:

- mission sequencing;
- recommended-after relationships;
- planner policy;
- curriculum composition.

Do not disguise lesson order as dependency.

## 5.2 Evidence events

Learner evidence must be append-only and replayable.

Important fields include:

- learner;
- registered task/revision;
- capability binding;
- event type;
- time;
- response;
- outcome;
- support history;
- context;
- evaluator authority;
- capture provenance;
- attempt id;
- mission/run provenance.

Identical redelivery should dedupe.

Same event identity with different payload must fail closed.

## 5.3 Evaluation authority

Different signals have different authority.

Examples:

- deterministic evaluator;
- calibrated human judgment;
- ASR;
- acoustic evaluator;
- AI/LLM feedback;
- self-report.

An authority is not automatically trusted for every claim.

Example:

```text
ASR transcript
→ may support "recognizer heard these words"
→ does NOT prove pronunciation quality
→ does NOT prove intelligibility by itself
```

## 5.4 Projection

Learner state is derived by replay.

Do not maintain another mutable “mastery score” that competes with replay-derived evidence.

Derived views may exist for:

- UI;
- analytics;
- caching;
- planner performance.

They must remain reconstructible or clearly non-authoritative.

---

# 6. Target system architecture

Long-term logical architecture:

```text
               ┌───────────────────────┐
               │   Content Registry    │
               │ source/license/meta   │
               └───────────┬───────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │   Capability Graph    │
               └───────────┬───────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │ Mission / Task Specs  │
               └───────────┬───────────┘
                           │
                           ▼
Learner ──► Execution Surfaces ──► Evidence Bridge
                                       │
                                       ▼
                              Append-only Evidence
                                       │
                        ┌──────────────┼──────────────┐
                        ▼              ▼              ▼
                 Learner Projection  Memory Model   Analytics
                        │              │
                        └──────┬───────┘
                               ▼
                        Planner / Next For You
                               │
                               ▼
                         Next Learning Action
```

Execution surfaces:

- Today / Next For You;
- Mission;
- Listen;
- Speak;
- Read;
- Write;
- Review;
- Imported Content;
- AI Tutor.

They are consumers/producers of evidence, not competing learner models.

---

# 7. Universal feature rule — research before build

Every meaningful feature or major feature replacement must begin with two explicit research passes.

## 7.1 Product benchmark

Identify strong products solving the same learner problem.

Research:

- actual interaction loop;
- progression;
- correction timing;
- feedback density;
- learner control;
- failure behavior;
- accessibility;
- monetization constraints;
- engagement mechanics;
- what users must repeatedly do.

Extract mechanics, not screenshots.

For each mechanic record:

```text
learner problem
mechanic
why it may work
evidence generated
FlashDay capability affected
risk
how to falsify it
```

## 7.2 Technology benchmark

Evaluate realistic technologies before committing architecture.

Compare:

- quality/accuracy;
- false-positive/false-negative behavior;
- latency;
- reliability;
- memory/CPU/GPU;
- browser support;
- Android/iOS feasibility;
- offline use;
- privacy;
- security;
- commercial-use license;
- model/data provenance;
- maintenance health;
- integration complexity;
- testability;
- vendor lock-in;
- migration path;
- total operating cost.

## 7.3 Free/open-first policy

Preferred order:

```text
high-quality local/open solution
        ↓
high-quality self-hosted open solution
        ↓
free-tier external service
        ↓
paid/proprietary solution
```

But free is not the quality bar.

A free/open option wins only when it is good enough for the learner-facing requirement.

If a paid/proprietary technology wins, document:

- measured advantage;
- learner impact;
- expected cost;
- privacy trade-off;
- lock-in risk;
- fallback;
- replacement path.

Provider seams should make future replacement possible without changing learning semantics.

---

# 8. Feature research blueprint

This is the default benchmark set. Missions may add newer/better competitors.

## 8.1 Today / Next For You

Goal:

One clear next useful action, with an understandable reason.

Research:

- Duolingo personalized practice/path;
- Anki review queue behavior;
- adaptive learning systems;
- recommendation/ranking systems.

FlashDay should optimize for learning need, not maximum session length.

Planner inputs may include:

- capability gaps;
- recent failures;
- missing-function demand;
- memory due-ness;
- required delayed retrieval;
- transfer requirement;
- learner goal;
- time available;
- fatigue/load;
- content interests.

Planner output must remain explainable.

Avoid opaque ML ranking until it demonstrably beats a deterministic inspectable policy.

## 8.2 Mission / guided path

Research:

- Duolingo progression;
- Speak's Learn → Practice → Apply structure;
- structured CEFR-aligned products;
- scenario-based tutors.

Mission shape:

```text
diagnostic
→ input/noticing
→ comprehension
→ supported production
→ independent production
→ remediation if required
→ delayed retrieval
→ transfer
→ assessment
```

Not every capability requires every stage, but skipped stages must be a deliberate contract decision.

## 8.3 Listen

Benchmark:

- Language Reactor;
- Speechling;
- LingQ;
- Migaku;
- asbplayer;
- strong dictation/shadowing workflows.

Mechanics worth evaluating:

- precise sentence replay;
- auto-pause;
- variable speed;
- transcript hidden/reveal;
- bilingual support;
- dictation;
- repeat counting;
- comprehension checks;
- shadowing only after comprehension;
- subtitle navigation;
- saved sentence with context.

Potential free/open technology areas:

- Web Audio API;
- standard subtitle parsers;
- local audio processing;
- ffmpeg where server/native use is justified;
- VAD;
- alignment;
- local TTS/ASR where useful.

Do not equate replay count with learning.

## 8.4 Speak / Pronunciation

Benchmark:

- ELSA Speak;
- Speak;
- Loora;
- BoldVoice;
- Speechling;
- Praktika;
- Duolingo conversation/video-call work.

Study separately:

1. communicative speaking;
2. pronunciation;
3. fluency;
4. grammar/lexical accuracy;
5. repair strategies.

A single score must not collapse these constructs.

Desired correction strategy:

```text
conversation
→ preserve flow
→ capture errors
→ choose 1–3 high-value corrections
→ focused repair
→ retry
→ later reappearance
```

Technology candidates to benchmark:

- whisper.cpp;
- faster-whisper;
- sherpa-onnx;
- Silero VAD;
- CMUdict;
- forced alignment;
- phoneme recognition models;
- OpenPronounce;
- better future open models.

Speech provenance should preserve:

- capture mode;
- authority class;
- provider;
- exact model/version;
- final/interim;
- genuine confidence if available;
- processing path.

## 8.5 Read / Immersion

Benchmark:

- LingQ;
- Migaku;
- Language Reactor;
- Readlang;
- Lute;
- Learning With Texts.

Core mechanics:

- instant word/phrase lookup;
- context preserved;
- known/learning/new state;
- lexical coverage;
- content difficulty estimate;
- sentence capture;
- minimal interruption;
- resume position;
- audio/text synchronization when available.

Important distinction:

Word knownness is useful for **input difficulty**.

It must not become a complete proficiency model.

## 8.6 Write

Benchmark:

- language-learning writing tools;
- strong correction UX;
- LanguageTool;
- relevant AI writing tutors.

Desired loop:

```text
prompt
→ learner writes
→ deterministic diagnostics where possible
→ semantic/style feedback
→ learner repairs
→ compare
→ later fresh writing task
```

Separate:

- spelling;
- grammar;
- syntax;
- lexical choice;
- coherence;
- task fulfilment.

An AI rewrite is feedback, not evidence that the learner can produce the rewrite.

Technology candidates:

- LanguageTool or comparable deterministic diagnostics;
- open grammar/style tooling;
- provider-abstracted LLM feedback;
- local/open models when quality is sufficient.

## 8.7 Vocabulary / Chunks

Benchmark:

- Anki;
- Migaku;
- LingQ;
- modern SRS products.

Prefer useful lexical units:

- words;
- collocations;
- chunks;
- constructions;
- sentence patterns.

Track:

- context encountered;
- sense;
- production/reception distinction;
- source;
- frequency;
- support;
- review history.

Avoid thousands of contextless cards as the default product experience.

## 8.8 Review / SRS

Benchmark:

- Anki FSRS;
- current FSRS ecosystem;
- validated spacing/retrieval research.

FSRS decides **when memory should be tested**.

FlashDay decides **what kind of performance proves a capability**.

Review queue can include:

- lexical memory;
- chunks;
- listening retrieval;
- production prompts;
- repaired errors.

Do not force all learning evidence into flashcards.

## 8.9 Assessment / Placement

Use CEFR as a reference framework where appropriate, not as a magical score.

Research:

- official CEFR descriptors;
- adaptive testing;
- receptive/productive assessment;
- placement systems.

Assessment requirements:

- fresh prompts;
- no leaked model answer;
- stable attempt identity;
- held-out items;
- modality separation;
- meaningful task coverage;
- explicit uncertainty.

A short multiple-choice test must not claim full CEFR speaking/writing proficiency.

## 8.10 AI Tutor / Conversation

Benchmark:

- Speak Tutor;
- Loora;
- Praktika;
- Duolingo conversation/video-call experiences;
- future top AI language tutors.

AI tutor responsibilities may include:

- role-play;
- conversation continuation;
- scenario adaptation;
- error collection;
- explanation;
- generating controlled variants.

It must not directly mutate mastery.

Architecture:

```text
LLM output
→ structured proposal/feedback
→ deterministic/schema validation
→ evidence contract
→ only allowed claims enter learner model
```

Model routing must stay provider-agnostic.

Benchmark open/local models against commercial frontier models periodically.

## 8.11 Translation and Vietnamese learner support

Translation is scaffolding.

It is not mastery.

Research:

- contextual dictionary UX;
- bilingual explanations;
- DeepL/Google-style interaction patterns;
- AI contextual explanation;
- open translation models.

Vietnamese explanations should prioritize:

- concise meaning;
- usage difference;
- common Vietnamese learner confusion;
- examples;
- optional deeper detail.

Default support language for new users: Vietnamese.

## 8.12 TTS

Benchmark:

- naturalness;
- English intelligibility;
- accent quality;
- latency;
- streaming;
- browser/mobile footprint;
- commercial license;
- offline capability.

Candidate open technologies include Kokoro and future open models.

Do not hard-code one TTS vendor into evidence or content data.

Store voice/model provenance where generated audio becomes a durable asset.

## 8.13 Import / Learn from Anything

Benchmark:

- Language Reactor;
- Migaku;
- LingQ;
- strong reader/import products.

Inputs may include:

- URL;
- YouTube;
- subtitle file;
- transcript;
- text;
- PDF;
- EPUB where supported;
- audio/video owned or lawfully provided by learner.

Pipeline:

```text
ingest
→ sanitize
→ provenance
→ segment
→ language detect
→ transcript/text normalize
→ lexical profile
→ difficulty
→ learning affordances
```

Security requirements:

- SSRF defense;
- file-size limits;
- MIME validation;
- sandboxed parsing where needed;
- HTML sanitization;
- no secret leakage;
- copyright-aware storage.

## 8.14 Search / Library

Core user jobs:

- resume what I was learning;
- find imported content;
- find saved words/sentences;
- see recent/important material;
- discover suitable content.

Start with simple indexes and metadata.

Do not introduce vector infrastructure merely because embeddings are fashionable.

Add semantic search only when benchmarked against actual learner tasks.

## 8.15 Auth / Sync / Backup

Goal:

Auth should disappear from the learner's attention.

Requirements:

- fast sign-in transition;
- offline use where possible;
- safe multi-device sync;
- conflict handling;
- learner isolation;
- export;
- backup;
- restore;
- deletion;
- account switching;
- recovery after interrupted writes.

Prefer user-owned/exportable data structures and avoid unnecessary vendor lock-in.

## 8.16 UI/UX

Benchmark learning products for learning effectiveness, not appearance alone.

Evaluate:

- cognitive load;
- feedback timing;
- interruption cost;
- touch ergonomics;
- keyboard navigation;
- accessibility;
- mobile layout;
- focus;
- progress communication;
- error recovery.

Avoid feature density inherited from EchoType if it obscures the next learner action.

## 8.17 Habit / Motivation

Study Duolingo's habit mechanics but separate motivation from learning evidence.

Potentially useful:

- clear daily goal;
- streak;
- reminder;
- comeback flow;
- visible progress;
- celebrations.

Do not allow:

- XP to substitute for learning;
- streak to substitute for retention;
- league pressure to determine curriculum;
- manipulative notifications;
- artificial urgency.

## 8.18 Accessibility

Every major interaction should have alternatives.

Requirements include:

- keyboard;
- screen-reader semantics;
- focus management;
- captions/transcripts;
- reduced motion;
- contrast;
- text scaling;
- typed alternative to speaking;
- visual alternative to audio-only instruction where pedagogically appropriate.

Accessibility support must not silently change evidence semantics.

---

# 9. Vietnam-first product policy

FlashDay is built first for Vietnamese learners of English while keeping architecture multilingual-capable.

UI languages:

- `vi`
- `en`
- `zh`

Fresh install:

```text
explicit saved UI preference
        ↓
Vietnamese
```

Browser locale must not override the product default.

Fresh support/translation target:

`vi`

Existing explicit `en` / `zh` preferences must survive migration.

UI language, source language, target learning language and translation language are separate fields.

Do not encode them as one `language` variable.

Vietnamese copy quality requirements:

- natural;
- concise;
- not literal machine translation;
- appropriate for Vietnamese learners;
- consistent terminology.

---

# 10. Content strategy — FlashDay owns the curriculum

EchoType's bundled phrases/scenarios are candidate material, not the future curriculum.

Long-term content architecture:

```text
Source Registry
      ↓
license/provenance validation
      ↓
Gold source material
      ↓
Capability extraction
      ↓
Mission construction
      ↓
lexical + grammar + context constraints
      ↓
controlled variant generation
      ↓
automatic QA
      ↓
human/gold review
      ↓
production curriculum
```

## 10.1 Source roles to validate

### VOA Learning English

Strong candidate for human-authored course/input seeds.

VOA's current usage page states Learning English texts, MP3s, photos and videos are public domain and may be reused for educational and commercial purposes with credit, while third-party agency assets such as AP/Reuters/AFP must be excluded.

Potential seed:

- Let's Learn English Level 1 — 52 lessons;
- Let's Learn English Level 2 — 30 lessons.

Never assume every asset on a page is VOA-owned; provenance remains asset-level.

### NGSL / NGSL-Spoken

Use as lexical-frequency/reference layer, not a curriculum.

Share-alike/attribution boundaries must be documented before redistribution.

### Tatoeba

Use as a candidate human sentence pool.

Text and audio have different licensing.

Every imported sentence needs attribution/provenance handling.

Filter for:

- naturalness;
- correctness;
- target function;
- lexical load;
- duplicates;
- cultural suitability.

### Open English WordNet

Use for lexical semantics:

- senses;
- synonyms;
- relations;
- semantic structure.

Do not expose raw dictionary prose as beginner teaching copy without learner-facing adaptation.

### CMUdict

Use as an English pronunciation lexicon/reference.

It is not a pronunciation scoring system.

### Gutenberg / LibriVox

Potential extensive-reading/listening sources.

Copyright status is jurisdiction-dependent.

Do not treat “found on Gutenberg” as universal worldwide public-domain proof.

### User-imported material

Useful for personalization, but copyright ownership and product-hosting rights differ from public curriculum rights.

Keep imported-source provenance.

## 10.2 AI-generated content

AI belongs near the end of the content pipeline.

Never:

```text
LLM
→ generate 10,000 sentences
→ production database
```

Generated material requires:

- schema validation;
- capability binding;
- lexical profiling;
- duplicate checking;
- naturalness review;
- safety review where relevant;
- provenance;
- review status.

Assessment items need stronger isolation and held-out controls.

---

# 11. Content object requirements

Canonical content should support fields such as:

```text
id
source
sourceVersion
sourceUrl/reference
license
attribution
derived
humanReviewed
reviewStatus

language
levelEstimate
capabilities
communicativeFunctions
grammar/constructions
targetVocabulary
supportVocabulary
context
register

media provenance
voice/model provenance
assessmentEligibility
```

Unknown provenance should fail closed for bundled commercial distribution.

---

# 12. Speech / pronunciation master plan

Speech development is paused until architecture review completes.

When resumed, Phase 0 is research, not implementation.

## 12.1 Product benchmark

Study at minimum:

- ELSA Speak;
- Speak;
- Loora;
- BoldVoice;
- Speechling;
- Praktika;
- Duolingo speaking/conversation features.

Key product lesson:

Do not destroy conversation flow by correcting everything immediately.

Collect errors, prioritize a small number of high-value corrections, then create a repair opportunity.

## 12.2 Technology benchmark

Candidate classes:

### ASR

- whisper.cpp;
- faster-whisper;
- sherpa-onnx;
- browser Web Speech only as one transport option, not learning authority.

### Voice activity

- Silero VAD;
- future benchmarked VAD alternatives.

### Pronunciation targets

- CMUdict;
- phonemizers;
- curated pronunciation variants.

### Alignment / acoustic diagnostics

- forced alignment;
- phoneme recognition models;
- OpenPronounce;
- future calibrated open acoustic models.

## 12.3 Required Vietnamese-accent evaluation

Before pronunciation scoring becomes learner authority:

- consented/lawfully usable Vietnamese-accented English samples;
- human reference labels;
- target contrast set;
- word/phoneme precision;
- recall;
- false alarm analysis;
- accent fairness analysis;
- latency/runtime benchmarks.

## 12.4 Frozen PR #2 findings

At reviewed HEAD `5932e31f4887e88367da21362e6de56b57755030`:

1. native Web Speech stop/final event ordering can lose the final transcript;
2. server STT provenance records provider but not exact model/version;
3. physical-microphone smoke remains required.

These remain parked until Speech work resumes.

OpenPronounce current verdict:

`EXPERIMENT MORE`

It is not mastery authority.

---

# 13. Architecture audit — current blocking wave

## FDN-ARCH-001

This is the current implementation priority.

Goals:

- map inherited EchoType architecture;
- identify all competing state models;
- audit state authority;
- audit security/privacy;
- audit dependencies;
- audit licenses/assets/content;
- implement Vietnam-first foundation only;
- produce cleanup recommendations.

For every important subsystem assign:

- KEEP
- ADAPT
- DEMOTE
- RETIRE
- DELETE CANDIDATE

Required documents:

- `ECHOTYPE_DEEP_AUDIT.md`
- `STATE_AUTHORITY.md`
- `VIETNAMIZATION_AUDIT.md`
- `LICENSE_MATRIX.md`

Do not turn the audit into a rewrite.

---

# 14. Architecture consolidation wave

After external review of FDN-ARCH-001, split cleanup into bounded missions.

Likely conflicts:

```text
legacy daily planner
vs Next For You

legacy weak spots
vs evidence projection

course completion
vs capability state

legacy correctness/accuracy
vs evidence events

CEFR assessment
vs placement/capability model

pronunciationProgress
vs future acoustic evidence

legacy learningAttempts
vs FlashDay attempts
```

Preferred migration pattern:

```text
identify authority
→ freeze conflicting new writes
→ adapter/read compatibility
→ migrate consumers
→ backfill/replay where necessary
→ verify
→ retire
→ delete only later
```

No destructive migration without reproducible migration evidence and rollback strategy.

---

# 15. Memory and SRS layer

Memory objects may include:

- vocabulary sense;
- chunk;
- sentence pattern;
- repair target;
- listening segment;
- other retrievable item.

Memory state should store scheduling facts.

Capability state stores ability facts.

Relationship:

```text
Capability need
     +
Memory due-ness
     ↓
Planner
     ↓
appropriate task
```

FSRS output should never write directly to capability mastery.

---

# 16. Planner / adaptive learning roadmap

The planner should mature in stages.

## Stage A — deterministic reference policy

Must remain:

- inspectable;
- reproducible;
- reason-emitting;
- easy to falsify.

## Stage B — calibrated heuristics

Add:

- failure demand routing;
- fatigue/session constraints;
- memory due-ness;
- learner goals;
- content preference;
- modality balance.

## Stage C — experimentation

Only after enough data exists:

- ranking experiments;
- contextual bandits or ML ranking if justified;
- offline evaluation;
- shadow mode;
- randomized experiments.

No ML planner gets direct ability-write permissions.

---

# 17. Analytics architecture

Learning evidence and product analytics are not the same table.

## Learning evidence

Used to make claims about ability.

Requires strict contracts.

## Product telemetry

Used for:

- crashes;
- performance;
- funnels;
- interaction;
- UI experiments;
- feature adoption.

May be noisy.

Never turn analytics events such as “clicked lesson” or “watched 10 minutes” into mastery.

## Core learning metrics

Prefer:

- time to first independent success;
- support dependency;
- independent-success rate;
- delayed retrieval rate;
- retained success;
- transfer success;
- error recurrence;
- successful repair;
- capability coverage;
- overdue memory burden.

## Product metrics

Track separately:

- activation;
- return rate;
- session frequency;
- completion;
- import usage;
- latency;
- error rate.

North-star discussions must always include a learning-outcome metric, not engagement alone.

---

# 18. Experimentation protocol

For meaningful product changes:

1. state hypothesis;
2. identify learner outcome;
3. define guardrails;
4. capture baseline;
5. run small prototype/usability test first;
6. use controlled experiment where scale permits;
7. check unintended learning-semantic changes;
8. document result;
9. remove failed experiments.

Do not optimize only for:

- clicks;
- XP;
- time in app;
- notification opens;
- streak.

A feature that increases engagement while lowering independent/retained performance is not automatically a win.

---

# 19. Privacy, security and learner trust

Principles:

- local-first where practical;
- minimum necessary audio/text sharing;
- explicit provider provenance;
- no secret leakage into browser logs;
- per-learner isolation;
- exportable learner data;
- understandable deletion;
- secure logout/account switch;
- fail closed on identity conflicts;
- no silent upload of recordings.

Speech/audio should have a documented lifecycle:

```text
capture
→ optional processing
→ provider/self-host boundary
→ transient/durable decision
→ retention/deletion policy
```

AI-provider privacy should be visible in settings where relevant.

---

# 20. License and provenance governance

Maintain a living license matrix.

Categories:

- COMMERCIAL-SAFE
- ATTRIBUTION-REQUIRED
- COPYLEFT-BOUNDARY
- RESEARCH-ONLY
- UNKNOWN — BLOCK REUSE

Do not infer asset license from repository license.

Track separately:

- source code;
- model code;
- model weights;
- datasets;
- audio;
- fonts;
- images;
- wordlists;
- dictionary data;
- lesson content.

AGPL/GPL material may be studied as architecture/pedagogy reference unless a deliberate license decision authorizes integration.

---

# 21. Model and provider registry

AI/speech/TTS models change faster than application architecture.

Maintain a registry for production model usage:

```text
capability
provider
model
model version
license/terms
data/privacy notes
cost
latency benchmark
quality benchmark
fallback
last reviewed
```

Never persist generic labels like “AI” when exact provenance is available.

Durable generated assets should record the model/version that created them.

---

# 22. Quality engineering standard

Major paths require layered verification.

## Unit / property

Test invariants and counterexamples.

## Integration

Test boundaries:

- bridge;
- storage;
- replay;
- planner;
- providers;
- import.

## Browser E2E

Test real user flows using actual application layers below the permitted hardware/network seam.

## Hardware smoke

Required when behavior depends on:

- microphone;
- camera;
- device storage;
- notifications;
- mobile/native integration.

## Adversarial testing

Try:

- duplicate delivery;
- conflicting ids;
- stale tabs;
- reload mid-attempt;
- offline/reconnect;
- account switch;
- corrupt storage;
- forged semantic fields;
- provider fallback;
- time jumps;
- rapid repeated input.

A green test suite is evidence only for the assertions it contains.

---

# 23. Performance and reliability

Before setting arbitrary performance targets, establish measured baselines on representative devices.

At minimum benchmark:

- mid-range Android;
- desktop Chrome;
- slower network;
- offline/reconnect;
- large library;
- large evidence history.

Track:

- initial load;
- interaction latency;
- IndexedDB operations;
- projection replay time;
- planner time;
- import processing;
- ASR/TTS latency;
- memory use.

Optimize after measurement.

Do not introduce caching that becomes a second source of truth.

---

# 24. Product release stages

## Stage 0 — personal proving ground

Goal:

Make FlashDay genuinely useful for its first learner before optimizing broad-market acquisition.

Requirements:

- honest evidence;
- reliable daily loop;
- Vietnamese-first UX;
- usable core mission;
- stable storage/sync;
- no silent semantic corruption.

## Stage 1 — closed alpha

Small group of Vietnamese English learners.

Collect:

- usability problems;
- misunderstanding of feedback;
- support dependency;
- task difficulty;
- device compatibility;
- auth/sync failures.

## Stage 2 — efficacy-oriented beta

Expand curriculum/modes only when instrumentation can measure:

- independent performance;
- delayed retention;
- transfer.

## Stage 3 — public beta

Requirements before scale:

- privacy policy;
- data deletion/export;
- support channel;
- incident handling;
- content/license provenance;
- production observability;
- abuse/rate-limit protection.

## Stage 4 — sustainable product

Monetization may fund expensive AI/audio compute, but core learning architecture should not depend on dark patterns.

Free/open/local technology should be used aggressively where quality permits to lower marginal cost.

---

# 25. Detailed roadmap

## Wave 1 — Architecture + Vietnam-first

**Now.**

FDN-ARCH-001.

Deliver:

- inherited architecture map;
- authority map;
- security/privacy findings;
- dependency/license findings;
- Vietnamese default UI;
- Vietnamese default support/translation;
- en/zh preserved;
- exact-head verification.

No Speech.

No curriculum expansion.

## Wave 2 — Architecture consolidation

Take audit findings one subsystem at a time.

Goals:

- one learner truth;
- one planner authority;
- remove/demote duplicate state;
- migration safety;
- stable shell.

## Wave 3 — Speech / Pronunciation research lab

First:

- product benchmark;
- Vietnamese-accent benchmark design;
- open/free technology benchmark.

Then:

- repair/rebuild speech capture;
- ASR provenance;
- acoustic diagnostics;
- correction loop.

OpenPronounce remains experimental until it earns authority.

## Wave 4 — Curriculum / Content Factory

Build:

- source registry;
- license/provenance layer;
- lexical resources;
- gold-course extraction;
- capability mapping;
- content QA;
- small A1 mission pack.

Do not begin with hundreds of generated lessons.

## Wave 5 — Core multimodal learning loop

Bring Listen, Read, Write and Speak onto the same evidence model.

Deliver:

- modality-specific tasks;
- shared mission semantics;
- memory integration;
- support provenance;
- repair loop;
- cross-modal transfer.

## Wave 6 — Immersion / Learn From Anything

Build:

- robust import;
- reader/player;
- lexical overlays;
- content difficulty;
- sentence/chunk capture;
- mission generation from imported content where evidence-safe.

## Wave 7 — Adaptive Planner v2

Use accumulated evidence to improve:

- remediation;
- memory interleaving;
- modality balance;
- goal alignment;
- session composition.

Experiment behind shadow mode/feature flags.

## Wave 8 — AI Tutor

Only after evidence boundaries are stable.

AI tutor can:

- converse;
- role-play;
- explain;
- generate variants;
- identify candidate errors.

It cannot self-certify learner mastery.

## Wave 9 — Efficacy, accessibility and quality scale

Run:

- learner studies;
- Vietnamese copy/UX QA;
- accessibility audit;
- low-end device optimization;
- longitudinal retention analysis.

## Wave 10 — Public product / sustainable economics

Harden:

- billing if needed;
- quota/cost control;
- observability;
- support;
- content operations;
- model routing;
- privacy/legal;
- growth loops that preserve learning quality.

---

# 26. Feature priority rule

A feature rises in priority when it improves one of:

1. correctness of learner truth;
2. quality of next-action selection;
3. learner ability to practice a real capability;
4. delayed retention;
5. transfer;
6. reliability/accessibility;
7. cost sustainability.

A feature should fall in priority when it mainly increases:

- visual novelty;
- feature count;
- vanity metrics;
- duplicated state;
- maintenance burden.

---

# 27. Definition of Done for a major feature

A major feature is not done because the UI works.

It is done when:

- learner problem is explicit;
- product benchmark exists;
- technology benchmark exists;
- free/open options were considered;
- architecture ownership is clear;
- evidence semantics are explicit;
- state writes are identified;
- provenance is stored;
- security/privacy reviewed;
- license reviewed;
- unit/integration/E2E exist;
- adversarial cases tested;
- accessibility considered;
- performance measured;
- fallback/error path works;
- analytics do not masquerade as learning evidence;
- docs updated;
- exact-head verification completed.

---

# 28. Research artifact template

Every major feature mission should include:

```text
FEATURE
Learner problem

LEARNING BASIS
Relevant learning mechanism
Evidence strength / uncertainty

PRODUCT BENCHMARK
Products studied
Best mechanics
Mechanics rejected
Known limitations

TECHNOLOGY BENCHMARK
Candidates
Free/open candidates
Paid candidates
Quality
Latency
Runtime cost
Privacy
License
Maintenance
Platform support

DECISION
Chosen approach
Why
Fallback
Replacement seam

EVIDENCE CONTRACT
Observed data
Allowed claims
Forbidden claims

QA
Unit
Integration
E2E
Adversarial
Hardware/real-world

SUCCESS
Learning metric
Product metric
Guardrail
```

---

# 29. Engineering protocol

All implementation missions:

- factory-first;
- clean base;
- exact starting SHA;
- read current master plan;
- research before major feature build;
- reproduce before bug fix;
- regression test before fix where practical;
- counterexample/adversarial testing;
- minimal authority;
- no silent semantic changes;
- exact-head verification after final commit;
- distinguish local tests from CI;
- draft PR first;
- never merge without explicit user instruction.

---

# 30. Anti-goals

FlashDay is NOT trying to become:

- a clone of Duolingo;
- a clone of LingQ;
- a clone of Anki;
- an LLM chat wrapper;
- a giant bundle of EchoType features;
- a pronunciation score toy;
- an XP/streak optimization machine;
- a course generated wholesale by AI.

Use the strongest ideas from each class of product while preserving one coherent learner model.

---

# 31. Immediate execution state

Current order:

```text
PR #1 Foundation
    ✓ merged
      ↓
Master plan
    ✓ living document
      ↓
FDN-ARCH-001
    NOW
      ↓
External review
      ↓
Architecture consolidation
      ↓
Speech/pronunciation research lab
      ↓
Content factory
      ↓
Core multimodal loop
      ↓
Immersion/import
      ↓
Planner v2
      ↓
AI tutor
      ↓
Efficacy/quality scale
      ↓
Public sustainable product
```

Do not skip ahead because a later feature is attractive or easy to code.

---

# 32. Current research basis

This section records important primary/credible sources informing the plan. It is not a frozen bibliography; refresh it when a feature mission starts.

## Learning / standards

- Nature Reviews Psychology — *The science of effective learning with spacing and retrieval practice*:
  https://www.nature.com/articles/s44159-022-00089-1
- Council of Europe — CEFR descriptors / Companion Volume:
  https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors
- Anki Manual — FSRS:
  https://docs.ankiweb.net/deck-options

## Guided learning / speaking products

- Duolingo Method:
  https://blog.duolingo.com/duolingo-teaching-method/
- Duolingo speaking approach:
  https://blog.duolingo.com/covering-all-the-bases-duolingos-approach-to-speaking-skills/
- Duolingo Video Call research:
  https://blog.duolingo.com/video-call-research-report/
- Speak:
  https://www.speak.com/
- ELSA pronunciation feedback:
  https://elsaspeak.com/en/faqs/how-does-elsas-pronunciation-feedback-work
- Loora corrections:
  https://www.loora.com/support/features/feedback-and-corrections
- Speechling quickstart:
  https://speechling.com/help/quickstart

## Immersion / reading

- LingQ:
  https://www.lingq.com/
- Language Reactor:
  https://www.languagereactor.com/
- Migaku:
  https://migaku.com/faq/features
- Readlang:
  https://readlang.com/

## Open/free speech technology

- whisper.cpp:
  https://github.com/ggml-org/whisper.cpp
- faster-whisper:
  https://github.com/SYSTRAN/faster-whisper
- sherpa-onnx:
  https://github.com/k2-fsa/sherpa-onnx
- CMUdict:
  https://github.com/cmusphinx/cmudict
- OpenPronounce:
  https://github.com/Halleck45/OpenPronounce

## Writing / TTS

- LanguageTool:
  https://github.com/languagetool-org/languagetool
- Kokoro:
  https://github.com/hexgrad/kokoro

## Content / lexical sources

- VOA Learning English reuse terms:
  https://learningenglish.voanews.com/p/6861.html
- VOA Let's Learn English Level 1:
  https://learningenglish.voanews.com/p/5644.html
- VOA Let's Learn English Level 2:
  https://learningenglish.voanews.com/p/6765.html
- NGSL/NGSL-Spoken:
  https://www.newgeneralservicelist.org/ngsls
- Tatoeba reuse:
  https://en.www.en.wiki.tatoeba.org/articles/show/using-the-tatoeba-corpus
- Open English WordNet:
  https://en-word.net/
- Project Gutenberg license:
  https://www.gutenberg.org/policy/license
- LibriVox public domain:
  https://librivox.org/pages/public-domain/

---

# 33. Governing principle

FlashDay should not win by having the most features.

It should win by making each learning action honest, useful and connected to a durable model of what the learner can actually do.

Research the best products.

Benchmark the best technology.

Prefer high-quality free/open/local solutions.

Pay when quality genuinely justifies it.

Keep one learning truth.

Measure retention and transfer.

Then scale.
