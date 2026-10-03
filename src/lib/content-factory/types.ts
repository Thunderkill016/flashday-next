/*
 * Content Factory — core types (FD-CONTENT-FACTORY-01, Parts 3/6/9).
 *
 * The ontology distinguishes curriculum concepts instead of collapsing
 * everything into "skill". LessonSpec V2 is the authoring contract: each
 * field declares its consumer class so docs can never claim runtime
 * behavior the runtime does not have.
 */

/* ---- Ontology kinds (Part 3) ---- */
export type OntologyKind =
  | 'capability' // what the learner can DO (task-level outcome)
  | 'function' // communicative speech act (e.g. request, clarify)
  | 'chunk' // formulaic sequence, the retrieval unit
  | 'vocabulary' // single word/lexeme
  | 'grammar' // grammar-as-support pattern
  | 'listening-microskill' // bottom-up/top-down listening tier
  | 'pronunciation-contrast' // VN-specific perception contrast
  | 'context' // domain/situation
  | 'task' // communicative task frame
  | 'lesson' // planning unit
  | 'review-activity' // retrieval variant
  | 'transfer-task'; // changed-context production

/* ---- Dependency relation kinds (Part 4) ----
 * A true prerequisite exists only when failing A makes B structurally
 * impossible or highly unreliable — never just "taught earlier". */
export type RelationKind =
  | 'true-prerequisite' // A failed -> B structurally blocked
  | 'recommended-sequence' // teaching order preference only
  | 'related-reinforcing' // mutual support, either order
  | 'recycles' // B reuses language introduced in A (recycling edge)
  | 'transfer-relation'; // B applies A's target in a changed context

/** Relations allowed to participate in cycles (recycling is cyclic by nature). */
export const CYCLE_ALLOWED: ReadonlySet<RelationKind> = new Set([
  'recycles',
  'related-reinforcing',
  'transfer-relation',
]);

export interface CurriculumEdge {
  from: string; // lesson id
  to: string; // lesson id
  kind: RelationKind;
  /** Why this edge exists — required for true-prerequisite. */
  rationale?: string;
}

/* ---- Source / research manifests (Parts 1, 25) ---- */
export type SourceClass = 'REUSABLE_CONTENT' | 'LINK_AND_DERIVE' | 'REFERENCE_ONLY' | 'REJECTED';

export interface SourceEntry {
  id: string;
  name: string;
  type: 'lakehouse-table' | 'json' | 'markdown-corpus' | 'pdf-corpus' | 'dataset' | 'repo-artifact' | 'framework';
  location: string;
  language: 'en' | 'vi' | 'mixed';
  domain: string;
  klass: SourceClass;
  allowedOps: string[];
  forbiddenOps: string[];
  role: 'evidence' | 'content-seed' | 'needs-analysis' | 'methodology' | 'denylist';
  /** 0-1 subjective extraction confidence for derived use. */
  confidence: number;
  coverage: string;
  limitations: string;
}

export interface ResearchEntry {
  id: string;
  name: string;
  where: string;
  principle: string;
}

/* ---- Normalized knowledge layer (Part 2) ---- */
export interface KnowledgeEntry {
  id: string;
  kind:
    | 'function'
    | 'can-do'
    | 'painpoint-theme'
    | 'chunk'
    | 'collocation'
    | 'vocabulary'
    | 'grammar-point'
    | 'l1-issue'
    | 'phonetic-contrast'
    | 'listening-microskill'
    | 'situation';
  statement: string;
  /** Vietnamese gloss where the source provides one. */
  glossVi?: string;
  sourceRefs: string[];
  researchRefs: string[];
  evidenceLevel: 'corpus-measured' | 'framework' | 'community-signal' | 'authored';
  tags: string[];
}

/* ---- LessonSpec V2 (Part 6) ---- */
export type TrackIdV2 =
  | 'survival' // A0-A1 essential interaction
  | 'everyday' // A1-A2 everyday functional
  | 'chunks' // high-frequency formulaic sequences
  | 'listening' // perception/decoding curriculum
  | 'pronunciation' // VN-specific sound contrasts
  | 'grammar-support' // functional grammar-as-support
  | 'developer' // workplace/dev English
  | 'review'; // spaced recycling lessons

export type CefrLevel = 'a0' | 'a1' | 'a2' | 'b1';

export type SupportStepV2 =
  | 'context'
  | 'audio'
  | 'transcript'
  | 'lexical'
  | 'gloss-vi'
  | 'partial-model'
  | 'full-answer';

export type ReviewVariantV2 =
  | 'meaning-to-en'
  | 'en-to-meaning'
  | 'audio-to-meaning'
  | 'context-to-phrase'
  | 'context-to-production';

export type TargetKind = 'chunk' | 'vocabulary' | 'grammar' | 'listening' | 'pronunciation';

export interface LessonTarget {
  id: string;
  kind: TargetKind;
  chunk: string;
  cueVi: string;
  /** Sentence inside input.text carrying the target verbatim. */
  sourceSentence: string;
  productionPattern: string;
  transferContext: string;
  /** Heard-form hint — required on listening/pronunciation targets. */
  pronunciationNote?: string;
  /** L1 contrast note — optional Vietnamese support (Part 16). */
  contrastVi?: string;
}

export interface LessonInput {
  title: string;
  text: string;
  origin: 'authored' | 'derived';
  /** Exact backing source for derived input — fail-closed. */
  sourceRefId?: string;
  noteVi: string;
}

export interface LessonTransferTask {
  prompt: string;
  promptVi: string;
  /** The dimension that genuinely changes — never just a name swap. */
  changesDimension: string;
}

export interface LessonSpec {
  id: string;
  /** Schema for this spec — 'lesson-spec/v2'. */
  specVersion: 'lesson-spec/v2';
  /** Content version for provenance — 'content/2.x'. */
  version: string;
  level: CefrLevel;
  track: TrackIdV2;
  /** Capability ontology ids this lesson trains. */
  capabilities: string[];
  title: string;
  titleVi: string;
  task: string;
  context: string;
  outcome: string;
  input: LessonInput;
  targets: LessonTarget[];
  supportLadder: SupportStepV2[];
  reviewVariants: ReviewVariantV2[];
  transferTask: LessonTransferTask;
  /** Relation edges OUT of this lesson (dependency graph, Part 4). */
  truePrerequisites: string[]; // lesson ids — hard gates
  /** Authored evidence for each hard gate — never auto-generated. */
  prerequisiteRationale?: Record<string, string>;
  recommendedAfter: string[]; // lesson ids — soft order
  recyclingFrom: string[]; // lesson ids — language reuse edges
  sourceRefs: string[];
  researchRefs: string[];
  /** Audio modality claim for listening lessons (Part 8 audio rule). */
  audioSource?: 'tts-synthetic' | 'recorded' | 'source-audio';
  /** Reserved for a future asset registry — recorded/source-audio are
   * rejected outright today; forbidden on tts-synthetic. */
  audioRef?: string;
}

/* ---- Field consumer map (Part 6 + 17) ----
 * Every LessonSpec field is classified so claims stay honest. */
export type FieldConsumer = 'runtime-consumed' | 'validator-consumed' | 'authoring-only' | 'carried-contract';

export const FIELD_CONSUMERS: Record<string, FieldConsumer> = {
  id: 'runtime-consumed',
  specVersion: 'validator-consumed',
  version: 'carried-contract',
  level: 'runtime-consumed', // maps to difficulty
  track: 'runtime-consumed', // maps to collection
  capabilities: 'carried-contract',
  title: 'runtime-consumed',
  titleVi: 'runtime-consumed',
  task: 'runtime-consumed', // embedded in lesson text
  context: 'runtime-consumed', // scenario metadata + text
  outcome: 'runtime-consumed',
  'input.text': 'runtime-consumed',
  'input.noteVi': 'runtime-consumed',
  'input.origin': 'validator-consumed',
  'input.sourceRefId': 'validator-consumed',
  'targets[].chunk': 'runtime-consumed',
  'targets[].cueVi': 'runtime-consumed',
  'targets[].sourceSentence': 'runtime-consumed',
  'targets[].productionPattern': 'carried-contract',
  'targets[].transferContext': 'carried-contract',
  'targets[].pronunciationNote': 'runtime-consumed', // vocabulary.pronunciation
  'targets[].contrastVi': 'carried-contract',
  supportLadder: 'carried-contract',
  reviewVariants: 'carried-contract', // affordances exist pack-wide via modes
  'transferTask.prompt': 'runtime-consumed', // embedded text + fd metadata
  'transferTask.promptVi': 'runtime-consumed',
  'transferTask.changesDimension': 'validator-consumed',
  truePrerequisites: 'validator-consumed',
  prerequisiteRationale: 'validator-consumed',
  recommendedAfter: 'validator-consumed',
  recyclingFrom: 'validator-consumed',
  sourceRefs: 'validator-consumed',
  researchRefs: 'validator-consumed',
  audioSource: 'carried-contract',
  audioRef: 'carried-contract',
};

/* ---- Compiler outputs (Part 7) ---- */
export interface PackManifest {
  packId: string;
  version: string;
  schemaVersion: 'lesson-spec/v2';
  lessonIds: string[];
  targetIds: string[];
  dependencies: string[]; // packIds this pack recycles from
  sourceManifestVersion: string;
  builtAt: number;
  compilerVersion: string;
}

export interface CompileReport {
  pack: PackManifest;
  lessons: number;
  targets: number;
  /** contentId -> lessonId provenance map. */
  provenance: Record<string, string>;
  warnings: string[];
}

/* ---- Validation (Part 8) ---- */
export interface ValidationIssue {
  id: string; // lessonId or 'pack'
  code: string;
  message: string;
}

/* ---- Recycling (Part 13) ---- */
export type RecyclingStage = 'introduced' | 'practiced' | 'retrieved' | 'recycled' | 'transferred';
