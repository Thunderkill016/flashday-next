# FlashDay Master Plan

Status: living roadmap for FlashDay Next.

This document is the canonical project-level plan. Individual missions may refine implementation details, but they must not silently change the sequencing, authority model, or deferred-work boundaries defined here.

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

The objective is a coherent learning system, not maximum feature count.
