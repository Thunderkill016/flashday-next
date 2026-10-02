/*
 * flashday-foundation-v1 — authored pack types.
 *
 * The pack is DATA: every field here is pedagogical intent, not runtime
 * machinery. Seeding maps lessons onto the existing surfaces (collections
 * -> learning units -> text cycle; word items -> wordbook typed recall).
 * Validator rules live in validate-pack.ts; the principle->consequence
 * mapping in docs/flashday/CONTENT_LEARNING_RULES_V1.md.
 */

export type TrackId = 'a' | 'b' | 'c' | 'd' | 'e';

export type CefrLabel = 'pre-a1' | 'a1' | 'a2';

/**
 * Progressive disclosure — ordered smallest useful support first.
 * `audio`/`transcript` are listening-specific scaffolds (captions are
 * support, never the default — PRN-006); they still sit before reveal.
 */
export type SupportStep = 'context' | 'audio' | 'transcript' | 'lexical' | 'gloss-vi' | 'partial-model' | 'full-answer';

/** Review affordances with distinct evidentiary meaning — not auto-scheduled. */
export type ReviewVariant =
  | 'meaning-to-en' // Vietnamese cue -> produce the English chunk
  | 'en-to-meaning' // see English -> confirm meaning (recognition)
  | 'audio-to-meaning' // hear chunk -> identify meaning/function
  | 'context-to-phrase' // cloze sentence -> produce the missing chunk
  | 'context-to-production'; // changed context -> free production

export interface PackTarget {
  /** Stable id, e.g. `fd01.a01.t1`. */
  id: string;
  /** The chunk recalled verbatim — literal substring of sourceSentence. */
  chunk: string;
  /** Vietnamese retrieval cue; must NOT contain the English chunk. */
  cueVi: string;
  /** Sentence inside input.text carrying the chunk verbatim. */
  sourceSentence: string;
  /** Productive frame with an open slot — never the typed answer. */
  productionPattern: string;
  /** Pre-authored changed context for the transfer step. */
  transferContext: string;
  /** Heard-form hint for listening items (Track D) — reduced/stress
   *  notation shown beside the chunk, e.g. `≈ "whaddya"`. Required on
   *  track-D targets so the audio claim binds to a real field. */
  pronunciationNote?: string;
}

export interface PackTransferTask {
  /** English prompt for the changed-context task. */
  prompt: string;
  promptVi: string;
  /** The ONE dimension deliberately changed vs the learning context. */
  changesDimension: string;
}

export interface PackLesson {
  /** e.g. `a01`. Track prefix + order; seed ids derive as `fd01.<id>.*`. */
  id: string;
  track: TrackId;
  title: string;
  titleVi: string;
  /** Conservative estimate — a label, never a mastery claim. */
  cefr: CefrLabel;
  /** What the learner needs to DO (the communicative task). */
  task: string;
  /** Realistic situation: participants, place, purpose. */
  context: string;
  /** What counts as communicative success. */
  outcome: string;
  input: {
    /** Lesson display title == content title on the shelf. */
    title: string;
    /** Comprehensible input (authored dialogue/short text). */
    text: string;
    /** `authored` = original FlashDay text; `derived` requires a
     *  sourceRef with REUSABLE_CONTENT or LINK_AND_DERIVE class. */
    origin: 'authored' | 'derived';
    /** When origin is `derived`, the specific source the text derives from. */
    sourceRefId?: string;
    /** Minimal Vietnamese orientation shown with the input. */
    noteVi: string;
  };
  /** Short Vietnamese explanation of meaning/use — not a rule dump. */
  explanationVi: string;
  /** 4-8 active chunks; supporting vocab stays passive. */
  targets: PackTarget[];
  /** Ordered smallest-first; never starts at full-answer. */
  supportLadder: SupportStep[];
  transferTask: PackTransferTask;
  /** Affordances offered; scheduling is the scheduler's job. */
  reviewVariants: ReviewVariant[];
  /** Materials that informed language/topic/coverage (registry keys). */
  sourceRefs: string[];
  /** Evidence/principles that informed design (registry keys). */
  researchRefs: string[];
}

export interface PackTrack {
  id: TrackId;
  order: number;
  title: string;
  titleVi: string;
  description: string;
  descriptionVi: string;
}
