/*
 * Authoring helpers — fill honest defaults so specs stay readable.
 * Every LessonSpec field remains explicit at the type level; these only
 * supply the common case (author may still override per lesson).
 */
import type {
  LessonSpec,
  LessonTarget,
  ReviewVariantV2,
  SupportStepV2,
  TrackIdV2,
} from '../../content-factory/types.ts';

export const CONTENT_VERSION = 'content/2.0.0';

export const LADDER_DEFAULT: SupportStepV2[] = ['context', 'lexical', 'gloss-vi', 'partial-model', 'full-answer'];
export const LADDER_LISTEN: SupportStepV2[] = ['context', 'audio', 'transcript', 'gloss-vi', 'full-answer'];
export const VARIANTS_DEFAULT: ReviewVariantV2[] = ['meaning-to-en', 'en-to-meaning', 'context-to-phrase'];
export const VARIANTS_LISTEN: ReviewVariantV2[] = ['audio-to-meaning', 'meaning-to-en', 'context-to-phrase'];

export const SRC = {
  authored: ['fd-authored', 'oxford-5000'],
  functions: [
    'fd-authored',
    'nep-speaking-functions',
    'nep-dialogues',
    'nep-cando',
    'stage-0-curriculum',
    'oxford-5000',
  ],
  collocations: ['fd-authored', 'nep-collocations', 'oxford-5000'],
  grammar: ['fd-authored', 'nep-grammar-errors', 'oxford-5000'],
  phonetic: ['fd-authored', 'nep-phonetic-db', 'nep-phonemes'],
  microskills: ['fd-authored', 'nep-microskills', 'nep-phonetic-db', 'connected-speech-notes'],
  dialogues: ['fd-authored', 'nep-dialogues', 'oxford-5000'],
  dev: ['fd-authored', 'english-for-it', 'nep-painpoints', 'oxford-5000'],
} as const;

export const RES = {
  core: ['lsrules-loop', 'lsrules-chunks', 'vn-assembly', 'vn-l1-support', 'a0-evidence'],
  functions: [
    'lsrules-loop',
    'lake-functions',
    'vn-l1-support',
    'lsrules-chunks',
    'a0-evidence',
    'lake-cando',
    'esl2-vocab-cards',
    'a0-contract',
    'a0-four-strands',
    'sla-gloss',
    'day28-support-scale',
  ],
  listening: [
    'lsrules-hvpt',
    'lake-microskills',
    'vn-phonology',
    'listening-first-decoding',
    'lsrules-captions',
    'sla-shadowing-vn',
    'sla-l2tv',
    'sla-lexical-threshold',
  ],
  pronunciation: [
    'lsrules-hvpt',
    'vn-phonology',
    'vn-final-consonants',
    'sla-final-consonants',
    'lsrules-captions',
    'vn-stress-timing',
    'sla-l1-transfer',
  ],
  grammar: [
    'vn-grammar-errors',
    'lsrules-loop',
    'lsrules-feedback',
    'a0-evidence',
    'oxford-5k-prior',
    'sla-l1-transfer',
    'esl2-cf-timing',
  ],
  dev: ['dev-english-tasks', 'lsrules-loop', 'vn-assembly', 'lsrules-transfer', 'lake-painpoints'],
  transfer: [
    'lsrules-transfer',
    'lsrules-loop',
    'recycling-strand',
    'a0-evidence',
    'lsrules-retrieval',
    'lsrules-spacing',
  ],
} as const;

export interface LessonInit {
  id: string;
  level: LessonSpec['level'];
  track: TrackIdV2;
  capabilities: string[];
  title: string;
  titleVi: string;
  task: string;
  context: string;
  outcome: string;
  input: LessonSpec['input'];
  targets: LessonTarget[];
  transferTask: LessonSpec['transferTask'];
  supportLadder?: SupportStepV2[];
  reviewVariants?: ReviewVariantV2[];
  /** Lesson-level L1 contrast — applied to every target (never quote target words). */
  contrastVi?: string;
  truePrerequisites?: string[];
  recommendedAfter?: string[];
  recyclingFrom?: string[];
  sourceRefs?: string[];
  researchRefs?: string[];
  audioSource?: LessonSpec['audioSource'];
}

const TRACK_TARGET_KIND: Partial<Record<TrackIdV2, LessonTarget['kind']>> = {
  listening: 'listening',
  pronunciation: 'pronunciation',
  'grammar-support': 'grammar',
};

export function spec(init: LessonInit): LessonSpec {
  const trackKind = TRACK_TARGET_KIND[init.track];
  return {
    specVersion: 'lesson-spec/v2',
    version: CONTENT_VERSION,
    supportLadder: init.supportLadder ?? LADDER_DEFAULT,
    reviewVariants: init.reviewVariants ?? VARIANTS_DEFAULT,
    truePrerequisites: init.truePrerequisites ?? [],
    recommendedAfter: init.recommendedAfter ?? [],
    recyclingFrom: init.recyclingFrom ?? [],
    audioSource: (init.supportLadder ?? LADDER_DEFAULT).includes('audio')
      ? (init.audioSource ?? 'tts-synthetic')
      : init.audioSource,
    sourceRefs: init.sourceRefs ?? [...SRC.authored],
    researchRefs: init.researchRefs ?? [...RES.core],
    ...init,
    /* kind follows the track unless the author set a more specific one;
     * pronunciation targets inherit the lesson's L1 contrast note. */
    targets: init.targets.map((t) => ({
      ...t,
      kind: t.kind === 'chunk' && trackKind ? trackKind : t.kind,
      contrastVi: t.contrastVi ?? (init.track === 'pronunciation' ? init.contrastVi : undefined),
    })),
  };
}

export function target(init: {
  id: string;
  kind?: LessonTarget['kind'];
  chunk: string;
  cueVi: string;
  sourceSentence: string;
  productionPattern: string;
  transferContext: string;
  pronunciationNote?: string;
  contrastVi?: string;
}): LessonTarget {
  return { kind: 'chunk', ...init };
}
