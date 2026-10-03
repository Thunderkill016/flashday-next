# CONTENT_LEARNING_RULES_V1 — research principle → lesson construction consequence

Compact traceability for the `flashday-foundation-v1` pack. Each rule maps a
saved-corpus principle to a checkable consequence in the authored lessons.
Not an ontology — a construction contract.

## Task-first curriculum (needs analysis)

- **PRN-TASK-001** Unit of planning is a communicative task, not a grammar
  topic. Every lesson declares `task`, `context`, `outcome` — "Explain a
  bug", not "Present Continuous". (Nation & Macalister needs-first;
  `LEARNER_AND_ENVIRONMENT.md`; TBLT g = 0.61 corrected — product rules)
- **PRN-TASK-002** No global prerequisite tree. Lesson order reflects
  utility / task difficulty / support demand only; `prerequisites` is not
  used to fake a universal acquisition order. (§4.1; corpus has no
  evidence for a fixed order)

## Attempt before reveal, support changes meaning

- **PRN-003** Retrieval items collect an attempt BEFORE any answer-bearing
  support. Cues never contain the target (validator-enforced: `cueVi` and
  masked sentence must not leak the chunk). (Product rules "minimum
  learning loop" + gate precedent)
- **PRN-004** Support is a ladder, smallest useful first:
  `context → lexical → gloss-vi → partial-model → full-answer`.
  A ladder may not start at `full-answer`. (28-day contract P3→P0 scale;
  §4.8)
- **PRN-005** Used support downgrades the evidence: assisted correct ≠
  independent correct. `cycle.assisted` / `sourceRevealed` / `usedTranslation`
  already recorded by the text-cycle runtime. (Product rules §support)
- **PRN-006** Captions/transcript are scaffolds, never default.
  (Montero Perez et al. 2013 meta-analysis; product rules)

## Reception ≠ production; production is the spine

- **PRN-007** Every lesson ends in learner generation: text-cycle `output`
  (free write) plus a changed-context `transfer` task. Recognition alone
  never completes a lesson. (Assembly bottleneck — "biết từ nhưng không
  ghép thành câu"; `BUILDING_FOR_VIETNAMESE_LEARNERS.md`; recognition d=.69
  vs production d=.47 retention pattern)
- **PRN-008** Chunks are the unit, not single words. Every target is a
  multi-word sequence / formulaic frame with a Vietnamese cue.
  (Formulaic sequences → fewer pauses, β=.40; `LEARNER_AND_ENVIRONMENT.md`)

## Transfer and novelty budget

- **CLM-TRN-001** Every lesson contains ≥1 changed-context task that reuses
  a target chunk in a new situation, changing ~1 dimension (topic, role,
  or event — not all). Same-prompt repetition is not transfer.
  (Product rules "transfer must change context"; §23–24)

## Vietnamese as legitimate support

- **PRN-009** Vietnamese is allowed and strategic: `cueVi`, `noteVi`,
  `explanationVi` carry instruction/meaning/contrast; the English target
  stays the object learned. (L1 glossing beats L2 across 78 effect sizes;
  `BUILDING_FOR_VIETNAMESE_LEARNERS.md`)
- **PRN-010** Fading is evidence-based, not calendar-based. The ladder is
  authored per lesson; nothing disables support after N days.

## Vietnamese-specific language content

- **PRN-011** Track D trains the documented Vietnamese contrast set:
  final consonants, consonant clusters (77.4% feature-change / 78.2%
  deletion at 3+ consonants), /θ/–/ð/, tense–lax vowels.
  (`vietnamese_english_phonetic_contrast.json`; Can Tho cluster study —
  RESEARCH_REFERENCE)
- **PRN-012** Grammar support targets measured VN error classes:
  articles, prepositions, tense/agreement (28% of syntactic errors),
  plural marking. (lakehouse `fact_grammar_mastery`; TNU-JST study)

## Scheduler boundary

- **CLM-REV-009** FSRS decides WHEN to review, never WHETHER the learner
  can do the task. Lesson completion ≠ mastery; review variants carry
  distinct evidentiary meaning. (Product rules "spacing is durable state";
  FD authority model)

## Listening: decode vs comprehend

- **PRN-013** Listening lessons separate bottom-up decoding (boundaries,
  reductions, content-word filtering — microskill tiers 1–2) from top-down
  comprehension (gist, specific info — tiers 3–4).
  (lakehouse `dim_listening_microskills`; Goh & Vandergrift via dossier)
- **PRN-014** TTS is a sensor/support. A recognized or shadowed line is
  not pronunciation mastery; ASR is never a mastery signal.
  (ASR WER asymmetry; Ngo et al. meta-analysis via dossier; §11)

## Feedback

- **PRN-015** Feedback priority: meaning → target chunk → recurring
  high-value error. Not every error corrected; no universal timing rule.
  (CF timing systematic review; Lyster & Saito — prompts > recasts,
  product rules)
- **PRN-016** No AI-dependent lesson. Every required activity works on
  deterministic content. (Product rules "AI proposes, deterministic
  decides"; §15)

## Coverage as prior, not gate

- **PRN-017** Inputs keep non-target lexical load low (Oxford 5000 A1–A2
  words as prior via `oxford_5000_full.json`); coverage is a difficulty
  prior, never a hard 95% gate. (Laufer lexical-threshold paper;
  §10)

## Evidence shapes stay distinct

- **PRN-018** `understood / recalled / produced / transferred / retained`
  are separate evidence — one screen cannot mint another.
  (A0 dossier §1; CORE_SCHEMA_V2 evidence levels)
