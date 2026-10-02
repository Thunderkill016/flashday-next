# English Source Library V2 — FlashDay Research & Adoption Plan

**Reviewed:** 2026-10-02  
**Input archive:** `ENGLISH_SOURCE_LIBRARY_V2(1).zip`  
**Archive audit:** 54 sources, 22 P0, 26 P1, 6 P2; bundled archive is a manifest/bootstrap library, not the heavy corpora themselves.

## 1. What the archive actually contains

The ZIP contains 13 files (~256 KB) plus an empty category directory structure:

- source manifest in CSV + JSON;
- source index;
- rights gate;
- coverage report;
- core schema proposal;
- full-product roadmap;
- audit/bootstrap/download scripts.

It does **not** bundle the large datasets/corpora. Those are intentionally fetched later through git/manual/heavy-download flows.

The included `scripts/audit.py` passes:

- 54 sources;
- 22 P0;
- 44 manual/research/reference download entries;
- no restricted source is pointed directly at APP_READY.

This is therefore best treated as a **source registry seed + research map**, not as production content.

---

## 2. Strongest architectural value

The library reinforces FlashDay's existing architecture rather than replacing it.

Useful pipeline:

```text
SourceAssertion
  -> rights/provenance gate
  -> canonical knowledge
  -> content/capability/task generation
  -> QA
  -> production artifact
```

The archive's proposed rights states and FlashDay should converge on:

```text
RAW
-> RIGHTS_REVIEWED
-> NORMALIZED
-> QA
-> APP_READY
```

No source jumps directly from downloaded/reference state into production.

---

## 3. Source roles for FlashDay

### A. Foundation / capability / progression

#### CEFR Companion + searchable descriptors

Role:

- capability graph reference;
- reception / production / interaction / mediation vocabulary;
- assessment-language discipline.

Authority:

- reference only;
- abstractions may be manually encoded with provenance;
- do not ingest/copy course text as product material.

#### CEFR-J / Open Language Profiles

Role:

- vocabulary progression candidate;
- grammar progression candidate;
- machine-readable level profile.

Verified upstream note:

- CEFR-J vocabulary + grammar profile datasets permit research and commercial use with citation;
- the Octanove C1/C2 vocabulary profile is CC BY-SA 4.0.

Decision:

**HIGH-PRIORITY WAVE 4 INPUT**, after version snapshot + attribution record.

Do not treat CEFR-J levels as absolute learner truth. They are curriculum/content priors.

---

### B. Lexical backbone

#### NGSL

Role:

- frequency/core vocabulary prior;
- lexical coverage calculation;
- content difficulty features.

Verified:

- CC BY-SA 4.0;
- redistribution/derived-data obligations must be tracked.

Decision:

**P0 Content Factory input.**

Do not turn rank directly into curriculum order or mastery.

#### Open English WordNet

Role:

- sense IDs;
- synonym/semantic relations;
- lexical graph;
- definitions/examples as candidate semantic material.

Verified:

- current Open English WordNet release is CC BY 4.0.

Decision:

**P0 lexical semantic backbone candidate.**

Pin exact release and preserve source/version per sense.

#### thichhoc-dict

Role:

- EN -> VI gloss candidates;
- inflection/headword lookup;
- Vietnamese support layer.

Verified project claims:

- data CC BY-SA 4.0;
- code MIT;
- usable commercially under attribution/share-alike terms;
- current English summary explicitly says meanings have not yet all been human-reviewed.

Decision:

**P0 candidate, but NEVER gold truth.**

Required QA:

- sense alignment against OEWN/headword;
- Vietnamese naturalness;
- hallucination/mistranslation checks;
- duplicate/variant cleanup;
- human review status.

---

### C. Pronunciation / speech

#### CMUdict

Role:

- US-English pronunciation lexicon;
- ARPAbet phonemes;
- lexical stress;
- pronunciation target/reference.

Verified upstream:

- research/commercial use is unrestricted;
- attribution/acknowledgement requested.

Decision:

**P0 pronunciation reference.**

Not a pronunciation scorer.

#### SpeechOcean762

Role:

- pronunciation-scoring benchmark;
- expert-labeled pronunciation score experiments.

Verified:

- CC BY 4.0;
- 5,000 English sentences;
- non-native speakers;
- all source speakers are Mandarin L1;
- five human expert raters.

Decision:

**W3 BENCHMARK ONLY for FlashDay's Vietnamese target.**

Never use SpeechOcean762 alone to claim Vietnamese-accent calibration.

#### Common Voice

Role:

- ASR robustness;
- diverse English speech;
- transport/model benchmark.

Current public dataset page exposes English scripted/spontaneous releases under CC0.

Decision:

**W3 ASR benchmark candidate**, not pronunciation-authority data.

Capture:

- exact release;
- locale/subset;
- speaker metadata actually available;
- access/redistribution conditions at download time.

#### Vietnamese-specific research

The archive correctly separates:

- final /s,z/ omission research;
- consonant-cluster research;
- /theta, eth/ research;
- L2-ARCTIC.

Decision:

Use findings to seed:

```text
Vietnamese Error/Risk Ontology
```

not stereotypes.

Each rule requires:

- population scope;
- evidence source;
- confidence;
- target feature;
- observed error;
- remediation candidate.

L2-ARCTIC remains research-only/non-commercial under the archive's classification.

---

### D. Learner-language / grammar-error layer

#### UD English ESLSpok

Role:

- spoken learner-English structures;
- non-native syntax/error research;
- parser/task-generator evaluation.

Verified:

- CC BY-SA 4.0.

Decision:

**P0 learner-language research/data candidate.**

Important limitation:

- not Vietnamese-specific.

#### UD English EWT

Role:

- syntax parsing benchmark;
- dependency patterns.

Archive correctly marks a caveat:

- open annotations do not automatically mean every underlying source text has identical reuse rights.

Decision:

Use primarily for parser/structure evaluation unless per-layer rights are proven.

#### UD English ESL / Treebank of Learner English

Archive marks:

`ANNOTATIONS_ONLY`

Decision:

Keep hard separation from restricted FCE source text.

---

### E. Sentence / example candidates

#### Tatoeba

Role:

- sentence candidates;
- EN <-> VI graph;
- example generation seed;
- translation pairing.

Verified Tatoeba download page:

- bulk sentence exports are CC BY 2.0 FR with a CC0 subset;
- audio license is per contributor;
- audio with empty license must not be reused outside Tatoeba.

Decision:

**PRODUCTION_PER_ASSET**, exactly as archive states.

Required ingestion key:

```text
sentence_id
text_license
translation_ids
audio_id?
audio_license?
attribution?
retrieved_at
source_snapshot
```

Never let sentence license imply audio license.

---

### F. Grammar / usage / collocation

#### CEFR-J grammar

Machine-readable progression candidate.

#### English Grammar Profile

Use as progression/reference benchmark only.

Do not scrape into product DB.

#### COCA

Use for:

- frequency sanity checks;
- collocation/register validation.

Do not bulk ingest/redistribute without licensing.

#### UD EWT

Use for syntax feature extraction/parser evaluation with rights caveat above.

Decision:

FlashDay should **derive its own canonical Construction graph** rather than copy a copyrighted grammar course.

---

### G. Assessment

Strong sources:

- CEFR Relating Examinations manual;
- Language Test Development/Examining manual;
- ALTE Can Do/QA material;
- CEFR illustrative tasks/resources.

Decision:

These belong to the **assessment-design layer**, not lesson content.

They should inform:

- item specification;
- construct coverage;
- standard-setting discipline;
- validation;
- score interpretation;
- CEFR linking.

Hard rule:

```text
app heuristic score
!=
CEFR level
```

No CEFR claim without a documented linking argument.

---

### H. Learning science

The archive's learning-science selection is useful because it balances mechanisms instead of only SRS.

High-value research themes:

- Four Strands;
- vocabulary-size/coverage research;
- extensive reading;
- word-card synthesis;
- involvement load;
- corrective-feedback timing;
- oral feedback;
- ASR pronunciation meta-analysis;
- writing feedback;
- gamification review.

Decision:

Use these papers to define **product hypotheses/guardrails**, not as downloadable lesson content.

Especially preserve:

```text
receptive word-card gain
!=
productive vocabulary use
```

and:

```text
engagement effect
!=
learning effect
```

---

### I. Reading / listening content

#### Gutenberg

Candidate extensive-reading source.

Rights are work/jurisdiction specific.

#### LibriVox

Candidate human narration.

Keep text and audio rights as separate objects.

Decision:

Wave 6 may ingest only per-work assets that pass explicit rights review.

---

### J. Parallel corpora

#### OPUS

Potential EN-VI candidate source.

Rights vary by sub-corpus.

Decision:

Never treat OPUS as one license.

#### EVBCorpus

Archive correctly labels:

`COMMERCIAL_RISK`

Decision:

Research-only until provenance/rightsholder audit resolves constituent material.

Do not put raw EVBCorpus into FlashDay production.

---

## 4. Adoption matrix

### Production-data candidates to investigate first

1. CEFR-J profile data
2. NGSL
3. Open English WordNet
4. thichhoc-dict
5. CMUdict
6. Tatoeba — per asset
7. UD English ESLSpok
8. FSRS library/version metadata

### W3 research/benchmark inputs

1. CMUdict
2. SpeechOcean762
3. Common Voice
4. L2-ARCTIC — research only
5. Vietnamese pronunciation studies
6. ASR pronunciation meta-analysis

### Reference-only design inputs

1. CEFR / ALTE assessment material
2. English Grammar Profile
3. British Council/Purdue explanation patterns
4. American English task/teacher resources
5. Cambridge corrective-feedback references
6. COCA unless licensed

### Explicit high-risk / blocked content

- EVBCorpus raw content;
- OPUS sub-corpora without per-corpus rights resolution;
- restricted learner corpus source text;
- L2-ARCTIC raw material for commercial shipping;
- random Tatoeba audio without per-audio license;
- copyrighted grammar/course material scraped into production.

---

## 5. Required FlashDay source registry

Every imported source should support at least:

```text
source_id
source_name
source_version
official_url
retrieved_at

rights_state
license
license_snapshot
attribution
commercial_use
share_alike
asset_scope

transformer_version
qa_status
human_review_status
lineage[]
```

Every claim/material derived from it needs a SourceAssertion:

```text
source_id
record_id
retrieved_at
source_version
rights_state
transformer_version
confidence
```

Unknown rights must fail closed.

---

## 6. Canonical knowledge entities suggested by the library

The archive's schema is directionally useful.

FlashDay Content Factory should eventually separate:

### Lexeme
- form
- lemma
- frequency priors
- pronunciation links

### Sense
- definitions/glosses
- EN-VI gloss candidates
- lexical relations

### Pronunciation
- dialect/locale
- phoneme sequence
- lexical stress
- source/version

### Construction
- form
- meanings
- functions
- constraints
- examples
- error patterns

### Communicative Function
- capability linkage
- CEFR assertions
- discourse context

### ErrorPattern
- target
- observed form
- modality
- population scope
- L1-transfer hypothesis
- evidence
- confidence
- remediation targets

### SourceAssertion
- provenance/rights for every imported claim

These are knowledge/content entities.

They are NOT LearnerProjection state.

---

## 7. Changes to roadmap

### Wave 3 — Speech / Pronunciation

Add mandatory source-lab work:

- CMUdict target/reference import;
- SpeechOcean762 benchmark with explicit Mandarin-L1 limitation;
- Common Voice ASR robustness experiments;
- Vietnamese-risk ontology seeded from Vietnam-specific studies;
- no pronunciation authority until Vietnamese-accent calibration exists.

### Wave 4 — Curriculum / Content Factory

Add:

- source registry + rights-state machine;
- SourceAssertion provenance;
- CEFR-J profile ingestion experiment;
- NGSL lexical-frequency layer;
- OEWN sense graph;
- thichhoc EN-VI gloss candidate layer + QA;
- construction/communicative-function graph;
- learner-error ontology;
- content QA pipeline.

### Wave 5 — Core multimodal loop

Task generation may consume canonical knowledge entities but never source records directly.

Every generated task must preserve:

- source lineage;
- target capability;
- lexical/grammar constraints;
- rights eligibility;
- review status.

### Wave 6 — Learn From Anything / Content Library

Add:

- per-work Gutenberg/LibriVox rights gate;
- Tatoeba per-sentence/per-audio licensing;
- contextual sentence/chunk capture;
- no OPUS/EVBCorpus raw shipping without rights resolution.

### Assessment work

CEFR/ALTE materials inform the validation process.

They do not become an item bank by copying examples.

---

## 8. Immediate implementation order

Do not download everything.

Recommended sequence:

```text
S0 manifest/schema validation
  ↓
S1 source registry + rights model
  ↓
S2 CEFR-J / NGSL / OEWN pilot
  ↓
S3 thichhoc-dict QA pilot
  ↓
S4 CMUdict pronunciation reference
  ↓
S5 Tatoeba per-asset import gate
  ↓
S6 learner-error research layer
  ↓
later heavy speech/corpus downloads
```

Heavy downloads such as SpeechOcean/Common Voice should wait until the relevant benchmark harness exists.

---

## 9. Important corrections / cautions

1. The ZIP README says 54 sources. The manifest audit confirms **54**, not 55.
2. Empty category directories do not mean data has already been acquired.
3. `16_PRODUCTION_DATA_CANDIDATES` does not mean APP_READY.
4. CEFR-J looks more usable than the manifest's conservative `VERIFY_BEFORE_SHIP` label suggests, but exact version/terms still need snapshotting before ship.
5. thichhoc-dict is highly valuable for Vietnam-first support, but its own current README warns that senses are not all human-reviewed.
6. SpeechOcean762 is useful for scorer engineering but cannot validate Vietnamese accent performance.
7. Common Voice is useful for ASR diversity/robustness, not phoneme-level pronunciation truth.
8. Tatoeba text and audio require separate rights decisions.
9. Open annotations may sit on copyrighted source text; treat them as separate rights objects.
10. No external dataset is allowed to become learner ability authority merely because it has CEFR labels or expert scores.

---

## 10. Final decision

**KEEP the source library as a project research/source-registry artifact.**

It is strong enough to guide FlashDay's Content Factory, but it is not a ready-made curriculum.

The winning use is:

```text
curated sources
+ rights/provenance
+ canonical knowledge graph
+ Vietnam-specific learner model
+ TaskContracts
+ Evidence/Projection/Planner
```

not:

```text
download datasets
-> dump into lessons
```
