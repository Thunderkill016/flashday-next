# FlashDay Master Plan

Status: living roadmap for FlashDay Next.

This document is the canonical project-level plan. Individual missions may refine implementation details, but they must not silently change the sequencing, authority model, research gates, or deferred-work boundaries defined here.

## Baseline

- Repository: `Thunderkill016/flashday-next`
- Foundation PR #1: merged as `27191be48e43a6a6a0470fe41d95b6183b0e9dc7`
- Speech PR #2: draft only, branch `flashday/speech-path`, reviewed at `5932e31f4887e88367da21362e6de56b57755030`
- PR #2 must remain unmerged while the architecture/Vietnam-first wave is active.
- Do not cherry-pick Speech/OpenPronounce work into the architecture audit wave.

## Product doctrine

FlashDay owns learning truth.

```text
Evidence Log
    ↓
Learner Projection
    ↓
Planner / Next For You
    ↓
Mission / Session
    ↓
Execution surfaces
    ├─ Listen
    ├─ Speak
    ├─ Read
    ├─ Write
    └─ Imported Content
```

Non-negotiable distinctions:

- activity ≠ learning
- completion ≠ mastery
- accuracy ≠ proficiency
- MemoryState ≠ ProficiencyState
- STT/ASR transcript ≠ pronunciation evidence
- course position ≠ observed ability
- practiced family ≠ transfer
- AI score ≠ certified learner level
- FSRS = memory scheduling only

UI/execution modules may report observed reality. They do not author semantic learning conclusions.

## Universal feature-development rule — benchmark before build

This rule applies to **every meaningful FlashDay feature**, not only Speech.

Before designing, replacing, or substantially upgrading a feature, the responsible mission must perform two research passes:

1. **Product benchmark** — study the strongest relevant products and identify the concrete learning/product mechanics that make the feature effective.
2. **Technology benchmark** — evaluate the strongest relevant technologies, libraries, models, standards, datasets, and infrastructure options before choosing an implementation.

Do not begin from “what can we code quickly.” Begin from:

```text
best observed product mechanic
        +
best evidence-compatible learning design
        +
best-fit technology
        ↓
FlashDay implementation
```

### Product-benchmark requirements

For each feature:

- identify the best-in-class and strongest competing products;
- study the actual interaction loop, not marketing copy;
- identify what they do better than FlashDay;
- identify what should NOT be copied;
- separate retention/engagement tricks from real learning value;
- map useful mechanics into FlashDay's evidence/capability model;
- record unresolved assumptions before implementation.

Research should prioritize primary sources, live product behavior, official documentation, reproducible demos, and credible independent evidence where available.

### Technology-benchmark requirements

For each feature, compare realistic implementation candidates on:

- quality/accuracy;
- latency;
- reliability;
- browser/mobile/desktop feasibility;
- offline capability;
- CPU/RAM/GPU cost;
- operational complexity;
- privacy;
- security;
- commercial-use license;
- model/data provenance;
- maintenance health;
- vendor lock-in;
- testability;
- interoperability with FlashDay architecture.

### Free/open-first policy

FlashDay should **prefer free, open-source, open-standard, self-hostable or local-first technology** when it reaches the required quality bar.

Priority order:

```text
high-quality free/open/local solution
        ↓
high-quality free/open self-hosted service
        ↓
free-tier external service when operationally justified
        ↓
paid/proprietary service only when it materially outperforms
the free/open alternatives on a product-critical dimension
```

“Free” is not enough.

Do NOT select a technology merely because it costs nothing.

A free/open candidate must still meet the feature's quality threshold. If a paid/proprietary solution is materially better, document:

- what it wins on;
- how large the gap is;
- why the gap matters to learners;
- expected cost;
- lock-in risk;
- fallback/migration path.

Whenever possible, architect provider/model seams so a better free/open implementation can replace a paid dependency later without rewriting the learning model.

### No blind feature copying

Top products are research inputs, not specifications.

Do not copy:

- UI merely because it is popular;
- gamification that does not improve learning;
- scoring semantics incompatible with FlashDay evidence;
- proprietary claims that cannot be independently justified;
- dark patterns;
- unnecessary complexity.

Every borrowed mechanic must answer:

```text
What learner problem does this solve?
What evidence does it generate?
What capability does it affect?
How can we falsify that it works?
What is the cheapest high-quality implementation?
```

## Feature research map

This map is a starting point, not a closed list. Every new feature added later inherits the same benchmark-before-build rule.

### Listen

Research product mechanics from strong listening/immersion tools such as:

- Language Reactor
- Migaku
- LingQ
- asbplayer
- high-quality dictation/shadowing products

Study:

- segment replay;
- auto-pause;
- subtitle timing;
- transcript reveal;
- dictation;
- comprehension before imitation;
- known/unknown word support;
- sentence mining;
- speed control;
- context preservation.

Technology research should include high-quality free/open options for:

- media playback;
- subtitle parsing/alignment;
- timestamp handling;
- local audio processing;
- VAD where relevant;
- TTS;
- offline media support.

### Speak / Pronunciation

Research:

- ELSA Speak
- Speak
- Loora
- BoldVoice
- Speechling
- Praktika
- other strong speaking/pronunciation systems discovered later

Study:

- conversation-first speaking;
- pronunciation diagnostics;
- sound/syllable/stress/intonation feedback;
- correction prioritization;
- repair drills;
- native model → learner attempt → replay → retry;
- role-play;
- delayed transfer.

Technology candidates include:

- whisper.cpp
- faster-whisper
- sherpa-onnx
- Silero VAD
- CMUdict
- Montreal Forced Aligner
- Wav2Vec2/phoneme models
- OpenPronounce
- future higher-quality free/open candidates

No ASR transcript may masquerade as pronunciation mastery.

### Read / Immersion

Research:

- LingQ
- Lute
- Learning With Texts
- Readlang-style workflows
- Migaku
- Language Reactor where relevant

Study:

- known/learning/new word states;
- click-to-gloss;
- phrase-aware lookup;
- lexical coverage;
- readable-at-level estimation;
- context-preserving vocabulary;
- sentence capture;
- extensive reading progression;
- low-friction dictionary UX.

Technology/data research should consider:

- tokenizer/segmentation libraries;
- dictionary/lexical resources;
- Open English WordNet;
- frequency lists;
- local search/indexing;
- open corpora with clean commercial licenses.

### Write

Research the strongest writing-learning and correction systems, not generic grammar checkers only.

Study:

- error categorization;
- explanation quality;
- repair-before-rewrite;
- minimal correction;
- learner self-correction;
- delayed re-use of corrected structures;
- free production vs guided production.

Technology research may include:

- LanguageTool;
- grammar parsers;
- deterministic rule engines;
- high-quality local/open LLM candidates;
- structured error taxonomies.

AI rewrite output must not automatically become evidence of learner ability.

### Vocabulary / Lexical learning

Research:

- Anki
- LingQ
- Migaku
- mature SRS tools
- frequency-based vocabulary systems

Study:

- retrieval design;
- context-rich cards;
- recognition vs production;
- leeches;
- suspend/bury;
- difficulty;
- known-word tracking;
- item creation friction;
- spacing without confusing memory with proficiency.

Technology/data research should include:

- FSRS;
- NGSL / spoken frequency resources;
- open lexical datasets;
- morphology/lemmatization;
- dictionary data;
- high-quality sentence sources.

### Review / SRS

Research:

- Anki
- FSRS ecosystem
- SuperMemo concepts where legally/documentarily useful
- high-quality modern review systems

Study:

- scheduling;
- lapse handling;
- relearning;
- interleaving;
- desirable difficulty;
- context rotation;
- review burden;
- memory forecasting.

FSRS remains a memory scheduler, not proficiency authority.

### Planner / Next For You

Research adaptive-learning products and recommendation systems.

Study:

- next-action selection;
- remediation routing;
- prerequisite handling;
- uncertainty;
- support-demand routing;
- spacing;
- exploration vs exploitation;
- learner fatigue;
- explainability.

The planner must operate over FlashDay evidence/projection and must not create mastery by scheduling something.

Prefer deterministic, inspectable policy before opaque ML if both achieve comparable learner value.

### Assessment / Placement

Research strong language assessment and placement products/frameworks.

Study:

- adaptive testing;
- receptive vs productive separation;
- held-out item design;
- confidence;
- floor/ceiling effects;
- retesting;
- contamination prevention;
- score interpretation.

Do not equate a short MCQ with full CEFR proficiency.

Prefer open/public standards and validated item methodologies where legally usable.

### Translation / Learner support

Research:

- top translation UX inside language-learning products;
- bilingual dictionary workflows;
- contextual translation tools;
- learner-facing explanation systems.

Study:

- when translation helps vs harms;
- sentence vs word translation;
- ambiguity;
- progressive reveal;
- Vietnamese learner explanations;
- translation support as scaffolding rather than mastery evidence.

Technology benchmark should prioritize:

- high-quality open translation models when viable;
- local/self-host inference where quality permits;
- provider abstraction when proprietary models materially outperform;
- dictionaries/lexical resources for deterministic support.

### TTS / Listening voice

Benchmark naturalness, intelligibility, latency, pronunciation control, streaming, Vietnamese-support needs, English accent quality and commercial licensing.

Prefer high-quality free/open TTS when competitive.

Candidates may include Kokoro and future stronger open models, but every model must be benchmarked rather than adopted by reputation.

### Import / Learn from anything

Research:

- Language Reactor
- Migaku
- LingQ imports
- Readwise Reader-style ingestion mechanics where relevant
- high-quality subtitle/transcript tools

Study:

- URL/video/PDF import;
- transcript extraction;
- segmentation;
- sentence mining;
- metadata;
- source provenance;
- readability;
- copyright boundaries;
- imported-content difficulty.

Technology research must include:

- robust parsers;
- subtitle formats;
- content extraction;
- sanitization;
- SSRF/XSS defenses;
- local-first processing where practical.

### Search / Library / Knowledge organization

Research products that handle large personal learning libraries well.

Study:

- retrieval;
- tagging;
- semantic search;
- recent/resume;
- source lineage;
- duplicate handling;
- offline access;
- learner-state overlays.

Prefer simple local indexes/search before expensive vector infrastructure unless benchmarks show a clear gain.

### Auth / Sync / Backup

Research best-in-class UX and reliability, not just implementation convenience.

Study:

- instant sign-in transition;
- offline-first;
- multi-device merge;
- conflict handling;
- export;
- restore;
- account switching;
- data deletion;
- session recovery.

Technology decisions must optimize:

- reliability;
- privacy;
- user ownership;
- migration/exportability;
- low operational cost;
- minimal vendor lock-in.

### UI/UX / Design system

Research top learning products for **learning effectiveness**, not visual fashion.

Study:

- information hierarchy;
- cognitive load;
- feedback timing;
- correction presentation;
- focus;
- touch targets;
- accessibility;
- dark/light environments;
- mobile ergonomics;
- progress communication;
- interruption cost.

Do not copy engagement theater that weakens learning.

### Notifications / Habit / Retention

Research Duolingo and other strong habit products, but separate:

- useful study reminders;
- streak accountability;
- reactivation;
- goal setting;

from:

- manipulative urgency;
- meaningless XP;
- league pressure;
- engagement that displaces actual learning.

Retention features must serve continued learning, not just DAU.

### Analytics / Learning telemetry

Research strong product analytics and learning-science measurement approaches.

Measure:

- learning loop completion;
- support dependency;
- independent performance;
- delayed retention;
- transfer;
- error recurrence;
- time-to-repair;
- session burden.

Do not optimize only:

- clicks;
- time spent;
- streak length;
- raw lesson completion.

Prefer open/self-hosted analytics where practical and privacy-preserving.

### AI tutor / Conversational intelligence

Research top AI language tutors and agentic learning products.

Study:

- conversation control;
- correction timing;
- memory;
- persona;
- level adaptation;
- scenario generation;
- pedagogical planning;
- hallucination containment;
- learner safety;
- structured feedback.

Technology benchmark must compare:

- open/local models;
- hosted open-weight models;
- commercial frontier models;
- latency;
- cost;
- Vietnamese instruction quality;
- English pedagogy quality;
- structured-output reliability;
- privacy.

Use the cheapest/free option that meets quality. Keep provider/model abstraction so the learning architecture is not owned by a model vendor.

### Offline / PWA / Native

Research high-quality offline learning applications.

Study:

- offline lesson access;
- sync queue;
- resumability;
- media caching;
- model download lifecycle;
- storage limits;
- conflict resolution.

Prefer browser-native/PWA/free runtime capabilities before introducing heavier native infrastructure unless the product requirement justifies it.

### Accessibility

Benchmark strong accessible education products and platform standards.

Research:

- keyboard support;
- screen readers;
- captions;
- reduced motion;
- contrast;
- focus management;
- speech alternatives;
- hearing/vision accommodations.

Use open web/platform standards first.

## Feature mission research artifact

Any mission that materially adds or replaces a feature should include a short research artifact before implementation, recording:

```text
Feature
Learner problem
Top products studied
Mechanics worth adopting
Mechanics rejected
Technology candidates
Free/open candidates
Paid/proprietary candidates if necessary
Benchmark criteria
Chosen approach
Why it won
Known limitations
Replacement/fallback path
```

For small fixes, this may be a concise section in the mission report. For major capabilities, create a dedicated research document.

## Wave 1 — FDN-ARCH-001: EchoType Deep Audit + Vietnam-First Foundation

This is the current priority and blocks further feature expansion.

### Audit goals

Map the inherited EchoType architecture from code, including:

- learner state
- progress
- course state
- daily plan
- weak spots
- FSRS
- legacy learning attempts / records
- assessment / CEFR state
- pronunciation progress
- Speak history
- mission state
- sync
- translation
- provider infrastructure
- import pipeline
- Dexie / Supabase / localStorage state
- API routes
- native/Tauri/iOS compatibility layers

For every learning-related state, record:

- writer
- readers
- storage location
- semantic claim
- current authority
- conflict risk
- future authority
- disposition

Allowed dispositions:

- KEEP
- ADAPT
- DEMOTE
- RETIRE
- DELETE CANDIDATE

### De-vibe audit

Specifically look for:

- duplicated planners/state stores/helpers
- overlapping learning truth
- one-off abstractions
- stale docs/specs
- dead branches
- duplicate provider/config logic
- implementation-coupled tests
- obsolete migrations
- feature accretion without clear ownership
- hidden learning-state mutation

Do not broadly refactor or delete during the audit.

### Security/privacy/dependency/license audit

Audit:

- credentials and provider keys
- auth/session state
- learner isolation
- cloud sync
- backup/restore
- imported content
- SSRF/XSS/sanitization
- expensive unauthenticated API routes
- audio/microphone data handling
- production dependencies
- bundled assets/content/models
- commercial/license boundaries

Required docs:

- `docs/flashday/ECHOTYPE_DEEP_AUDIT.md`
- `docs/flashday/STATE_AUTHORITY.md`
- `docs/flashday/VIETNAMIZATION_AUDIT.md`
- `docs/flashday/LICENSE_MATRIX.md`

### Vietnam-first foundation

FlashDay is Vietnam-first while remaining multilingual-capable.

Required UI languages:

- `vi`
- `en`
- `zh`

Fresh-install policy:

1. respect an explicit saved user preference
2. otherwise default to Vietnamese

Browser locale must not silently change a new FlashDay user to English or Chinese.

Vietnamese must also be the default learner-support / translation target for new users.

UI language and learning language remain separate concepts. FlashDay teaches English.

Audit and remove inherited Chinese-first assumptions such as scattered `zh` / `zh-CN` defaults while preserving Chinese as a selectable language.

Existing explicit English/Chinese preferences must survive migration.

### Wave 1 boundaries

Do NOT:

- continue Speech/OpenPronounce
- merge PR #2
- start curriculum replacement
- build the content factory
- add mission #2
- perform broad legacy cleanup
- mass-upgrade dependencies
- redesign the product

Audit first; only bounded Vietnam-first foundation fixes and tightly-contained severe blockers belong here.

## Wave 2 — Architecture consolidation / legacy cleanup

Starts only after external review of FDN-ARCH-001.

Use the audit evidence to split cleanup into bounded missions.

Likely areas to evaluate:

- legacy daily planner vs FlashDay Next For You
- weak-spots state vs evidence-derived projections
- course completion vs capability state
- legacy records/accuracy vs EvidenceEvent
- CEFR assessment vs placement/capability model
- pronunciationProgress vs future acoustic evidence
- legacy learningAttempts vs FlashDay attempts

Target direction:

- FlashDay kernel/evidence owns capability truth
- planner owns next learning action
- FSRS owns memory scheduling only
- execution surfaces submit evidence
- legacy state becomes history/presentation where retained

No destructive migration without replay/backfill/migration evidence and regression tests.

## Wave 3 — Speech / Pronunciation Research and Product Benchmark

Speech work resumes only after the architecture foundation is accepted.

Do not start by choosing a library.

Phase 0 is mandatory product + technology research.

### Product benchmarks

Study the strongest speaking/pronunciation products and extract concrete mechanics, especially:

- ELSA Speak — sound/syllable/stress/intonation diagnostics and structured pronunciation practice
- Speak — high-volume conversation-first speaking practice
- Loora — correction without destroying conversational flow; prioritize a small number of high-value corrections
- BoldVoice — accent-oriented coaching and structured sound/stress practice
- Speechling — native model → learner recording → self-listen → retry → spaced/human feedback loop
- Praktika — adaptive role-play and conversational repair

The goal is not to copy UI. Extract learning mechanics that can be represented honestly in FlashDay evidence contracts.

### Free/open technology candidates

Benchmark before integration:

- `whisper.cpp` — local/mobile/browser ASR candidate
- `faster-whisper` — server ASR candidate
- `sherpa-onnx` — offline/streaming/mobile candidate
- Silero VAD — voice activity detection
- CMUdict — pronunciation reference lexicon
- Montreal Forced Aligner — forced alignment research
- Wav2Vec2 phoneme recognition candidates
- OpenPronounce — pronunciation diagnostic candidate

Prefer free/self-hosted technology when it meets the quality bar, but do not choose OSS merely because it is free.

Required comparison dimensions:

- transcription accuracy
- pronunciation false-positive / false-negative rate
- Vietnamese-accent robustness
- latency
- CPU/RAM/GPU cost
- mobile/browser feasibility
- privacy
- licensing
- model provenance
- operating complexity
- offline/self-host potential

### Target speech architecture

```text
Microphone
    ↓
VAD
    ↓
ASR transcript
    ├─ semantic evaluator
    └─ capture provenance

Audio waveform
    ↓
alignment / acoustic / phoneme diagnostics
    ↓
pronunciation feedback
    ↓
highest-value correction
    ↓
repair drill
    ↓
retry
    ↓
later transfer
```

ASR transcript must never mint independent pronunciation/intelligibility/proficiency credit.

Capture provenance should preserve at least:

- mode
- authority class
- provider
- model/version where available
- final/interim status
- confidence when genuinely supplied

### Current Speech PR #2 review state

PR #2 is intentionally paused.

Known review blockers at `5932e31f4887e88367da21362e6de56b57755030`:

1. Native Web Speech stop/final ordering can lose the final transcript.
2. Server STT capture provenance records provider but not model/version.
3. Physical-microphone smoke remains required in addition to virtual-mic transport testing.

Do not fix these until the Speech wave is resumed after architecture review.

### OpenPronounce status

Current position:

`EXPERIMENT MORE`

It may be useful for diagnostic/feedback routing, but it is not yet trusted as pronunciation mastery authority.

Before promotion:

- benchmark Vietnamese-accent English
- use consented/lawfully usable audio
- obtain human reference labels
- measure per-phoneme/word precision and recall
- quantify false alarms
- benchmark latency/ops cost

No OpenPronounce output may directly mutate learner mastery.

## Wave 4 — Curriculum / Content Factory

Explicitly postponed until the architecture and speech foundations are stable enough.

Do not treat EchoType's built-in phrase collections as the future curriculum.

Long-term target:

```text
trusted curriculum seed
        ↓
capability graph
        ↓
mission contracts
        ↓
canonical examples
        ↓
controlled generated variants
        ↓
retrieval / transfer / assessment
        ↓
Vietnamese learner support
```

Candidate source roles to research and legally validate:

- VOA Learning English / other suitable public-domain U.S. government material — human-authored curriculum/input seed
- NGSL / NGSL-Spoken — lexical backbone
- Tatoeba — candidate human example sentences
- Open English WordNet — lexical semantics
- CMUdict — pronunciation targets
- Project Gutenberg / LibriVox / selected authentic material — immersion
- user-imported material — personalized input

Every production content asset should carry provenance and license metadata.

AI generation belongs near the end of the pipeline, under constraints and QA. Do not bulk-generate filler content and call it curriculum.

Required future QA dimensions include:

- license/provenance
- grammatical correctness
- naturalness
- lexical load
- capability alignment
- transfer validity
- held-out assessment contamination
- Vietnamese learner suitability

## Engineering protocol for all future missions

- factory-first
- clean base
- exact starting SHA
- benchmark relevant top products before major feature implementation
- benchmark relevant technologies before choosing implementation
- prefer free/open/local/self-hosted when quality is competitive
- document why a paid/proprietary dependency wins if one is selected
- reproduce before fix
- regression test before implementation where applicable
- adversarial/counterexample testing
- no semantic claim without evidence
- exact-head verification after the final commit
- distinguish local verification from CI
- draft PR first
- never merge without explicit user instruction

## Sequencing summary

```text
NOW
│
├─ Wave 1: FDN-ARCH-001
│   ├─ deep inherited-repo audit
│   └─ Vietnam-first foundation
│
├─ external review
│
├─ Wave 2: architecture consolidation / legacy cleanup
│
├─ Wave 3: speech + pronunciation research
│   ├─ benchmark top products
│   ├─ benchmark free/open technology
│   ├─ fix/rework Speech path
│   └─ only then consider OpenPronounce integration
│
└─ Wave 4: curriculum/content factory
    └─ trusted sources + FlashDay-owned curriculum
```

Do not skip waves because a later feature appears easy to implement.

The objective is a coherent learning system built from the best validated product mechanics and the highest-quality practical technology, not maximum feature count.
