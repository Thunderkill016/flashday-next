/*
 * Deterministic compiler (Parts 7, 9) — LessonSpec[] -> existing runtime
 * entities. Same inputs -> byte-identical outputs for a given `now`.
 *
 * Mapping (unchanged surfaces, no new engine):
 *   LessonSpec  -> article ContentItem (track collection -> text cycle)
 *   LessonTarget-> word ContentItem    (chunks collection -> vocab modes)
 *   track       -> two CollectionItem (lessons + chunks)
 *   pack        -> PackManifest (versioned, stable ids)
 */
import type { CollectionItem, ContentItem } from '@/types/content';
import { SOURCE_MANIFEST_VERSION } from './sources.ts';
import { TRACKS_V2 } from './tracks.ts';
import type { CompileReport, LessonSpec, LessonTarget, PackManifest, TrackIdV2 } from './types.ts';

export const COMPILER_VERSION = 'content-compiler/2.0.0';

export const v2LessonContentId = (packId: string, lessonId: string) => `${packId}.lesson.${lessonId}`;
export const v2TrackCollectionId = (packId: string, track: TrackIdV2) => `${packId}.track.${track}`;
export const v2ChunksCollectionId = (packId: string, track: TrackIdV2) => `${packId}.track.${track}.chunks`;
export const v2ChunkCategory = (packId: string, track: TrackIdV2) => `${packId}-chunks-${track}`;

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

/** Learner-facing lesson text: English input + Vietnamese support block. */
export function v2LessonText(lesson: LessonSpec): string {
  return [
    lesson.input.text,
    '',
    '---',
    `Ghi chú: ${lesson.input.noteVi}`,
    `Nhiệm vụ: ${lesson.task} — ${lesson.context}`,
    `Mục tiêu: ${lesson.outcome}`,
    `Vận dụng (đổi ngữ cảnh): ${lesson.transferTask.promptVi} / ${lesson.transferTask.prompt}`,
  ].join('\n');
}

/** Cloze prompt: Vietnamese cue + source sentence with the chunk masked. */
export function v2CueText(target: LessonTarget): string {
  const sentence = target.sourceSentence;
  const idx = normalize(sentence).indexOf(normalize(target.chunk));
  const masked = idx === -1 ? sentence : `${sentence.slice(0, idx)}___${sentence.slice(idx + target.chunk.length)}`;
  return `${target.cueVi} — ${masked}`;
}

const difficulty = (level: LessonSpec['level']): 'beginner' | 'intermediate' | 'advanced' =>
  level === 'a0' || level === 'a1' ? 'beginner' : level === 'a2' ? 'intermediate' : 'advanced';

export function compileArticleItem(pack: PackManifest, lesson: LessonSpec, index: number, now: number): ContentItem {
  return {
    id: v2LessonContentId(pack.packId, lesson.id),
    title: `${lesson.id.toUpperCase()} · ${lesson.title}`,
    text: v2LessonText(lesson),
    type: 'article',
    category: `collection:${v2TrackCollectionId(pack.packId, lesson.track)}`,
    tags: [pack.packId, `${pack.packId}-track-${lesson.track}`],
    source: 'builtin',
    difficulty: difficulty(lesson.level),
    metadata: {
      scenario: { situation: lesson.context, role: 'You', goal: lesson.task },
      fd: {
        packId: pack.packId,
        lessonId: lesson.id,
        trackId: lesson.track,
        supportLadder: lesson.supportLadder,
        reviewVariants: lesson.reviewVariants,
        transferContext: lesson.transferTask.prompt,
        sourceRefId: lesson.input.sourceRefId,
      },
    },
    createdAt: now + index,
    updatedAt: now + index,
  };
}

export function compileChunkItem(
  pack: PackManifest,
  target: LessonTarget,
  lesson: LessonSpec,
  index: number,
  now: number,
): ContentItem {
  return {
    id: target.id,
    title: target.chunk,
    text: v2CueText(target),
    type: 'word',
    category: v2ChunkCategory(pack.packId, lesson.track),
    tags: [pack.packId, `${pack.packId}-track-${lesson.track}`, 'chunk', `kind-${target.kind}`],
    source: 'builtin',
    difficulty: difficulty(lesson.level),
    metadata: {
      vocabulary: {
        meaning: target.cueVi,
        example: target.sourceSentence,
        pronunciation: target.pronunciationNote ?? '',
        bookTitle: `${TRACKS_V2[lesson.track].title} — Chunks`,
      },
      fd: {
        packId: pack.packId,
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

export function compileCollections(pack: PackManifest, lessons: LessonSpec[], now: number): CollectionItem[] {
  const collections: CollectionItem[] = [];
  const order = Object.keys(TRACKS_V2) as TrackIdV2[];
  for (const track of order) {
    const trackLessons = lessons.filter((l) => l.track === track);
    if (!trackLessons.length) continue;
    const meta = TRACKS_V2[track];
    const i = order.indexOf(track);
    collections.push({
      id: v2TrackCollectionId(pack.packId, track),
      title: meta.title,
      /* no zh authoring in V2 (Vietnam-first) — zh fields fall back to English
       * so a zh locale shows text instead of blanks. */
      titleZh: meta.title,
      titleVi: meta.titleVi,
      description: meta.description,
      descriptionZh: meta.description,
      descriptionVi: meta.descriptionVi,
      scenario: meta.scenario,
      category: `${pack.packId}`,
      difficulty: 'beginner',
      icon: meta.icon,
      itemIds: trackLessons.map((l) => v2LessonContentId(pack.packId, l.id)),
      tags: [pack.packId, `track-${track}`],
      source: 'builtin',
      createdAt: now + i,
      updatedAt: now + i,
    });
    collections.push({
      id: v2ChunksCollectionId(pack.packId, track),
      title: `${meta.title} — Chunks`,
      titleZh: `${meta.title} — Chunks`,
      titleVi: `${meta.titleVi} — Cụm câu`,
      description: `Active recall targets for ${meta.title}.`,
      descriptionZh: `Active recall targets for ${meta.title}.`,
      descriptionVi: `Các cụm câu cần nhớ chủ động cho ${meta.titleVi}.`,
      scenario: meta.scenario,
      category: `${pack.packId}`,
      difficulty: 'beginner',
      icon: '🔤',
      itemIds: trackLessons.flatMap((l) => l.targets.map((t) => t.id)),
      tags: [pack.packId, `track-${track}`, 'chunks'],
      source: 'builtin',
      createdAt: now + i,
      updatedAt: now + i,
    });
  }
  return collections;
}

export interface CompileResult {
  items: ContentItem[];
  collections: CollectionItem[];
  report: CompileReport;
}

/** Compile one versioned pack deterministically. */
export function compilePack(pack: PackManifest, lessons: LessonSpec[], now: number): CompileResult {
  const items: ContentItem[] = [];
  const provenance: Record<string, string> = {};
  const trackOrder = Object.keys(TRACKS_V2) as TrackIdV2[];
  const sorted = [...lessons].sort((a, b) => trackOrder.indexOf(a.track) - trackOrder.indexOf(b.track));
  for (const [trackIndex, track] of trackOrder.entries()) {
    const trackLessons = sorted.filter((l) => l.track === track);
    if (!trackLessons.length) continue;
    /* shelf order mirrors fd01: updatedAt desc inside each track block */
    const shelfScore = (trackOrder.length - trackIndex) * 2;
    for (const [index, lesson] of trackLessons.entries()) {
      const article = { ...compileArticleItem(pack, lesson, index, now), updatedAt: now + shelfScore };
      items.push(article);
      provenance[article.id] = lesson.id;
      for (const [ti, target] of lesson.targets.entries()) {
        const word = { ...compileChunkItem(pack, target, lesson, ti, now), updatedAt: now + shelfScore - 1 };
        items.push(word);
        provenance[word.id] = lesson.id;
      }
    }
  }
  return {
    items,
    collections: compileCollections(pack, lessons, now),
    report: {
      pack,
      lessons: lessons.length,
      targets: lessons.reduce((n, l) => n + l.targets.length, 0),
      provenance,
      warnings: [],
    },
  };
}

/** Build a manifest for a pack — stable content ids, versioned. */
export function packManifest(
  packId: string,
  version: string,
  lessons: LessonSpec[],
  dependencies: string[],
  builtAt: number,
): PackManifest {
  return {
    packId,
    version,
    schemaVersion: 'lesson-spec/v2',
    lessonIds: lessons.map((l) => l.id).sort(),
    targetIds: lessons.flatMap((l) => l.targets.map((t) => t.id)).sort(),
    dependencies: [...dependencies].sort(),
    sourceManifestVersion: SOURCE_MANIFEST_VERSION,
    builtAt,
    compilerVersion: COMPILER_VERSION,
  };
}
