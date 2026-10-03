# FlashDay Learning Content & Knowledge Research — Master Synthesis

Status: master research synthesis / source-of-truth  
Scope: consolidates all research and source-library findings reviewed to date.

## 1. Purpose

This document is the single synthesis layer above individual research notes, source catalogs, PDFs and corpus reports.

It answers:

1. what each source family is useful for;
2. what may be reused vs only studied;
3. which durable product principles have been extracted;
4. how those principles fit FlashDay's architecture;
5. what should be built next.

No source in this document gains reuse rights merely by being listed.

## 2. Research corpora consolidated

### 2.1 Aggregated English materials research corpus

Recovered catalog/report characteristics:

- 255 discovered source records;
- 5 categories;
- 30 search queries;
- 100 resolved domains;
- 5,237 external links recorded;
- 32 PDF associations / 30 unique PDF filenames;
- 146 catalog records with markdown guide paths;
- 290 unique direct-audio URLs discovered;
- 0 downloaded audio assets in that phase;
- many Google Drive/external candidates;
- mixed source quality and rights.

The corpus therefore functions as:

```
DISCOVERY / PROVENANCE INDEX
```

not as a production content corpus.

### 2.2 Category coverage

- Grammar & self-study roadmaps: 49 sources
- Vocabulary / flashcards / communication: 64
- Pronunciation & listening: 46
- IELTS / TOEIC: 52
- English for IT / Web Development: 44

Each category has distinct research value.

### 2.3 Commercial/reference PDFs reviewed directly

Reviewed patterns include:

- WORD BANKS
- My Topics / OALD-inspired thematic dictionary
- UNLOCK YOUR VOCABULARY
- Thematic Vocabulary in Use

These are architecture/pedagogy references unless separately licensed.

### 2.4 Rights-cleared authentic source program

VOA Learning English is the main current candidate for:

- authentic graded text;
- real audio;
- transcripts;
- authentic lexical re-encounters;
- listening material.

VOA remains subject to resource- and asset-level rights verification.

## 3. Unified source roles

### Research source

Used to understand:

- pedagogy;
- course structure;
- task types;
- error patterns;
- sequencing;
- lexical organization;
- speech pedagogy.

May be commercial/reference-only.

### Knowledge source

Used to derive structured facts such as:

- CEFR priors;
- morphology;
- function categories;
- pronunciation contrasts;
- semantic domains.

Must have a valid derivation/reuse path.

### Carrier-material source

Provides:

- reading;
- listening;
- dialogue;
- authentic examples;
- audio/video.

Requires explicit rights for learner-facing reuse.

### Learner-evidence source

There is no external content source that directly supplies learner truth.

Learner truth comes only from:

```
TaskContract
→ executed learner action
→ evaluator / authority
→ EvidenceEvent
→ projection
```

## 4. Unified learning-content architecture

```
SOURCE RESEARCH
   │
   ├── commercial/reference research
   ├── open/public-domain resources
   ├── learner research
   └── linguistic research
   │
   ▼
KNOWLEDGE LAYER
   │
   ├── semantic domains
   ├── lexical concepts
   ├── collocations
   ├── constructions
   ├── morphology
   ├── grammar support
   ├── VN learner risks
   ├── pronunciation contrasts
   └── listening microskills
   │
   ▼
CONTENT FACTORY
   │
   ├── authored curriculum
   ├── contextual lexical units
   ├── review/recycling
   └── carrier material links
   │
   ▼
AUTHENTIC MATERIAL LAYER
   │
   ├── VOA text
   ├── VOA audio
   └── future rights-cleared media
   │
   ▼
TASK / MISSION
   │
   ▼
EVIDENCE KERNEL
```

## 5. Durable pedagogy extracted

### 5.1 Context-first vocabulary

Preferred for many thematic B1+ units:

```
read/listen for meaning
→ notice target language
→ inspect lexical knowledge
→ retrieve
→ manipulate
→ produce
→ re-encounter
→ transfer
```

### 5.2 Semantic breadth

Use semantic domains to organize the lexical universe.

Do not use topic hierarchy as prerequisite order.

### 5.3 Lexical depth

For important concepts, represent:

- meaning;
- forms;
- pronunciation;
- collocations;
- constructions;
- register;
- regional variation;
- semantic contrasts;
- VN-specific errors;
- authentic encounters.

### 5.4 Morphological leverage

Use prefix/root/suffix knowledge to help infer unfamiliar academic words.

Do not equate successful inference with knowing the word.

### 5.5 Recognition-to-production progression

Exercise primitives should move across:

```
recognition
→ discrimination
→ completion
→ retrieval
→ transformation
→ production
→ transfer
```

Planner/evidence decides which step matters for the learner.

### 5.6 Recycling over chapter completion

A concept should reappear across:

- later lessons;
- different semantic domains;
- authentic material;
- delayed retrieval;
- production.

Completion of one worksheet is not mastery.

## 6. Unified lexical architecture

Core objects:

- SemanticDomain
- LexicalConcept
- LexicalSense
- LexicalForm
- Collocation
- LexicalConstruction
- LexicalRelation
- LexicalContrast
- ErrorPattern
- Morpheme
- MorphemeAnalysis
- WordFamily
- MorphologyWarning
- LexicalOccurrence
- AuthenticEncounter
- ContextualLexicalUnit

This layer should be shared by:

- vocabulary;
- reading;
- listening;
- writing;
- speech.

Do not build separate dictionaries for each skill.

## 7. Grammar

Research corpus value:

- grammar topic coverage;
- explanation patterns;
- common learner sequences;
- exercise forms;
- Vietnamese error signals.

Architecture rule:

```
grammar = support for communicative capability
```

not:

```
grammar chapter order = ability graph
```

Grammar knowledge should attach to:

- constructions;
- error patterns;
- communicative functions;
- tasks where needed.

## 8. Reading

Reading serves several roles:

- contextual carrier;
- lexical encounter;
- comprehension practice;
- discourse exposure;
- later retelling/production carrier.

Reading completion alone must not mint lexical or communicative mastery.

Future reading content should prefer:

- independently authored controlled texts;
- public-domain/permissive texts;
- VOA/other rights-cleared authentic material.

## 9. Listening

The research library reveals a major gap:

- many listening resources were discovered;
- direct audio links exist;
- but the older corpus ingest contains effectively no validated audio corpus.

Therefore the VOA audio registry work is structurally important, not optional.

Listening architecture should represent:

- audio asset identity;
- transcript identity;
- delivery completion;
- replay support;
- listening microskills;
- lexical occurrences;
- rights/provenance.

## 10. Speech / pronunciation

The research corpus should feed a later speech mission in two different ways.

### Pedagogy layer

Benchmark ideas from:

- English Pronunciation in Use and similar commercial programs;
- Vietnamese pronunciation guides;
- shadowing/listen-repeat workflows;
- stress/rhythm/connected-speech materials;
- top speech products.

These are research references unless licensed.

### Technology/evidence layer

Production implementation should benchmark free/open technology for:

- microphone capture;
- VAD;
- ASR observation;
- alignment;
- phone-level evidence;
- prosody;
- calibration.

Speech must reuse lexical forms, IPA, regional variants, morphology pronunciation shifts and VN learner-risk knowledge.

No ASR transcript-match shortcut to pronunciation mastery.

## 11. IELTS / TOEIC

Use for research into:

- task forms;
- difficulty;
- academic lexical demand;
- response expectations;
- rubric structure.

Do not treat commercial exam banks as reusable content.

Exam prep belongs above the core capability system, not inside it.

## 12. Developer English

The source library has substantial IT-English coverage.

Use it to research:

- domain vocabulary;
- debugging;
- deployment;
- documentation;
- issue discussion;
- meetings;
- requirement clarification;
- code review;
- incident communication.

Commercial textbook content is reference-only.

FlashDay should independently author realistic technical scenarios, then attach rights-cleared authentic materials where available.

## 13. Vietnamese learner layer

The product should remain Vietnamese-first where this adds learning value.

Structured reusable knowledge should include:

- direct-translation errors;
- article/countability problems;
- collocation errors;
- preposition errors;
- pronunciation contrasts;
- final consonant problems;
- cluster problems;
- stress/rhythm issues;
- lexical false friends;
- register misuse.

Use learner-community data as aggregate demand/error signals, not as authoritative linguistic truth or learner-facing quotes.

## 14. Rights model

Every source must resolve to one of:

```
REUSABLE
DERIVE_ONLY
REFERENCE_ONLY
UNKNOWN
REJECTED
```

Rules:

- free download != reusable;
- public website != public domain;
- search result count != quality;
- copied commercial PDF != source authority;
- a mirror can help identify an original work but never grants rights;
- unknown fails closed.

## 15. Quality model

Rights-clean content can still be pedagogically weak.

Evaluate separately:

- linguistic quality;
- level fit;
- communicative usefulness;
- naturalness;
- authenticity;
- Vietnamese learner relevance;
- recycling value;
- taskability;
- source reliability.

Thus:

```
rightsStatus != qualityStatus
```

## 16. Source deduplication

The research corpus contains repeated discovery pages for the same underlying products.

Future source tooling should canonicalize by:

```
underlyingWorkId
publisher
edition
officialUrl
discoveredVia[]
rightsClass
pedagogicalRoles[]
```

This prevents 10 blog/download pages from being counted as 10 independent sources.

## 17. What should become product content

Preferred production source hierarchy:

1. FlashDay-authored controlled content.
2. Public-domain/permissive authentic resources.
3. Rights-cleared media with source provenance.
4. Derived linguistic metadata within allowed scope.
5. Commercial/reference sources only as inspiration/benchmark.

## 18. What should not become product content

Do not ingest:

- pirated commercial PDFs;
- copied dictionary definitions/examples;
- Cambridge/IELTS/TOEIC copyrighted question banks;
- unknown-origin wordlists;
- third-party audio with unclear rights;
- social-media posts as lesson prose;
- mirror-site copies.

## 19. Research-library ingestion policy

Treat every uploaded/recovered ZIP/source library as:

```
research artifact
→ inventory
→ classify
→ dedupe
→ extract durable principles
→ update master synthesis
```

Do not create one architecture per ZIP.

All useful findings converge into this master model.

## 20. Gaps revealed by all research so far

Major remaining gaps:

1. rights-cleared real audio at scale;
2. full reading corpus with clear reuse rights;
3. native speaking execution;
4. calibrated pronunciation evidence;
5. B1+ curriculum;
6. complete writing curriculum;
7. deeper semantic-domain coverage;
8. lexical knowledge implementation;
9. automated source canonicalization/rights audit;
10. real learner validation.

## 21. Development order

Near-term:

```
M2 end-to-end learner journey
→ VOA corpus hardening
→ lexical knowledge implementation slice
→ M3 native speech
→ speech evidence hardening
→ pronunciation calibration
→ broader B1+ contextual curriculum
```

Do not let research expansion block end-to-end learner value.

## 22. Master principle

The research library exists to improve authoring decisions.

It is not the curriculum itself.

FlashDay should become:

> a system that combines independently authored curriculum, structured linguistic knowledge, rights-cleared authentic material, Vietnamese learner-specific support and trustworthy evidence — rather than a repository of copied English-learning PDFs.
