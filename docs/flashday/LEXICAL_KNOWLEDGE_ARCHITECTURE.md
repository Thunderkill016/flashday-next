# FD-LEXICAL-KNOWLEDGE-01 — Lexical Knowledge Architecture Spec

Status: proposed authoritative spec  
Purpose: define the shared lexical knowledge layer for FlashDay.

## 1. Non-negotiable boundaries

```
knowledge != curriculum
curriculum != learner state
activity != ability
semantic domain != prerequisite graph
morpheme inference != known word
FSRS memory != capability
authentic encounter != mastery
```

Do not create a new learning engine.

## 2. System position

```
SOURCES / RESEARCH
Oxford / CEFR / NEP / VN research / VOA / FlashDay authored
                       |
                       v
              SEMANTIC DOMAIN GRAPH
                       |
                       v
              LEXICAL KNOWLEDGE GRAPH
                       |
          +------------+-------------+
          |                          |
          v                          v
  CONTENT FACTORY              MATERIAL INDEX
          |                          |
          +------------+-------------+
                       |
                       v
                TASK / MISSION
                       |
                       v
                EVIDENCE KERNEL
                       |
                       v
             LEARNER PROJECTION
```

## 3. Semantic domain graph

Purpose:

- browse by meaning;
- audit coverage;
- retrieve authentic materials;
- discover lexical neighbours;
- generate changed-domain transfer candidates.

Minimal shape:

```ts
interface SemanticDomain {
  id: string
  name: string
  nameVi: string
  parentId?: string
  aliases: string[]
  levelHint?: FlashDayLevel[]
  relatedDomainIds: string[]
  sourceRefs: SourceRef[]
}
```

Rules:

- FlashDay-owned IDs.
- Do not reproduce a commercial taxonomy wholesale.
- Membership does not imply teaching order.
- Unknown mapping stays unknown.

## 4. Lexical concept

```ts
type LexicalRole =
  | 'entity'
  | 'property'
  | 'action'
  | 'process'
  | 'relation'
  | 'measure'
  | 'construction'

interface LexicalConcept {
  id: string
  lemma: string
  normalizedForm: string

  partOfSpeech?: string
  role: LexicalRole

  senses: LexicalSense[]
  domains: DomainMembership[]

  forms: LexicalForm[]

  collocationIds: string[]
  constructionIds: string[]
  relationIds: string[]
  contrastIds: string[]
  morphemeAnalysisIds: string[]

  learnerRiskIds: string[]
  capabilityRefs: string[]
  authenticEncounterRefs: string[]

  sourceRefs: SourceRef[]
}
```

## 5. Lexical senses

```ts
interface LexicalSense {
  id: string
  glossVi?: string
  authoredDefinitionEn?: string

  cefr?: FlashDayLevel

  register?: string[]
  countability?: string
  grammarNotes?: string[]

  exampleRefs: string[]
  sourceRefs: SourceRef[]
}
```

Learner-facing definitions/examples must be independently authored or rights-cleared.

## 6. Forms and regional variants

```ts
interface LexicalForm {
  form: string
  locale?: string

  kind:
    | 'canonical'
    | 'regional'
    | 'inflected'
    | 'abbreviation'
    | 'variant'

  ipa?: string
  audioRefs?: string[]

  sourceRefs: SourceRef[]
}
```

Future speech evaluation must consume accepted variants rather than assume one pronunciation/spelling.

## 7. Collocations

```ts
interface Collocation {
  id: string
  conceptIds: string[]
  surfacePattern: string

  type:
    | 'verb-noun'
    | 'adjective-noun'
    | 'noun-noun'
    | 'verb-preposition'
    | 'adverb-adjective'
    | 'fixed-phrase'
    | 'other'

  levelHint?: FlashDayLevel
  register?: string[]

  exampleRefs: string[]
  sourceRefs: SourceRef[]
}
```

## 8. Lexical constructions

```ts
interface LexicalConstruction {
  id: string
  conceptId: string
  frame: string

  functionIds?: string[]
  exampleRefs: string[]

  sourceRefs: SourceRef[]
}
```

Examples of represented patterns:

- verb + object;
- verb + object + into + noun;
- adjective + preposition;
- be made of + material.

## 9. Relations and contrasts

```ts
interface LexicalRelation {
  fromConceptId: string
  toConceptId: string

  relation:
    | 'synonym'
    | 'near-synonym'
    | 'antonym'
    | 'broader'
    | 'narrower'
    | 'regional-equivalent'
    | 'word-family'
    | 'related'
}

interface LexicalContrast {
  id: string
  conceptIds: string[]
  sharedConcept: string

  dimensions: Array<{
    dimension:
      | 'meaning'
      | 'register'
      | 'region'
      | 'grammar'
      | 'countability'
      | 'collocation'
      | 'context'
      | 'pragmatics'

    notesVi?: string
  }>

  commonErrorPatternIds: string[]
  sourceRefs: SourceRef[]
}
```

## 10. Vietnamese learner-risk ontology

```ts
interface ErrorPattern {
  id: string
  targetConceptIds: string[]

  wrongPattern: string
  correctPattern: string

  errorType:
    | 'preposition'
    | 'countability'
    | 'word-form'
    | 'article'
    | 'number'
    | 'collocation'
    | 'false-friend'
    | 'direct-translation'
    | 'regional-form'
    | 'register'
    | 'other'

  likelyL1Cause?: string
  explanationVi?: string

  correctionTaskHints?: string[]

  sourceRefs: SourceRef[]
}
```

This should be shared across vocabulary, writing and future speech.

## 11. Morpheme graph

This is the major addition learned from UNLOCK YOUR VOCABULARY.

```ts
type MorphemeKind = 'prefix' | 'root' | 'suffix' | 'combining-form'

interface Morpheme {
  id: string
  form: string
  kind: MorphemeKind

  originLanguage?: string

  meaningVi: string
  meaningEn?: string

  domainHints?: string[]

  allomorphs?: string[]

  sourceRefs: SourceRef[]
}

interface MorphemeAnalysis {
  id: string
  conceptId: string

  parts: Array<{
    morphemeId: string
    surface: string
    contribution: string
  }>

  compositionality:
    | 'transparent'
    | 'partly-transparent'
    | 'opaque'

  confidence: number

  warningIds: string[]

  sourceRefs: SourceRef[]
}
```

### 11.1 Morphology rules

- decomposition must never be guessed silently;
- analysis carries confidence;
- same spelling does not guarantee same etymological morpheme;
- transparent decomposition can support inference tasks;
- opaque/false analyses require warnings;
- morphology does not independently mint lexical mastery.

### 11.2 Word-family model

```ts
interface WordFamily {
  id: string
  anchorConceptId?: string
  memberConceptIds: string[]

  sharedMorphemeIds: string[]

  relationship:
    | 'derivational'
    | 'inflectional'
    | 'etymological'
    | 'mixed'

  sourceRefs: SourceRef[]
}
```

Potential learning uses:

- word formation;
- infer unfamiliar academic vocabulary;
- compare related forms;
- recognize suffix/POS patterns;
- derive candidate meanings;
- repair incorrect morphological inference.

## 12. Morphology warnings

Introduce explicit warning objects for traps such as:

- folk etymology;
- misleading apparent roots;
- non-compositional modern meaning;
- same string, different origin;
- semantic drift;
- pronunciation changes across family members.

```ts
interface MorphologyWarning {
  id: string
  analysisId: string
  kind:
    | 'false-segmentation'
    | 'opaque-meaning'
    | 'semantic-drift'
    | 'pronunciation-shift'
    | 'same-form-different-origin'
    | 'other'

  explanationVi?: string
}
```

This supports the "coi chừng nhầm lẫn" mechanic without copying source prose.

## 13. Examples and authentic encounters

```ts
interface LexicalExample {
  id: string
  text: string

  kind:
    | 'authored-controlled'
    | 'authentic'
    | 'contrast'
    | 'error'
    | 'corrected'

  rightsStatus: RightsStatus
  sourceRefs: SourceRef[]
}

interface AuthenticEncounter {
  id: string
  conceptIds: string[]
  resourceId: string

  mediaAssetId?: string
  occurrence?: string

  level?: FlashDayLevel

  rightsStatus: RightsStatus
  resolvableMedia?: boolean

  sourceRefs: SourceRef[]
}
```

VOA encounters remain non-authoritative for learner ability until bound through TaskContracts and evaluators.

## 14. Learner lexical projection

Do not store learner state on `LexicalConcept`.

Potential projection dimensions:

```
encountered
meaning_recognized
form_recalled
collocation_controlled
construction_controlled
morpheme_inference_demonstrated
produced
retained
transferred
```

These must derive from canonical evidence.

Do not collapse them into one arbitrary mastery percentage.

## 15. Teaching-priority ranking

Domain membership is insufficient.

Candidate ranking may combine:

```
CEFR prior
frequency
semantic-domain relevance
capability need
learner history
curriculum position
recycling opportunity
authentic encounter availability
morphological leverage
```

Morphological leverage means a concept may be especially useful because it unlocks a productive word family, but this signal must not dominate communicative usefulness.

## 16. Exercise primitives

Recommended reusable primitives:

- definition recognition;
- contextual selection;
- collocation assembly;
- construction completion;
- constrained recall;
- L1→L2 recall;
- synonym/contrast discrimination;
- word formation;
- morpheme decomposition;
- infer meaning from morphemes + context;
- choose valid word-family member;
- detect false morphological inference;
- cloze;
- sentence production;
- sentence transformation;
- changed-context transfer.

Interaction primitive != ability.

## 17. Source/provenance policy

Every lexical fact must be traceable.

```ts
interface SourceRef {
  sourceId: string
  sourceKind: string
  rightsClass: string
  locator?: string
}
```

Unknown rights fail closed for learner-facing copied prose.

Commercial references may support architecture/research but must not be bulk-ingested into production unless licensed.

## 18. Integration with current FlashDay

### Content Factory

May consume lexical/domain/morphology knowledge as authoring input.

It must remain the curriculum compiler.

### VOA corpus

May attach rights-audited authentic encounters and real media assets.

It must not become lexical authority by itself.

### Evidence kernel

Remains the only capability truth path.

### FSRS

Remains memory scheduling only.

### Speech

Future speech can consume:

- accepted regional forms;
- IPA;
- pronunciation variants;
- word-family pronunciation shifts;
- VN-specific lexical/pronunciation risks;
- collocations/constructions for spoken feedback.

Speech must not create its own duplicate lexical database.

## 19. Proposed implementation slices

Do not implement everything at once.

### Slice A — schema + tiny authored fixture

Add:
- semantic domains;
- lexical concepts;
- forms;
- collocations;
- constructions;
- source refs.

Prove with a small FlashDay-authored fixture.

### Slice B — Vietnamese error patterns + contrasts

Integrate current VN learner research.

### Slice C — morpheme graph

Add a very small, independently authored morphology pilot.

Prove:
- transparent analysis;
- opaque warning;
- word-family link;
- no learner-state mutation.

### Slice D — VOA encounters

Link verified VOA resources to lexical concepts.

### Slice E — Content Factory consumption

Use knowledge as authoring/recycling support without changing learner semantics.

## 20. Explicit non-goals

Do not:

- scrape entire commercial dictionaries;
- reproduce OALD taxonomy wholesale;
- ingest WORD BANKS/My Topics/UNLOCK prose as production data;
- create a new planner;
- replace Content Factory;
- replace FSRS;
- create a numeric vocabulary mastery score;
- equate morphology inference with word knowledge;
- make topic membership a prerequisite;
- let authentic encounter alone mint evidence.

## 21. Acceptance principle

The architecture is correct when the same lexical concept can support:

```
browse by semantic domain
→ understand meaning
→ learn collocations/constructions
→ understand word-family/morphology
→ recognize VN-specific risks
→ encounter it in VOA
→ practice it in a task
→ demonstrate retention/transfer through evidence
```

without duplicating lexical truth across vocabulary, reading, writing and speech systems.


## 22. Context-first lexical learning units

Thematic Vocabulary in Use adds a fourth important authoring pattern:

```
semantic domain
→ contextual carrier passage
→ target occurrences
→ lexical unpacking
→ retrieval / word formation / collocation work
→ later production and transfer
```

### 22.1 New concept: contextual occurrence

A lexical concept should be linkable to exact authored/authentic occurrences.

```ts
interface LexicalOccurrence {
  id: string

  conceptId: string
  senseId?: string

  resourceId: string

  span?: {
    start: number
    end: number
  }

  sentenceId?: string

  role:
    | 'incidental'
    | 'target'
    | 'recycling'
    | 'contrast'

  sourceRefs: SourceRef[]
}
```

Purpose:

- highlight target language in reading/listening;
- trace a target from passage to task;
- count genuine re-encounters;
- distinguish target exposure from incidental exposure.

### 22.2 Encounter semantics

An occurrence may support an exposure event only when the learning surface actually presents it to the learner.

It must not directly set lexical competence.

```
occurrence exists in content != learner encountered it
learner saw occurrence != learner can recall it
```

### 22.3 Context-first authoring pattern

Content Factory should eventually support an authored lexical unit shaped like:

```ts
interface ContextualLexicalUnit {
  id: string

  domainId: string
  carrierResourceId: string

  targetConceptIds: string[]
  occurrenceIds: string[]

  exercisePlan: LexicalExercisePlan[]

  recyclingPlan?: {
    laterLessonIds?: string[]
    authenticEncounterIds?: string[]
  }
}
```

This is an authoring/content structure, not a learner-state object.

### 22.4 Exercise progression for contextual units

Recommended progression:

```
comprehend passage
→ notice target
→ inspect meaning/usage
→ recognition
→ contextual completion
→ word-family/word-formation
→ collocation
→ constrained production
→ free production
→ delayed re-encounter
```

The planner may skip or reorder stages based on evidence; React must not hard-code this as a universal sequence.

### 22.5 Reading-first does not imply reading-only

The same lexical concepts should later surface in:

- listening;
- writing;
- speaking;
- authentic VOA material;
- changed-domain transfer.

A thematic reading is a carrier for lexical learning, not the endpoint.

### 22.6 B1–C1 positioning

Context-first thematic reading is especially suitable for B1+ because learners can use discourse context to infer and refine meaning.

For lower levels, use shorter controlled passages and fewer lexical targets.

Do not import a fixed B1–C1 claim from a reference book as learner ability evidence.
