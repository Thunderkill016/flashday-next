/*
 * FD-VS01 dogfood pilot fixture — exactly five targets, one source.
 *
 * recallTarget is the exact lexical frame the learner must type from a
 * Vietnamese cue (hidden-answer WordBookPractice does normalized exact
 * match against it). productionPattern documents the open slot the
 * production/transfer stages exercise — it is never the typed target.
 *
 * Source identity is by invariant (title + verbatim sentence), never by
 * ContentItem.id: seedDatabase() assigns nanoid() per install, so the
 * article's runtime id is resolved, not assumed.
 */
import type { ContentItem } from '@/types/content';

export const VS01_SOURCE_TITLE = 'My Morning Routine';
export const VS01_CATEGORY = 'vs01-dogfood';
export const VS01_TAG = 'vs01';

export interface Vs01Target {
  id: string;
  /** Literal verbatim substring of sourceSentence — the typed recall target. */
  recallTarget: string;
  /** Vietnamese retrieval cue shown instead of the target. */
  cueVi: string;
  sourceTitle: typeof VS01_SOURCE_TITLE;
  /** The sentence inside the source article containing recallTarget. */
  sourceSentence: string;
  /** Productive pattern with an open slot — never exact-typed. */
  productionPattern: string;
  /** Pre-authored changed context for the apply/transfer step. */
  transferContext: string;
}

export const VS01_TARGETS: Vs01Target[] = [
  {
    id: 'vs01.wake-up-at',
    recallTarget: 'wake up at',
    cueVi: 'thức dậy lúc ~',
    sourceTitle: VS01_SOURCE_TITLE,
    sourceSentence: "Every morning, I wake up at seven o'clock.",
    productionPattern: 'wake up at <time>',
    transferContext: 'a different day or place (weekend, holiday, hotel) with your own time',
  },
  {
    id: 'vs01.a-glass-of',
    recallTarget: 'a glass of',
    cueVi: 'một ly ~ (đồ uống)',
    sourceTitle: VS01_SOURCE_TITLE,
    sourceSentence: 'I usually have toast with butter and a glass of orange juice.',
    productionPattern: 'a glass of <drink>',
    transferContext: 'ordering or offering a different drink (water, milk, coffee)',
  },
  {
    id: 'vs01.leave-the-house',
    recallTarget: 'leave the house',
    cueVi: 'rời khỏi nhà',
    sourceTitle: VS01_SOURCE_TITLE,
    sourceSentence: 'I like to leave the house early so I can walk slowly and enjoy the fresh air.',
    productionPattern: 'leave the house <modifier/context>',
    transferContext: 'someone else leaving, a different time or reason (without keys, late, for work)',
  },
  {
    id: 'vs01.on-the-way',
    recallTarget: 'on the way',
    cueVi: 'trên đường (đến đâu đó)',
    sourceTitle: VS01_SOURCE_TITLE,
    sourceSentence: 'On the way, I sometimes see my neighbors walking their dogs.',
    productionPattern: 'on the way <to/place/event>',
    transferContext: 'a different destination or a figurative journey (to work, to becoming a teacher)',
  },
  {
    id: 'vs01.feel-ready-to',
    recallTarget: 'feel ready to',
    cueVi: 'cảm thấy sẵn sàng để ~',
    sourceTitle: VS01_SOURCE_TITLE,
    sourceSentence: 'When I arrive at school, I feel ready to start a new day of learning.',
    productionPattern: 'feel ready to <verb phrase>',
    transferContext: 'a new challenge (an exam, a presentation, a trip)',
  },
];

const VS01_TARGET_IDS = new Set(VS01_TARGETS.map((t) => t.id));

/** True only for the five pilot target ids — the miss-persistence boundary. */
export function isVs01TargetId(id: string): boolean {
  return VS01_TARGET_IDS.has(id);
}

/*
 * The pilot only exists where it was deliberately enabled: development
 * builds, or a deployment built with NEXT_PUBLIC_VS01_DOGFOOD=1 (the
 * Firebase dogfood backend). A normal production build ships neither the
 * seeded targets nor the debug report.
 */
export function vs01DogfoodEnabled(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_VS01_DOGFOOD === '1';
}

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Resolve the pilot source article by invariant identity — title + all
 * source sentences present verbatim — never by a hard-coded contentId.
 * Returns null when the source is absent or the fixture does not match,
 * so callers fail closed instead of binding the wrong article.
 */
export function resolveVs01Source(contents: ContentItem[]): ContentItem | null {
  const candidates = contents.filter(
    (item) =>
      item.type === 'article' && item.source === 'builtin' && item.title === VS01_SOURCE_TITLE && !item.deletedAt,
  );
  for (const candidate of candidates) {
    const text = normalize(candidate.text);
    const intact = VS01_TARGETS.every(
      (target) => text.includes(normalize(target.sourceSentence)) && text.includes(normalize(target.recallTarget)),
    );
    if (intact) return candidate;
  }
  return null;
}

/**
 * Cloze cue: the source sentence with the recall target masked, so the
 * prompt never displays the answer. Falls back to the bare cue when the
 * target cannot be masked (defensive — resolveVs01Source already pins
 * every target as a literal substring).
 */
export function vs01CueText(target: Vs01Target): string {
  const idx = target.sourceSentence.toLowerCase().indexOf(target.recallTarget.toLowerCase());
  const masked =
    idx === -1
      ? target.sourceSentence
      : `${target.sourceSentence.slice(0, idx)}___${target.sourceSentence.slice(idx + target.recallTarget.length)}`;
  return `${target.cueVi} — ${masked}`;
}

/** The seeded ContentItem shape for one recall target (word-type wordbook entry). */
export function vs01ContentItem(target: Vs01Target, now: number): ContentItem {
  return {
    id: target.id,
    type: 'word',
    title: target.recallTarget,
    text: vs01CueText(target),
    category: VS01_CATEGORY,
    tags: [VS01_TAG],
    source: 'builtin',
    difficulty: 'beginner',
    createdAt: now,
    updatedAt: now,
  };
}
