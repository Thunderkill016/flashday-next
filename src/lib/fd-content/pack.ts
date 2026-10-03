/*
 * flashday-foundation-v1 — pack assembly and content builders.
 *
 * The pack is data; this module maps it onto existing surfaces only:
 *   PackLesson  -> article ContentItem (lesson collection -> text cycle)
 *   PackTarget  -> word ContentItem    (chunks collection -> vocabulary
 *                                       modes: meaning / spelling /
 *                                       dictation / application)
 *   track       -> two CollectionItems (lessons + chunks)
 *
 * Nothing here creates new runtime machinery.
 */
import type { CollectionItem, ContentItem } from '@/types/content';
import { TRACK_A } from './pack-track-a';
import { TRACK_B } from './pack-track-b';
import { TRACK_C } from './pack-track-c';
import { TRACK_D } from './pack-track-d';
import { TRACK_E } from './pack-track-e';
import { TRACKS } from './references';
import type { PackLesson, PackTarget, TrackId } from './types';

export const FD01_PACK_ID = 'flashday-foundation-v1';
export const FD01_TAG = 'fd01';

export const FD01_TRACKS = (['a', 'b', 'c', 'd', 'e'] as TrackId[]).map((id, index) => ({
  id,
  order: index,
  ...TRACKS[id],
}));

export const FD01_LESSONS: PackLesson[] = [...TRACK_A, ...TRACK_B, ...TRACK_C, ...TRACK_D, ...TRACK_E];

export const fd01LessonContentId = (lessonId: string) => `fd01.lesson.${lessonId}`;
export const fd01TrackCollectionId = (track: TrackId) => `fd01.track.${track}`;
export const fd01ChunksCollectionId = (track: TrackId) => `fd01.track.${track}.chunks`;
export const fd01ChunkCategory = (track: TrackId) => `fd01-chunks-${track}`;

const zh: Record<TrackId, { title: string; description: string }> = {
  a: { title: '基础互动', description: '最基本的口语功能：自我介绍、请求澄清、提出请求。' },
  b: { title: '日常实用英语', description: '日常生活与工作中的作息、日程、计划、问题与观点。' },
  c: { title: '实用语块', description: '高频固定语块，说话写作时不必逐词拼装。' },
  d: { title: '听力与发音', description: '听辨词界、弱读与语块；先感知再产出。' },
  e: { title: '开发者英语', description: '软件工作沟通：进度、bug、pull request、部署。' },
};

const TRACK_SCENARIOS: Record<TrackId, string> = {
  a: 'First conversations: introductions, clarification, requests, and saying when you do not understand.',
  b: 'Daily life talk: routines, schedules, plans, problems, past events, and opinions.',
  c: 'High-utility chunks reused across conversations — retrieved whole, not assembled.',
  d: 'Listening perception: word boundaries, stress, connected speech, meaningful chunks.',
  e: 'Software work communication: status updates, bug reports, reviews, and incidents.',
};

const CHUNK_SCENARIOS: Record<TrackId, string> = {
  a: 'Active recall of the essential-interaction chunks.',
  b: 'Active recall of the everyday-English chunks.',
  c: 'Active recall of the reusable formulaic chunks.',
  d: 'Active recall of the listening-focus chunks.',
  e: 'Active recall of the developer-communication chunks.',
};

/**
 * The learner-facing lesson text: the English input plus a Vietnamese
 * support block. The block carries the L1 scaffold (note, explanation),
 * the task framing, and the authored transfer prompt — the surfaces the
 * existing text-cycle UI already displays. No new screens.
 */
export function fd01LessonText(lesson: PackLesson): string {
  return [
    lesson.input.text,
    '',
    '---',
    `Ghi chú: ${lesson.input.noteVi}`,
    `Giải thích: ${lesson.explanationVi}`,
    `Nhiệm vụ: ${lesson.task} — ${lesson.context}`,
    `Mục tiêu: ${lesson.outcome}`,
    `Vận dụng (đổi ngữ cảnh): ${lesson.transferTask.promptVi} / ${lesson.transferTask.prompt}`,
  ].join('\n');
}

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Cloze prompt for a chunk target: Vietnamese cue + the source sentence
 * with the chunk masked — the answer is never visible before the attempt.
 */
export function fd01CueText(target: PackTarget): string {
  const sentence = target.sourceSentence;
  const idx = normalize(sentence).indexOf(normalize(target.chunk));
  const masked = idx === -1 ? sentence : `${sentence.slice(0, idx)}___${sentence.slice(idx + target.chunk.length)}`;
  return `${target.cueVi} — ${masked}`;
}

const cefrDifficulty = (cefr: PackLesson['cefr']): 'beginner' | 'intermediate' =>
  cefr === 'a2' ? 'intermediate' : 'beginner';

export function fd01ArticleItem(lesson: PackLesson, index: number, now: number): ContentItem {
  return {
    id: fd01LessonContentId(lesson.id),
    title: `${lesson.id.toUpperCase()} · ${lesson.title}`,
    text: fd01LessonText(lesson),
    type: 'article',
    category: `collection:${fd01TrackCollectionId(lesson.track)}`,
    tags: [FD01_TAG, `fd01-track-${lesson.track}`],
    source: 'builtin',
    difficulty: cefrDifficulty(lesson.cefr),
    metadata: {
      scenario: { situation: lesson.context, role: 'You', goal: lesson.task },
      /* The authored lesson contract travels with the item — queryable at
       * runtime instead of dying at pack edge (review P1). */
      fd: {
        packId: FD01_PACK_ID,
        lessonId: lesson.id,
        trackId: lesson.track,
        supportLadder: lesson.supportLadder,
        reviewVariants: lesson.reviewVariants,
        transferContext: lesson.transferTask.prompt,
        sourceRefId: lesson.input.sourceRefId,
      },
    },
    /* +index keeps authored lesson order inside the unit (items sort by
     * createdAt); the millisecond offsets are deterministic. */
    createdAt: now + index,
    updatedAt: now + index,
  };
}

export function fd01ChunkItem(target: PackTarget, lesson: PackLesson, index: number, now: number): ContentItem {
  const trackTitle = TRACKS[lesson.track].title;
  return {
    id: target.id,
    title: target.chunk,
    text: fd01CueText(target),
    type: 'word',
    category: fd01ChunkCategory(lesson.track),
    tags: [FD01_TAG, `fd01-track-${lesson.track}`, 'chunk'],
    source: 'builtin',
    difficulty: cefrDifficulty(lesson.cefr),
    metadata: {
      vocabulary: {
        /* meaning doubles as the spelling-mode prompt: Vietnamese cue ->
         * produce the English chunk (attempt before reveal). */
        meaning: target.cueVi,
        example: target.sourceSentence,
        /* Track D binds a heard-form hint; the dictation mode's TTS
         * speak(title) is the audio path the ladder/variant claim. */
        pronunciation: target.pronunciationNote ?? '',
        bookTitle: `${trackTitle} — Chunks`,
      },
      /* Target-level contract: pattern + changed context survive into
       * the seeded item for application-mode/query use. */
      fd: {
        packId: FD01_PACK_ID,
        lessonId: lesson.id,
        trackId: lesson.track,
        reviewVariants: lesson.reviewVariants,
        productionPattern: target.productionPattern,
        transferContext: target.transferContext,
      },
    },
    createdAt: now + index,
    updatedAt: now + index,
  };
}

export function fd01ContentItems(now: number): ContentItem[] {
  const items: ContentItem[] = [];
  for (const [trackIndex, track] of FD01_TRACKS.entries()) {
    /* Shelf order on /learn is updatedAt-descending: give each track a
     * deterministic score so cards render A→E with each chunk unit right
     * after its lesson unit. */
    const shelfScore = (FD01_TRACKS.length - trackIndex) * 2;
    const lessons = FD01_LESSONS.filter((l) => l.track === track.id);
    for (const [index, lesson] of lessons.entries()) {
      items.push({
        ...fd01ArticleItem(lesson, index, now),
        updatedAt: now + shelfScore,
      });
      for (const [targetIndex, target] of lesson.targets.entries()) {
        items.push({
          ...fd01ChunkItem(target, lesson, targetIndex, now),
          updatedAt: now + shelfScore - 1,
        });
      }
    }
  }
  return items;
}

export function fd01Collections(now: number): CollectionItem[] {
  const collections: CollectionItem[] = [];
  for (const track of FD01_TRACKS) {
    const lessons = FD01_LESSONS.filter((l) => l.track === track.id);
    collections.push({
      id: fd01TrackCollectionId(track.id),
      title: track.title,
      titleZh: zh[track.id].title,
      titleVi: track.titleVi,
      description: track.description,
      descriptionZh: zh[track.id].description,
      descriptionVi: track.descriptionVi,
      scenario: TRACK_SCENARIOS[track.id],
      category: 'fd01-foundation',
      difficulty: 'beginner',
      icon: { a: '💬', b: '🏠', c: '🧩', d: '👂', e: '💻' }[track.id],
      itemIds: lessons.map((l) => fd01LessonContentId(l.id)),
      tags: [FD01_TAG, 'foundation-v1', `track-${track.id}`],
      source: 'builtin',
      createdAt: now + track.order,
      updatedAt: now + track.order,
    });
    collections.push({
      id: fd01ChunksCollectionId(track.id),
      title: `${track.title} — Chunks`,
      titleZh: `${zh[track.id].title} — 语块`,
      titleVi: `${track.titleVi} — Cụm câu`,
      description: `Active chunk targets for ${track.title}: cued recall, spelling, dictation, and use-in-a-sentence.`,
      descriptionZh: `${zh[track.id].title}的主动回忆语块：提示回忆、拼写、听写与造句。`,
      descriptionVi: `Các cụm câu cần nhớ chủ động cho ${track.titleVi}: gợi ý → nhớ → viết → đặt câu.`,
      scenario: CHUNK_SCENARIOS[track.id],
      category: 'fd01-foundation',
      difficulty: 'beginner',
      icon: '🔤',
      itemIds: lessons.flatMap((l) => l.targets.map((t) => t.id)),
      tags: [FD01_TAG, 'foundation-v1', `track-${track.id}`, 'chunks'],
      source: 'builtin',
      createdAt: now + track.order,
      updatedAt: now + track.order,
    });
  }
  return collections;
}
