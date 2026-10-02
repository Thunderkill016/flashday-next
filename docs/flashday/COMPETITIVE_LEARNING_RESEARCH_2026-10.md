# FlashDay Competitive Learning Research — VSpeak + Content-to-Practice Products

**Date:** 2026-10-02  
**Scope:** product mechanics for real-content learning, multimodal practice, correction/retry, vocabulary mining, speaking feedback, planner/session composition.  
**Status:** research input to `FLASHDAY_MASTER_PLAN.md`; not implementation authority by itself.

---

## 1. Research question

What should FlashDay learn from products that already turn videos, transcripts, articles, vocabulary and conversation into repeated language practice?

The goal is not to copy feature lists. The goal is to identify interaction mechanics that fit FlashDay's doctrine:

```text
activity != learning
support != independence
memory != proficiency
AI feedback != ability
content completion != mastery
```

Every adopted mechanic must remain compatible with:

```text
Content
  -> TaskContract
  -> Execution surface
  -> EvidenceEvent
  -> Learner Projection
  -> Planner / Next For You
```

---

## 2. Products reviewed

Primary/official product material reviewed:

- VSpeak — https://vspeak.asia/
- eJOY English — https://ejoy-english.com/en/help/learning-youtube-videos-on-ejoy-english-2
- EnglishCentral — https://www.englishcentral.com/about-us
- EnglishCentral FAQ — https://www.englishcentral.com/support/faq
- Yabla English — https://english.yabla.com/en/
- Migaku features — https://migaku.com/faq/features
- Language Reactor basic workflow — https://dev.languagereactor.com/help/basic
- Language Reactor saved-context/export behavior — https://www.languagereactor.com/help/export
- Speechling Dictation — https://speechling.com/help/dictation
- Speechling Quickstart / Audio Journal — https://speechling.com/help/quickstart
- Speechling feedback history — https://speechling.com/help/checking-feedback
- Readlang — https://readlang.com/
- FluentU — https://www.fluentu.com/courses/
- Gliglish — https://gliglish.com/
- Praktika — https://praktika.ai/

Research deliberately separates product claims from FlashDay conclusions.

---

## 3. Product findings

### 3.1 VSpeak

Official public landing currently advertises:

- shadowing;
- dictation;
- vocabulary;
- pronunciation;
- YouTube-based practice;
- CEFR A1-C2 vocabulary/pronunciation material;
- collocations, idioms and phrasal verbs;
- AI scoring for speaking/writing;
- daily progress tracking.

**Useful signal for FlashDay**

VSpeak confirms strong local demand for a single practice destination that combines multiple execution modes instead of isolating listening, speaking and vocabulary into unrelated tools.

**Do not copy blindly**

The public material does not document evaluator calibration, exact model/version provenance or how AI scores map to ability. FlashDay must not infer learning authority from the existence of a score.

---

### 3.2 eJOY English

eJOY demonstrates one of the clearest `one content -> many practice modes` workflows.

For a YouTube/video item it exposes:

- dual subtitles;
- sentence loop;
- slow playback;
- contextual word lookup;
- Active Listening;
- sentence-completion quiz;
- Shadow;
- Write/dictation;
- Role Play.

The same source material is therefore reused across comprehension, recognition, production and imitation surfaces.

**FlashDay lesson**

A canonical content object should not be converted into one fixed exercise. It should be able to feed multiple TaskContracts while preserving the same source sentence/media provenance.

**Risk to avoid**

eJOY also exposes skill/proficiency-style progress tied to game activity. FlashDay must not translate exercise completion or game scores directly into capability state.

---

### 3.3 EnglishCentral

EnglishCentral's core published loop is:

```text
Watch
-> Learn
-> Speak
-> GoLive
```

The same video drives:

- video comprehension;
- marking unknown vocabulary;
- fill-in-the-blank lexical practice;
- speaking the learned language in context;
- pronunciation/fluency feedback;
- optional teacher discussion.

Its FAQ also describes AI conversation about a video with feedback on vocabulary, grammar, fluency and pronunciation-related dimensions.

**FlashDay lesson**

Input should have a route to output. A video should be able to become an immediate comprehension/retrieval/production sequence rather than ending when playback ends.

**Risk to avoid**

Multi-dimensional AI feedback must remain decomposed. FlashDay must not collapse grammar, pronunciation, lexical choice and fluency into a single capability truth.

---

### 3.4 Yabla

Yabla combines:

- authentic videos;
- dual subtitles;
- Scribe dictation;
- Speak pronunciation practice;
- flashcards/SRS;
- a structured daily Fluency Club.

Its daily circuit currently presents roughly ten-minute sessions composed of multiple targeted activities over the same lesson, including Watch, Scribe, Speak, Revo, Parrot and Review.

**FlashDay lesson**

This is strong evidence for **planner-composed circuits**:

```text
one material
+ several evidence-safe tasks
+ bounded session length
+ planner chooses order
```

This is preferable to a dashboard containing dozens of independent tool buttons.

---

### 3.5 Migaku

Migaku demonstrates deep content instrumentation:

- interactive subtitles/web text;
- known-vocabulary-aware word/sentence recommendations;
- personalized content difficulty;
- one-click contextual dictionary;
- media-rich card creation;
- subtitle display/pause strategies based on unknown words;
- saved screenshot/audio/context;
- spaced repetition.

**FlashDay lesson**

Difficulty should be personalized from the learner's lexical familiarity and context, not assigned only as a static CEFR label.

Context capture should include as much of the original encounter as legally and technically appropriate:

```text
word/chunk
source sentence
source content
subtitle index/time
audio clip reference
image/frame reference
sense/context
encounter timestamp
```

**Important distinction**

Known-word state is useful for input selection. It is not a full proficiency model.

---

### 3.6 Language Reactor

Language Reactor demonstrates low-friction video control:

- click word for definition;
- right-click to save;
- subtitle-level previous/replay/next;
- auto-pause;
- machine/human translation options;
- keyboard-heavy navigation;
- saving phrases;
- saving words with original context;
- exporting contextual items to Anki.

Its export documentation explicitly distinguishes words saved with context from context-free word saves and notes the value of the contextual form.

**FlashDay lesson**

The reader/player should minimize interruption.

High-value controls:

```text
previous line
replay current line
next line
auto-pause
peek transcript
save phrase
save word with context
resume source position
```

Contextful capture should be the default; context-free capture should be secondary.

---

### 3.7 Speechling

Speechling's dictation loop is intentionally simple:

```text
listen
-> type
-> check
```

When wrong, the learner sees which words were right/wrong. Give Up can reveal the answer and the item can be marked for later review.

Its speaking path also supports:

- native model audio;
- recording;
- playback of learner audio;
- rerecording;
- human coaching;
- audio history/journal;
- revisiting earlier recordings.

**FlashDay lesson**

Wrong attempts should create a durable correction/retry object, not disappear behind a score.

A strong generic loop is:

```text
attempt
-> specific diagnostic
-> repair
-> immediate retry
-> delayed fresh retry
```

For speech, self-listen + model comparison + rerecord is useful even before acoustic scoring becomes authoritative.

---

### 3.8 Readlang

Readlang's central interaction is:

```text
read
-> click word/phrase
-> translate/explain
-> save
-> review later
```

It preserves context and can associate multiple contexts with the same lexical item.

**FlashDay lesson**

Separate:

- lookup;
- deliberate capture;
- memory scheduling.

A lookup should not automatically imply "learner wants this as a card" unless product policy explicitly chooses that behavior.

Multiple encountered contexts should accumulate around one lexical item instead of replacing one another.

---

### 3.9 FluentU

FluentU combines:

- authentic/curated video;
- interactive subtitles;
- personalized quizzes;
- word lookup;
- spaced-repetition review;
- AI tutor practice.

**FlashDay lesson**

Personalized quizzes are most useful when generated from what the learner actually encountered, but their outcomes still need TaskContracts before entering learner projection.

---

### 3.10 Gliglish / Praktika

Both emphasize keeping speaking flowing.

Published mechanics include:

- conversation scenarios;
- suggestions when learner is stuck;
- adjustable speaking speed;
- contextual explanation;
- translation;
- grammar feedback;
- pronunciation feedback;
- personalized study direction;
- corrections during AI conversation.

**FlashDay lesson**

Conversation feedback should not become a constant interruption.

Preferred design:

```text
conversation turn
-> capture candidate errors
-> continue if communication works
-> select 1-3 high-value corrections
-> focused repair
-> retry / later resurfacing
```

The AI can propose errors and explanations. It cannot certify mastery.

---

## 4. Cross-product synthesis

### Pattern A — One content object, many TaskContracts

Strongest examples: eJOY, EnglishCentral, Yabla, Migaku.

FlashDay target:

```text
ContentSegment
  -> comprehension probe
  -> recognition/dictation
  -> lexical capture
  -> supported production
  -> independent production
  -> later retrieval
  -> fresh-context transfer
```

Do not duplicate source text/media into disconnected exercise-specific records.

---

### Pattern B — Support must be a timeline, not only final booleans

Products expose actions such as:

- replay;
- slow;
- translation;
- transcript reveal;
- first-letter/word hint;
- Give Up/reveal;
- model audio;
- rerecord.

FlashDay should evolve toward ordered support telemetry:

```text
prompt_shown
replay
slow_playback
translation_opened
hint_used
response_submitted
answer_revealed
feedback_shown
retry_started
```

Why this matters:

```text
answer reveal AFTER first attempt
!=
answer-bearing support BEFORE/during first attempt
```

The Evidence Bridge must be able to preserve this distinction.

---

### Pattern C — Correction Episode is a first-class object

Strongest examples: Speechling, eJOY, EnglishCentral, Gliglish/Praktika.

A wrong answer should not produce only:

```text
score = 60
```

Preferred lifecycle:

```text
failed/partial attempt
-> diagnostic
-> correction episode opens
-> targeted repair
-> immediate retry
-> delayed retest
-> fresh-context use if needed
```

This maps naturally to FlashDay's evidence-derived weakness/remediation architecture.

---

### Pattern D — Context-rich lexical mining

Strongest examples: Migaku, Language Reactor, Readlang.

Capture target:

```text
lexical item / chunk
sense
source sentence
surrounding context
source content id
subtitle/time position
audio/media reference
encounter history
support used
memory state
```

Do not make contextless isolated cards the default.

---

### Pattern E — Planner-composed daily circuit

Strongest example: Yabla Fluency Club; adjacent signal from EnglishCentral's Watch->Learn->Speak sequence.

FlashDay should avoid:

```text
30 tools
-> learner must decide what to do
```

Prefer:

```text
LearnerProjection + MemoryState + goals + available time
-> planner
-> 1 bounded session
-> 3-6 ordered tasks
-> explicit reason
```

The user may override, but the default path should be clear.

---

### Pattern F — Input should lead to output

Strongest examples: EnglishCentral, eJOY, Yabla.

Real content should not terminate at passive consumption.

Possible progression:

```text
watch/read/listen
-> comprehension
-> lexical noticing
-> recall
-> production
-> role-play/fresh use
```

Not every content item needs all stages; planner/TaskContract decides.

---

### Pattern G — Speaking feedback must preserve flow

Strongest examples: Gliglish, Praktika, Speechling.

Separate:

- communicative success;
- pronunciation;
- grammar;
- lexical choice;
- fluency;
- acoustic detail.

Do not create one "speaking score" that becomes capability truth.

---

## 5. Decisions for FlashDay

### Adopt

1. **Content-to-Task Multiplexer**
   - one canonical segment can feed multiple task types;
   - same provenance retained across tasks.

2. **Support Action Timeline**
   - support operations become ordered observations;
   - final attempt evidence can distinguish when support occurred.

3. **Correction Episode Lifecycle**
   - failure opens repair work;
   - correction must lead to another performance opportunity.

4. **Context-Rich Capture**
   - vocabulary/chunks saved with source context and encounter history.

5. **Planner-Composed Session**
   - default user experience is one recommended bounded circuit, not a toolbox grid.

6. **Input-to-Output Escalation**
   - content may progress from comprehension to production when evidence-safe.

7. **Self-listen / Compare / Rerecord**
   - useful speech UX even when pronunciation evaluator authority is not yet established.

8. **Context-aware difficulty**
   - known vocabulary and lexical coverage may guide content recommendation.

### Adapt carefully

- role play;
- AI conversation;
- AI explanations;
- pronunciation highlighting;
- personalized quizzes;
- daily streak/goals.

These are allowed only with explicit evidence boundaries.

### Reject as authority

- activity score -> mastery;
- game completion -> proficiency;
- AI score -> speaking ability;
- video completion -> capability;
- SRS state -> proficiency;
- transcript match -> pronunciation quality;
- "known word" count -> overall CEFR level.

---

## 6. Roadmap ownership

### Wave 2 — Architecture consolidation

Use research only to clarify semantics:

- support timeline must remain compatible with EvidenceEvent provenance;
- correction/remediation constructs belong to kernel projection, not UI-only weak flags;
- planner consumers must not be migrated to constructs that do not yet exist.

Do not implement content-product features merely because research found them.

### Wave 3 — Speech / Pronunciation

Use:

- Speechling self-listen/rerecord/history pattern;
- Gliglish/Praktika conversation-preserving correction;
- eJOY/Yabla role-play/shadowing as execution-surface references.

Do not grant pronunciation authority without the separate technology/calibration benchmark.

### Wave 4 — Content Factory

Canonical content must support reusable segmentation so one source segment can legally feed several later TaskContracts.

### Wave 5 — Core Multimodal Loop

Implement/research-gate:

- Content-to-Task Multiplexer;
- Support Action Timeline;
- Correction Episode lifecycle;
- input-to-output escalation;
- self-listen/retry where applicable.

### Wave 6 — Immersion / Learn From Anything

Implement/research-gate:

- sentence-level player navigation;
- auto-pause/replay;
- contextual lookup;
- context-rich lexical capture;
- lexical-coverage-based difficulty;
- saved source position;
- media-aware vocabulary/chunk records.

### Wave 7 — Planner v2

Implement/research-gate:

- planner-composed daily circuit;
- bounded task count;
- session reason;
- interleave remediation + memory + fresh input + production;
- avoid tool-browser default UX.

### Wave 8 — AI Tutor

Implement/research-gate:

- conversation-preserving feedback;
- candidate-error capture;
- correction prioritization;
- targeted repair generation;
- no direct mastery mutation.

---

## 7. Concrete future backlog

### R-01 — Content-to-Task Multiplexer

**Owner:** Wave 4 -> Wave 5  
**Goal:** one content segment can instantiate multiple registered TaskContracts without duplicating semantic source data.

Acceptance:

- provenance stable across all derived tasks;
- task-specific fields stay in TaskContract, not content;
- source segment can be replayed/audited;
- no task can infer stronger capability than its contract permits.

### R-02 — Support Action Timeline

**Owner:** Wave 5  
**Goal:** replace coarse final support booleans with ordered support observations where needed.

Acceptance:

- pre/during/post-response support can be distinguished;
- answer reveal after submission does not contaminate the first attempt as pre-answer support;
- replay/slow are distinguishable from answer-bearing hints;
- EvidenceEvent remains append-only.

### R-03 — Correction Episode + Retest

**Owner:** Wave 2 construct mapping -> Wave 5 UX  
**Goal:** failure/partial evidence creates structured remediation and a later retest.

Acceptance:

- correction != recovery;
- immediate retry != retention;
- delayed/fresh retest required for stronger recovery claims;
- UI wording derives from kernel state.

### R-04 — Context-Rich Lexical Capture

**Owner:** Wave 6  
**Goal:** capture words/chunks from real content with durable context.

Acceptance:

- source sentence + source provenance retained;
- multiple encounters accumulate;
- lookup and deliberate save are separately measurable;
- FSRS schedules memory only.

### R-05 — Personalized Content Difficulty

**Owner:** Wave 6 -> Wave 7  
**Goal:** estimate difficulty from lexical familiarity plus content properties.

Acceptance:

- estimate is advisory;
- known-word state does not become proficiency;
- static CEFR may be one input, not sole truth;
- recommendation reason is inspectable.

### R-06 — Planner-Composed Daily Circuit

**Owner:** Wave 7  
**Goal:** planner returns a bounded ordered session rather than a tool menu.

Acceptance:

- 3-6 task circuit target is configurable, not hard-coded as learning truth;
- reason shown;
- remediation/memory/fresh work may interleave;
- deterministic reference planner remains available.

### R-07 — Conversation-Preserving Correction

**Owner:** Wave 3 research -> Wave 8 production  
**Goal:** AI conversation captures errors without correcting every turn immediately.

Acceptance:

- communication can continue when appropriate;
- 1-3 high-value corrections can be selected;
- repair opportunity follows feedback;
- AI feedback remains non-authoritative unless separately validated.

---

## 8. Research cautions

1. Product landing pages describe product behavior, not necessarily learning efficacy.
2. "AI scoring" claims are not evaluator-validation evidence.
3. "Proficiency", "mastered" and similar product labels from competitors must not be imported into FlashDay semantics.
4. Competitor activity/streak/XP systems are motivation/product telemetry unless proven otherwise.
5. FlashDay should reuse mechanics, not visual layouts or copyrighted content.
6. Each implementation mission must refresh relevant competitor behavior because these products change over time.

---

## 9. Research conclusion

The main competitive opportunity is not to build more tools than VSpeak/eJOY/Migaku.

It is to combine their strongest execution mechanics with a stricter learning architecture:

```text
strong content UX
+ multimodal task surfaces
+ contextual capture
+ repair loops
+ planner-composed sessions
+ evidence authority
+ replayable learner projection
= FlashDay differentiation
```

FlashDay should win by making the next learning action more coherent and more honest, not by maximizing the visible feature count.
