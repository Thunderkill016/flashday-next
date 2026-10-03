# FlashDay Content Source Corpus Audit

Status: source-audit / research guidance  
Origin: extracted research library generated from the earlier English-materials ZIP/corpus.

## 1. Corpus inventory

The recovered catalog contains **255 discovered sources** organized into five categories:

| Category | Count |
|---|---:|
| Grammar & self-study roadmaps | 49 |
| Vocabulary, flashcards & communication | 64 |
| Pronunciation & listening | 46 |
| IELTS & TOEIC preparation | 52 |
| English for IT / Web Development | 44 |
| **Total** | **255** |

The same research bundle reports:

- 32 downloaded PDFs;
- 146 markdown research/guide files;
- a structured `materials_catalog.json` index.

This corpus is a **discovery/research lake**, not an automatically reusable content corpus.

## 2. Why the corpus cannot be ingested wholesale

The catalog mixes materially different source classes:

- official publisher or institution pages;
- official public wordlists/transcripts;
- school/language-centre articles;
- community/Facebook posts;
- Google Drive mirrors;
- Scribd/Studocu/FlipHTML mirrors;
- commercial textbooks;
- commercial exam banks;
- derivative vocabulary lists;
- unknown-rights PDFs.

Therefore:

```
discovered source != approved source
downloaded PDF != reusable content
free download != public domain
useful pedagogy != legal right to republish
```

Every source requires provenance + rights + quality classification before learner-facing reuse.

## 3. Triage classes

### A — production-reusable

Requirements:

- explicit public-domain/permissive license, OR
- FlashDay-authored, OR
- explicit publisher permission for the intended use;
- stable provenance;
- source can be cited/attributed;
- no third-party restricted components.

Examples already handled elsewhere:

- FlashDay-authored material;
- VOA resources/assets that pass the asset-level VOA rights gate.

### B — derived-metadata / reference-safe

Useful for:

- CEFR prior;
- topic discovery;
- pedagogical structure;
- grammar/function taxonomy;
- lexical candidates;
- pronunciation research;
- authoring decisions.

But do not republish source prose or examples.

Typical examples from the catalog:

- official Oxford wordlist references within the already-approved project scope;
- publisher course descriptions;
- academic/institutional metadata pages;
- official documentation about course organization.

### C — research-only commercial references

Use to study:

- teaching progression;
- task design;
- content coverage;
- exercise taxonomy;
- lexical organization;
- pronunciation pedagogy.

Do **not** ingest learner-facing prose/audio/images/questions without a license.

Examples appearing in the catalog include commercial families such as:

- English Grammar in Use / Essential Grammar in Use;
- English Pronunciation in Use;
- Cambridge IELTS books;
- Oxford English for Information Technology;
- Career Paths: Information Technology;
- commercial IELTS/TOEIC books.

### D — untrusted/unknown-rights mirrors

Examples:

- Scribd uploads;
- Studocu copies;
- random Drive folders;
- Facebook-shared book folders;
- FlipHTML mirrors;
- MediaFire mirrors;
- z-lib-derived copies;
- third-party "full PDF/audio" download pages.

These may identify a resource worth researching through its official source, but are not production sources.

### E — reject for ingestion

Reject:

- pirate/unauthorized mirrors;
- exam banks whose questions are copyrighted;
- scraped commercial dictionaries;
- unattributed compilations;
- sources whose provenance cannot be resolved;
- duplicate derivative wordlists with no authoritative origin.

## 4. Category-by-category value

### 4.1 Grammar & self-study roadmaps — 49

Useful for:

- identifying common Vietnamese sequencing expectations;
- grammar topic coverage audits;
- beginner pain points;
- explanation styles;
- exercise-type research.

Do not use blog/course sequencing as capability prerequisites.

Target integration:

```
grammar reference
→ grammar-support ontology
→ VN error patterns
→ capability-relevant support
```

Not:

```
book chapter order
→ FlashDay prerequisite graph
```

### 4.2 Vocabulary / flashcards / communication — 64

High-value signals:

- Oxford 3000/5000 references;
- thematic vocabulary organization;
- vocabulary learning methods;
- common communication topics;
- phrase/chunk lists.

Use authoritative lists only within verified rights scope.

Third-party "Oxford 3000 by topic" rewrites are useful as discovery signals but must not become the canonical lexical source.

Target integration:

```
authoritative difficulty prior
+ FlashDay semantic domains
+ chunks/collocations
+ VN learner risks
+ VOA encounters
```

### 4.3 Pronunciation & listening — 46

Useful research themes:

- IPA inventories;
- stress and rhythm;
- listening with transcript;
- pronunciation drills;
- BBC/VOA-style short listening formats;
- audio + transcript pairing;
- shadowing/repetition ideas.

Commercial pronunciation books remain research-only unless licensed.

Official media sources need separate rights review; a publicly accessible transcript does not automatically grant republication rights.

This category should later feed the Speech Technology + Speech Pedagogy missions, not be directly copied into the app.

### 4.4 IELTS & TOEIC — 52

Primary value:

- task-form research;
- academic vocabulary demand;
- reading/listening difficulty examples;
- writing/speaking rubric research;
- lexical resource expectations.

Do not ingest official/commercial test questions, answer keys or audio as FlashDay content without rights.

Exam preparation should be a later application layer, not the core capability ontology.

### 4.5 English for IT / Web Development — 44

High product relevance because FlashDay already has a Developer English track.

Useful research:

- domain vocabulary inventory;
- communicative situations in technical work;
- documentation vocabulary;
- meetings/issues/debugging/deployment contexts;
- role-specific chunks.

Many catalog entries are mirrors of commercial books, especially Oxford English for Information Technology and Career Paths.

Correct approach:

```
commercial book
→ research domain/task coverage
→ independently author FlashDay developer scenarios
→ attach rights-cleared authentic technical sources later
```

Do not copy textbook dialogues/exercises.

## 5. Priority extraction targets from the corpus

The corpus should be mined for **ideas and taxonomies**, not prose.

Priority 1:

- official/authoritative CEFR and wordlist references;
- public-domain/permissive media;
- institutional/open educational resources;
- official product/publisher metadata useful for curriculum comparison.

Priority 2:

- Vietnamese learner-oriented explanations for identifying pain points;
- grammar error patterns;
- vocabulary topic demand;
- pronunciation difficulties;
- lesson/exercise mechanics.

Priority 3:

- commercial books for architecture benchmarking only.

Reject as content source:

- mirrors;
- pirated PDFs;
- copied exam material;
- unattributed compilations.

## 6. Deduplication problem

The catalog contains many repeated references to the same underlying product.

Examples include multiple pages redistributing or discussing:

- Oxford 3000 / 5000;
- Cambridge IELTS;
- English Pronunciation in Use;
- Oxford English for Information Technology.

Future audit tooling should canonicalize:

```
underlyingWorkId
publisher
edition
officialUrl
discoveredVia[]
rightsClass
researchNotes
```

This avoids treating ten download pages as ten independent sources.

## 7. Proposed source model

```ts
interface ResearchSource {
  id: string

  title: string
  sourceType:
    | 'official'
    | 'institution'
    | 'publisher'
    | 'academic'
    | 'community'
    | 'mirror'
    | 'commercial-work'
    | 'unknown'

  canonicalWorkId?: string
  canonicalUrl?: string

  discoveredVia: string[]

  domains: string[]

  utility:
    | 'content-reusable'
    | 'metadata'
    | 'pedagogy'
    | 'taxonomy'
    | 'benchmark'
    | 'reject'

  rightsClass:
    | 'REUSABLE'
    | 'DERIVE_ONLY'
    | 'REFERENCE_ONLY'
    | 'UNKNOWN'
    | 'REJECTED'

  qualitySignals: string[]
  riskSignals: string[]

  notes?: string
}
```

## 8. Integration with existing source register

This audit supplements, rather than replaces:

- lexical source register;
- VOA asset-level rights;
- Content Factory source manifests;
- existing research exclusions.

The research ZIP/catalog should be registered as:

```
source = google-english-materials-research-corpus
role = DISCOVERY_INDEX
rights = MIXED / PER-ITEM
learnerFacing = false
```

No downstream code may interpret corpus membership as approval.

## 9. How it improves lesson development

Once curated, the corpus can strengthen:

### A0–A2

- grammar-support coverage;
- survival topics;
- pronunciation difficulty inventory;
- beginner lesson sequencing research.

### B1–C1

- thematic academic vocabulary;
- word formation;
- reading/listening task variety;
- writing/speaking language functions.

### Developer English

- technical semantic domains;
- work scenarios;
- domain collocations;
- documentation language.

### Speech

- pronunciation pedagogy comparisons;
- IPA/stress/rhythm drill designs;
- listening-shadowing workflow research.

## 10. Required workflow before using any source

```
discover
→ canonicalize underlying work
→ identify official source
→ classify rights
→ assess pedagogical value
→ extract principles/metadata
→ independently author or legally reuse
→ provenance check
→ Content Factory
```

Never:

```
find PDF
→ copy text/questions/audio
→ lesson
```

## 11. Current conclusion

The 255-item research corpus is valuable and should be retained.

Its highest value is not the 32 downloaded PDFs. Its value is the **map of what materials, methods, topics and commercial benchmarks exist**.

FlashDay should use it as an evidence-informed authoring research library while sourcing actual learner-facing content from rights-cleared or independently authored material.
