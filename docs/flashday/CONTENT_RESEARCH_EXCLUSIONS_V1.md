# CONTENT_RESEARCH_EXCLUSIONS_V1 — what we did NOT operationalize

Saved-corpus findings deliberately deferred from `flashday-foundation-v1`,
with the reason and what future content would need to use them (mission
§32). None of these were skipped silently — each was weighed against a
30-lesson beginner pack.

## Deferred evidence families

### Extensive reading / listening graded library

- **Finding**: extensive reading shows the largest vocabulary effect
  (d≈1.32 in the corpus synthesis); extensive listening builds aural
  vocabulary incidentally (`sla-extensive-reading`, `sla-l2tv`).
- **Why deferred**: needs a graded text/audio library at scale — hundreds
  of hours of level-appropriate material — which is a content pipeline
  decision (and rights problem) bigger than this mission. The pack's
  short dense inputs are not a substitute; they coexist.
- **Needed later**: a rights-cleared graded reading source (e.g. public-
  domain graded readers) + coverage-level tagging.

### AI-generated feedback & corrective feedback timing research

- **Finding**: no universal feedback-timing rule; prompts beat recasts;
  explicit correction helps now, implicit lasts (`esl2-cf-timing`,
  `lsrules-feedback` partially applied).
- **Why deferred**: this pack is deterministic by design (mission §15–16 —
  no AI-dependent lesson). The runtime's self-correction + notes already
  implement "prompt before answer". AI feedback integration is a separate
  validated-path question (and the pack explicitly does not let AI scores
  mint mastery).
- **Needed later**: a validated AI-feedback path with recording of when
  feedback was shown relative to the attempt.

### Pronunciation production scoring

- **Finding**: HVPT evidence supports perception training; production
  gains need separate treatment and cannot be measured by ASR transcript
  match alone (`lsrules-hvpt`, PRN-014).
- **Why deferred**: Track D trains perception (boundaries, stress,
  connected speech). Production pronunciation via the existing Read/Speak
  modules is deliberately not claimed here — ASR match is a sensor signal,
  never a mastery signal.
- **Needed later**: calibrated production assessment — explicitly out of
  scope pending the speech-implementation gate.

### Placement/diagnostic assessment

- **Finding**: placement must bound what a lesson assumes, not gate it
  globally (W2-G03 boundary work).
- **Why deferred**: the pack is an entry-level open curriculum; sequencing
  is by utility not prerequisites (§4.1). Diagnostics belong to a
  separate assessment mission, not content.
- **Needed later**: a placement instrument feeding unit recommendations.

### Negotiation of meaning / interaction research

- **Finding**: interactive negotiation drives acquisition (interaction
  hypothesis evidence in the corpus).
- **Why deferred**: requires a partner — live or simulated. The existing
  Speak module offers AI conversation; making that evidence-bearing is a
  separate validated-path mission.
- **Needed later**: bounded interactive tasks (info-gap, clarification
  chains) built on the validated speak path.

### Exam preparation (IELTS/TOEIC)

- **Finding**: corpus holds exam banks and scoring rubrics.
- **Why deferred**: the pack targets practical survival/work English for
  a Vietnamese adult beginner — exam formats optimize different behavior.
  REFERENCE_ONLY rights also prohibit embedding exam materials.
- **Needed later**: a dedicated exam track if the product wants it.

### Spaced-repetition scheduling beyond what exists

- **Finding**: FSRS-v5 scheduling + review variants.
- **Why deferred — partially applied**: FSRS already schedules vocabulary
  reviews in the runtime (`vocabularyRecordId` per mode). The pack only
  authors `reviewVariants` affordances; deeper scheduling policy (which
  variant when) is a planner mission.
- **Needed later**: a planner that selects variants per evidence need.

### Writing process pedagogy (model-text analysis, multi-draft)

- **Finding**: draft → focused feedback → revision → NEW task transfer
  (mission §13).
- **Partially applied**: the text cycle already enforces output→correct
  (revision with notes) and `apply` (new context). Deferred: genre/model
  analysis as an explicit lesson type.
- **Needed later**: model-text lessons for writing-specific tracks.

### Media-based learning (captions, L2 TV viewing)

- **Finding**: captions help comprehension but are a scaffold that must
  be gated (`lsrules-captions`); incidental vocabulary from viewing is
  real but slow (`sla-l2tv`).
- **Partially applied**: the `transcript` support step exists in Track D
  ladders. Deferred: actual video/audio materials — the pack has no media
  assets, so lessons use TTS-via-existing-modules for audio.
- **Needed later**: rights-cleared audio/video content with per-asset
  licenses.

### Gloss formatting research

- **Finding**: gloss format/position affects cognitive load (`sla-gloss`).
- **Partially applied**: Vietnamese support is delivered as a compact
  appendix block, not inline per-word annotations.
- **Needed later**: UI-level gloss affordances (tap-to-gloss) once a
  richer reading surface exists.

## Corpus sources inspected but not cited per-lesson

- **RAG chunks** (`knowledge_base_chunks.jsonl`, 6,137): sampled for
  design principles; too broad for per-lesson citation.
- **Practice tests / exercise banks**: surveyed for format conventions;
  REFERENCE_ONLY, and exam-format drilling conflicts with task-first
  doctrine.
- **Community guides corpus**: informed topic expectations (cited as
  `community-guides` on d03); the Vietnamese prose was never embedded —
  all lesson text is authored.
- **Pirated/mirror material**: classified REJECTED (`pirate-mirrors`) and
  enforced by the validator.
