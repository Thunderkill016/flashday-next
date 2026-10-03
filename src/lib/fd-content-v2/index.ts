/*
 * FD-CONTENT-V2 — authored lesson-spec library.
 * 142 lessons / 4 packs. Pack assignment = compile-time grouping + deps.
 */

import { packManifest } from '../content-factory/compile.ts';
import type { LessonSpec, PackManifest } from '../content-factory/types.ts';
import { CAPABILITIES } from './capabilities.ts';
import { CHUNKS_1 } from './lessons/chunks-1.ts';
import { CHUNKS_2 } from './lessons/chunks-2.ts';
import { DEVELOPER_1 } from './lessons/developer-1.ts';
import { DEVELOPER_2 } from './lessons/developer-2.ts';
import { EVERYDAY_1 } from './lessons/everyday-1.ts';
import { EVERYDAY_2 } from './lessons/everyday-2.ts';
import { GRAMMAR } from './lessons/grammar.ts';
import { LISTENING_1 } from './lessons/listening-1.ts';
import { LISTENING_2 } from './lessons/listening-2.ts';
import { PRONUNCIATION_1 } from './lessons/pronunciation-1.ts';
import { PRONUNCIATION_2 } from './lessons/pronunciation-2.ts';
import { REVIEW } from './lessons/review.ts';
import { SURVIVAL_1 } from './lessons/survival-1.ts';
import { SURVIVAL_2 } from './lessons/survival-2.ts';

/* Review lessons live in the pack whose material they recycle so that
 * every recycling edge resolves inside the pack or its declared deps:
 * rv01–rv05 -> a2 (chunks/grammar), rv06–rv07 -> developer, rv08 -> listening. */
const TRACKS = {
  a1: [...SURVIVAL_1, ...SURVIVAL_2, ...EVERYDAY_1, ...EVERYDAY_2],
  a2: [...CHUNKS_1, ...CHUNKS_2, ...GRAMMAR, ...REVIEW.filter((l) => !['rv06', 'rv07', 'rv08'].includes(l.id))],
  listening: [
    ...LISTENING_1,
    ...LISTENING_2,
    ...PRONUNCIATION_1,
    ...PRONUNCIATION_2,
    ...REVIEW.filter((l) => l.id === 'rv08'),
  ],
  developer: [...DEVELOPER_1, ...DEVELOPER_2, ...REVIEW.filter((l) => ['rv06', 'rv07'].includes(l.id))],
};

export const V2_LESSONS: LessonSpec[] = [...TRACKS.a1, ...TRACKS.a2, ...TRACKS.listening, ...TRACKS.developer];

/* Pack manifests are built by the compiler (deterministic, builtAt=0).
 * Pack titles for learners come from TRACKS_V2 meta at compile time. */
export const V2_PACKS: PackManifest[] = [
  packManifest('flashday-core-a1-v1', 'content/2.0.0', TRACKS.a1, ['flashday-foundation-v1'], 0),
  packManifest('flashday-core-a2-v1', 'content/2.0.0', TRACKS.a2, ['flashday-foundation-v1', 'flashday-core-a1-v1'], 0),
  packManifest(
    'flashday-listening-v1',
    'content/2.0.0',
    TRACKS.listening,
    ['flashday-foundation-v1', 'flashday-core-a1-v1', 'flashday-core-a2-v1'],
    0,
  ),
  packManifest(
    'flashday-developer-v1',
    'content/2.0.0',
    TRACKS.developer,
    ['flashday-foundation-v1', 'flashday-core-a1-v1', 'flashday-core-a2-v1'],
    0,
  ),
];

export { CAPABILITIES };
