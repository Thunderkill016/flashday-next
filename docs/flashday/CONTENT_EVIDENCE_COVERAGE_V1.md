# CONTENT_EVIDENCE_COVERAGE_V1 — flashday-foundation-v1

Per-lesson evidence map for the FD-CONTENT-01 pack (mission §31), plus the
reverse mapping (research principle → lessons). Ids are registry keys in
`src/lib/fd-content/references.ts`; the validator enforces that every id
resolves (`src/lib/fd-content/validate-pack.ts`).

Legend for mechanisms (all existing runtime surfaces, no new engine):

- **Retrieval**: chunk targets → word items (`cueVi — masked sentence` →
  type the English chunk; VocabularyWorkspace `spelling`/`meaning`/
  `dictation` modes) + text-cycle `recall` stage (delayed, rated).
- **Support**: authored `supportLadder` (context→lexical→gloss-vi→
  partial-model→full-answer; D adds `audio`/`transcript` before reveal);
  runtime records `assisted`/`sourceRevealed`/`usedTranslation`.
- **Production**: text-cycle `output` (free write, must not copy source) +
  `productionPattern` per target + vocabulary `application` mode (own
  sentence in a new situation).
- **Transfer**: text-cycle `apply` stage validates `expression` ⊆ source
  and `context` ∉ source at runtime; `transferTask` is the authored intent.
- **Review**: `reviewVariants` affordances + FSRS-scheduled vocabulary
  records + delayed `recall` (≥24h, `TEXT_CYCLE_INITIAL_DELAY`).

## Per-lesson evidence map

| Lesson | Target task | Targets | sourceRefs | researchRefs | Retrieval | Production | Transfer changes |
|---|---|---|---|---|---|---|---|
| a01 | Introduce yourself (first meeting) | 5 | fd-authored, nep-speaking-functions, nep-stage0, oxford-5000 | lsrules-loop, vn-assembly, vn-l1-support, lsrules-chunks, lake-functions, a0-evidence | spelling/meaning/dictation + lesson recall | output + application | teammate in chat, new person/channel |
| a02 | Ask name, spelling, origin, job | 5 | fd-authored, nep-speaking-functions, nep-dialogues, oxford-5000 | lsrules-loop, lsrules-retrieval, lake-functions, vn-l1-support, a0-evidence | same | same | info type (spelling + location) |
| a03 | Say what you do | 5 | fd-authored, nep-speaking-functions, nep-grammar-errors, oxford-5000 | lsrules-loop, vn-assembly, vn-grammar-errors, lake-functions, lsrules-chunks | same | same | written bio, self-prompted |
| a04 | Ask for clarification | 5 | fd-authored, nep-speaking-functions, nep-painpoints | lsrules-loop, lsrules-retrieval, vn-l1-support, lake-functions, lake-painpoints | same | same | cooking domain |
| a05 | Ask to repeat / slow down | 4 | fd-authored, nep-speaking-functions, nep-painpoints | lsrules-loop, lsrules-retrieval, lake-functions, lake-painpoints, day28-support-scale | same | same | wifi password, not gate number |
| a06 | Say what you need | 5 | fd-authored, nep-speaking-functions, nep-collocations | lsrules-loop, vn-assembly, lsrules-chunks, lake-functions, esl2-ilh | same | same | pharmacy setting |
| a07 | Make a simple request | 4 | fd-authored, nep-speaking-functions, nep-grammar-errors | lsrules-loop, lake-functions, vn-grammar-errors, lsrules-chunks, a0-contract | same | same | physical accommodation on a plane |
| a08 | Handle "I don't understand" | 4 | fd-authored, nep-speaking-functions, nep-painpoints | lsrules-loop, lsrules-feedback, lake-functions, lake-painpoints, vn-l1-support | same | same | medical setting + written fallback |
| b01 | Talk about your routine | 5 | fd-authored, nep-speaking-functions, nep-grammar-errors, oxford-5000 | lsrules-loop, vn-grammar-errors, lake-functions, vn-assembly, oxford-5k-prior | same | same | weekend day, not workday |
| b02 | Talk about time and schedules | 5 | fd-authored, nep-speaking-functions, nep-dialogues | lsrules-loop, lsrules-retrieval, lake-functions, lake-cando, vn-l1-support | same | same | timezone call problem |
| b03 | Make plans | 5 | fd-authored, nep-speaking-functions, nep-dialogues | lsrules-loop, lake-functions, lsrules-transfer, vn-l1-support, a0-contract | same | same | movie + work blocker |
| b04 | Describe a simple problem | 5 | fd-authored, nep-speaking-functions, nep-grammar-errors, nep-painpoints | lsrules-loop, vn-grammar-errors, lake-functions, lsrules-feedback, lake-painpoints | same | same | hotel appliance, not phone |
| b05 | Talk about something that happened | 5 | fd-authored, nep-speaking-functions, nep-grammar-errors | lsrules-loop, lsrules-transfer, vn-grammar-errors, lake-functions, a0-evidence | same | same | technical incident, not presentation |
| b06 | Give an opinion and uncertainty | 5 | fd-authored, nep-speaking-functions, nep-collocations | lsrules-loop, lsrules-chunks, lake-functions, vn-assembly, a0-contract | same | same | technical decision, higher stakes |
| c01 | Trying and fixing | 5 | fd-authored, nep-collocations, nep-speaking-functions | lsrules-chunks, lsrules-loop, vn-assembly, sla-l1-transfer, env-30min | same | same | network failure mid-call |
| c02 | Outcomes and small victories | 4 | fd-authored, nep-collocations, nep-grammar-errors | lsrules-chunks, lsrules-transfer, vn-assembly, sla-l1-transfer, lsrules-loop | same | same | learning a tool, not fixing code |
| c03 | Hedging and depending | 5 | fd-authored, nep-collocations, nep-speaking-functions | lsrules-chunks, lsrules-loop, lsrules-retrieval, vn-assembly, a0-evidence | same | same | timeline estimate, not a cause |
| c04 | Naming the problem | 5 | fd-authored, nep-collocations, nep-grammar-errors, nep-painpoints | lsrules-chunks, vn-grammar-errors, lsrules-loop, lake-painpoints, vn-assembly | same | same | delivery order, written report |
| c05 | Asking for explanation | 5 | fd-authored, nep-speaking-functions, nep-collocations | lsrules-chunks, lsrules-loop, lsrules-retrieval, vn-assembly, lake-functions | same | same | housing paperwork |
| c06 | Buying time and checking | 5 | fd-authored, nep-collocations, nep-painpoints | lsrules-chunks, vn-assembly, lake-painpoints, lsrules-loop, env-30min | same | same | voice call, a number |
| d01 | Hear word boundaries | 5 | nep-phonetic-db, nep-collocations, fd-authored | lsrules-hvpt, lake-microskills, vn-phonology, lsrules-captions, sla-final-consonants | audio→meaning first, then recall | production is reuse, not accent | new reduced phrase outside set |
| d02 | Stress and reduced speech | 4 | nep-phonetic-db, fd-authored | lsrules-hvpt, lake-microskills, vn-phonology, sla-shadowing-vn, lsrules-captions | stress-hunt before full parse | place stress when speaking | new sentence material |
| d03 | Connected-speech patterns | 5 | nep-phonetic-db, fd-authored, community-guides | lsrules-hvpt, lake-microskills, vn-phonology, lsrules-captions, a0-evidence | pattern recognition (link/drop/blend) | full written forms | haveta / shoulda beyond the list |
| d04 | Listen for meaningful chunks | 4 | nep-collocations, nep-phonetic-db, fd-authored | lsrules-hvpt, lsrules-chunks, lake-microskills, lsrules-loop, vn-phonology | meaning-blocks first, detail second | chunk reuse in speech | new voice message content |
| e01 | What are you working on? | 5 | fd-authored, english-for-it, nep-speaking-functions | lsrules-loop, lsrules-chunks, vn-assembly, lake-functions, lake-painpoints | same | same | async written standup |
| e02 | Describe frontend/backend/database work | 4 | fd-authored, english-for-it, oxford-5000 | lsrules-loop, lsrules-chunks, vn-assembly, lake-functions, oxford-5k-prior | same | same | whole-team intro format |
| e03 | Explain a bug | 6 | fd-authored, english-for-it, nep-grammar-errors | lsrules-loop, lsrules-chunks, vn-grammar-errors, lsrules-transfer, lake-painpoints | same | same | search feature, written ticket |
| e04 | Reproduce and report an issue | 5 | fd-authored, english-for-it, nep-speaking-functions | lsrules-loop, lsrules-chunks, vn-assembly, lsrules-retrieval, a0-contract | same | same | dark-mode bug, fuller ticket |
| e05 | Git / branch / pull request | 6 | fd-authored, english-for-it, nep-dialogues | lsrules-loop, lsrules-chunks, vn-assembly, lake-functions, lsrules-feedback | same | same | reviewer role, not author |
| e06 | Deployment / production problem | 5 | fd-authored, english-for-it, nep-speaking-functions | lsrules-loop, lsrules-chunks, lsrules-transfer, vn-assembly, env-30min | same | same | performance degradation, not outage |

## Reverse map — research principle → lessons

| Research ref | Applied in |
|---|---|
| lsrules-loop (gist→support→retrieval→transfer→delayed) | all 30 lessons via the text-cycle runtime + authored ladder |
| lsrules-chunks (formulaic sequences as units) | a01 a03 a06 a07 b06 c01–c06 d04 e01 e02 e03 e04 e05 e06 |
| vn-assembly (production is the spine) | a01 a03 a06 b01 b06 c01–c06 e01 e02 e04 e05 e06 |
| vn-l1-support (strategic Vietnamese) | a01 a02 a04 a08 b02 b03 — plus `noteVi`/`explanationVi`/`cueVi`/`promptVi` on every lesson |
| vn-grammar-errors (articles/preps/tense for VN) | a03 a07 b01 b04 b05 c04 e03 |
| vn-phonology (VN contrast set) | d01–d04 |
| lake-functions (speech-act inventory) | a01–a08 b01–b06 c05 e01 e02 e05 |
| lake-microskills (decode vs comprehend) | d01–d04 |
| lake-painpoints (needs analysis, 10.5k posts) | a04 a05 a08 b04 c04 c06 e01 e03 |
| lake-cando (CEFR descriptors as labels) | b02 (and conservative `cefr` labels on all lessons) |
| lsrules-retrieval (retrieval > restudy) | a02 a04 a05 b02 c03 c05 e04 — and every `word` target |
| lsrules-transfer (changed-context) | b03 b05 c02 e03 e06 — and every `transferTask` + `apply` stage |
| lsrules-feedback (prompts > recasts; priority order) | a08 b04 e05 |
| lsrules-hvpt (perception training, not production) | d01–d04 |
| lsrules-captions (transcript gated behind attempt) | d01–d03 (`transcript` sits late in the ladder) |
| lsrules-spacing (schedule ≠ mastery) | runtime: FSRS vocabulary records + delayed `recall`; completion is never labeled mastery |
| a0-evidence (distinct evidence per capability) | a01 a02 b05 c03 d03 — pack-wide via reviewVariants |
| a0-contract (can-do + targets + ladder + transfer + review) | a07 b03 b06 e04 — and the PackLesson schema itself |
| a0-four-strands | pack level: input (articles) + output (writing/production) + language-focused (chunks) + fluency (transfer) |
| day28-support-scale (P3→P0 fading) | a05; ladders authored per lesson, fade by design |
| esl2-rights (fail-closed rights gate) | validator `rejected-source`/`derived-from-restricted` rules |
| esl2-evidence-levels | reviewVariants carry distinct evidentiary meaning |
| esl2-ilh (involvement load) | a06 — need+search+evaluation in task design |
| esl2-vocab-cards (cards ≠ productive knowledge) | every target also requires production/transfer evidence |
| env-30min (phone-first, silent production OK) | c01 c06 e06 — short inputs, typed production valid |
| sla-l1-transfer (direct translation → unidiomatic) | c01 c02 — chunks taught as wholes, not VN→EN assembly |
| sla-shadowing-vn (suprasegmentals improve via shadowing) | d02 — rhythm/stress focus |
| sla-final-consonants (final-consonant training works) | d01 — word-final boundaries |
| sla-lexical-threshold (coverage as prior) | oxford-5k-prior on b01 e02; low non-target load pack-wide |
| oxford-5k-prior | b01 e02 |

## Evidence families: covered vs deferred

Covered: needs analysis (painpoints→lesson topics), vocabulary as chunks,
retrieval practice, spacing (runtime FSRS boundary), scaffolding ladder,
Vietnamese support, listening perception vs comprehension, formulaic
fluency, writing (output→correct loop), feedback priority, transfer,
assessment validity (evidence separation), AI/ASR boundary (nothing in
the pack lets a score mint mastery).

Deferred families are listed with reasons in
`CONTENT_RESEARCH_EXCLUSIONS_V1.md` — they were searched, considered, and
deliberately not operationalized, not silently dropped.
