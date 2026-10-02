import { describe, expect, it, vi } from 'vitest';
import {
  FD01_LESSONS,
  FD01_PACK_ID,
  FD01_TRACKS,
  fd01ChunksCollectionId,
  fd01Collections,
  fd01ContentItems,
  fd01CueText,
  fd01LessonText,
  fd01TrackCollectionId,
} from './pack';
import { RESEARCH_REFERENCES, SOURCE_REFERENCES } from './references';
import { seedFdContentPack } from './seed';
import { validatePack, validatePackLesson } from './validate-pack';
import type { PackLesson } from './types';

const { contentsBulkGetMock, contentsBulkPutMock, collectionsBulkGetMock, collectionsBulkPutMock } = vi.hoisted(
  () => ({
    contentsBulkGetMock: vi.fn(),
    contentsBulkPutMock: vi.fn(),
    collectionsBulkGetMock: vi.fn(),
    collectionsBulkPutMock: vi.fn(),
  }),
);

vi.mock('@/lib/db', () => ({
  db: {
    contents: { bulkGet: contentsBulkGetMock, bulkPut: contentsBulkPutMock },
    collections: { bulkGet: collectionsBulkGetMock, bulkPut: collectionsBulkPutMock },
  },
}));

describe('flashday-foundation-v1 pack shape', () => {
  it('contains exactly 30 lessons across five tracks', () => {
    expect(FD01_LESSONS).toHaveLength(30);
    expect(FD01_TRACKS.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    const counts = Object.fromEntries(
      FD01_TRACKS.map((t) => [t.id, FD01_LESSONS.filter((l) => l.track === t.id).length]),
    );
    expect(counts).toEqual({ a: 8, b: 6, c: 6, d: 4, e: 6 });
  });

  it('passes the full validator with zero issues', () => {
    expect(validatePack(FD01_LESSONS)).toEqual([]);
  });

  it('has unique lesson and target ids, 4–8 active targets per lesson', () => {
    const lessonIds = new Set(FD01_LESSONS.map((l) => l.id));
    expect(lessonIds.size).toBe(30);
    const targetIds = FD01_LESSONS.flatMap((l) => l.targets.map((t) => t.id));
    expect(new Set(targetIds).size).toBe(targetIds.length);
    for (const lesson of FD01_LESSONS) {
      expect(lesson.targets.length).toBeGreaterThanOrEqual(4);
      expect(lesson.targets.length).toBeLessThanOrEqual(8);
    }
  });

  it('cites only registered source and research references', () => {
    for (const lesson of FD01_LESSONS) {
      for (const ref of lesson.sourceRefs) expect(SOURCE_REFERENCES[ref], ref).toBeDefined();
      for (const ref of lesson.researchRefs) expect(RESEARCH_REFERENCES[ref], ref).toBeDefined();
    }
  });

  it('masks every chunk inside its cloze prompt (attempt before reveal)', () => {
    for (const lesson of FD01_LESSONS)
      for (const target of lesson.targets) {
        const cue = fd01CueText(target);
        expect(cue).toContain('___');
        expect(cue.startsWith(target.cueVi)).toBe(true);
        /* The cue itself must never contain the full chunk — that is the
         * answer-bearing leak the validator rejects separately. */
        expect(target.cueVi.toLowerCase()).not.toContain(target.chunk.toLowerCase());
      }
  });

  it('embeds the source sentences verbatim in the learner-facing text', () => {
    for (const lesson of FD01_LESSONS) {
      const text = fd01LessonText(lesson);
      expect(text).toContain(lesson.input.text);
      expect(text).toContain(lesson.explanationVi);
      expect(text).toContain(lesson.transferTask.prompt);
      for (const target of lesson.targets) expect(lesson.input.text).toContain(target.sourceSentence);
    }
  });

  it('counts the active language inventory', () => {
    const targets = FD01_LESSONS.flatMap((l) => l.targets);
    expect(targets.length).toBeGreaterThanOrEqual(140);
  });
});

describe('validatePack failure modes', () => {
  const broken = (mutate: (lesson: PackLesson) => void): PackLesson => {
    const lesson: PackLesson = JSON.parse(JSON.stringify(FD01_LESSONS[0]));
    mutate(lesson);
    return lesson;
  };
  const codes = (lesson: PackLesson) => validatePackLesson(lesson).map((i) => i.code);

  it('rejects a lesson with no target task', () => {
    expect(codes(broken((l) => (l.task = '')))).toContain('missing-task');
  });

  it('rejects missing sourceRefs and researchRefs', () => {
    expect(codes(broken((l) => (l.sourceRefs = [])))).toContain('missing-source-refs');
    expect(codes(broken((l) => (l.researchRefs = [])))).toContain('missing-research-refs');
  });

  it('rejects a lesson with no retrieval affordance', () => {
    expect(codes(broken((l) => (l.targets = [])))).toEqual(expect.arrayContaining(['no-retrieval']));
    expect(codes(broken((l) => (l.reviewVariants = [])))).toContain('no-retrieval');
  });

  it('rejects when the cue leaks the answer', () => {
    expect(
      codes(
        broken((l) => {
          l.targets[0].cueVi = `gõ ${l.targets[0].chunk}`;
        }),
      ),
    ).toContain('cue-leaks-answer');
  });

  it('rejects a chunk absent from its source sentence (answer would show)', () => {
    expect(
      codes(
        broken((l) => {
          l.targets[0].chunk = 'totally absent phrase';
        }),
      ),
    ).toEqual(expect.arrayContaining(['chunk-not-in-source', 'answer-visible']));
  });

  it('rejects a source sentence absent from the input', () => {
    expect(
      codes(
        broken((l) => {
          l.targets[0].sourceSentence = `${l.targets[0].chunk} never said`;
        }),
      ),
    ).toContain('source-not-in-input');
  });

  it('rejects a lesson with no production pattern', () => {
    expect(
      codes(
        broken((l) => {
          l.targets[0].productionPattern = '';
        }),
      ),
    ).toContain('no-production');
  });

  it('rejects a lesson with no changed-context task', () => {
    expect(codes(broken((l) => (l.transferTask.prompt = '')))).toContain('no-transfer');
    expect(codes(broken((l) => (l.transferTask.changesDimension = '')))).toContain('no-transfer');
  });

  it('rejects too many active targets', () => {
    expect(
      codes(
        broken((l) => {
          l.targets = Array.from({ length: 9 }, (_, i) => ({ ...l.targets[0], id: `${l.id}.tx${i}` }));
        }),
      ),
    ).toContain('target-count');
  });

  it('rejects unknown references', () => {
    expect(codes(broken((l) => l.sourceRefs.push('nope-source')))).toContain('unknown-source-ref');
    expect(codes(broken((l) => l.researchRefs.push('nope-research')))).toContain('unknown-research-ref');
  });

  it('rejects a REJECTED source on any lesson', () => {
    expect(codes(broken((l) => l.sourceRefs.push('pirate-mirrors')))).toContain('rejected-source');
  });

  it('rejects derived input without a derivable source', () => {
    expect(
      codes(
        broken((l) => {
          l.input.origin = 'derived';
          l.sourceRefs = ['english-for-it']; // REFERENCE_ONLY only — nothing derivable
        }),
      ),
    ).toContain('derived-from-restricted');
  });

  it('rejects input derived from a REFERENCE_ONLY source', () => {
    expect(
      codes(
        broken((l) => {
          l.input.origin = 'derived';
          l.input.sourceRefId = 'english-for-it';
          l.sourceRefs.push('english-for-it');
        }),
      ),
    ).toContain('derived-from-restricted');
  });

  it('rejects a support ladder that starts at the full answer', () => {
    expect(codes(broken((l) => (l.supportLadder = ['full-answer'])))).toEqual(
      expect.arrayContaining(['support-starts-at-answer']),
    );
  });

  it('rejects duplicate lesson and activity ids at pack level', () => {
    const dup = JSON.parse(JSON.stringify(FD01_LESSONS)) as PackLesson[];
    dup.push({ ...dup[0] });
    const issues = validatePack(dup);
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['duplicate-lesson-id', 'duplicate-activity-id', 'track-count']),
    );
  });
});

describe('fd01 content mapping', () => {
  it('maps lessons to article items inside track collections', () => {
    const items = fd01ContentItems(1000);
    const articles = items.filter((i) => i.type === 'article');
    const words = items.filter((i) => i.type === 'word');
    expect(articles).toHaveLength(30);
    expect(words).toHaveLength(FD01_LESSONS.flatMap((l) => l.targets).length);
    expect(articles[0].id).toBe('fd01.lesson.a01');
    expect(articles[0].metadata?.scenario?.goal).toBe(FD01_LESSONS[0].task);
    for (const w of words) {
      expect(w.metadata?.vocabulary?.meaning).toBeTruthy();
      expect(w.text).toContain('___');
      expect(w.title.trim()).toBeTruthy();
    }
  });

  it('creates two collections per track with deterministic ids', () => {
    const collections = fd01Collections(1000);
    expect(collections).toHaveLength(10);
    for (const track of FD01_TRACKS) {
      const lessons = collections.find((c) => c.id === fd01TrackCollectionId(track.id));
      const chunks = collections.find((c) => c.id === fd01ChunksCollectionId(track.id));
      expect(lessons?.itemIds.length).toBe(FD01_LESSONS.filter((l) => l.track === track.id).length);
      expect(chunks?.itemIds.length).toBe(
        FD01_LESSONS.filter((l) => l.track === track.id).flatMap((l) => l.targets).length,
      );
      expect(chunks?.titleVi).toContain('Cụm câu');
    }
    expect(collections.every((c) => c.tags.includes(FD01_PACK_ID === 'flashday-foundation-v1' ? 'fd01' : ''))).toBe(
      true,
    );
  });
});

describe('seedFdContentPack', () => {
  it('writes all items on an empty database', async () => {
    contentsBulkGetMock.mockImplementation(async (ids: string[]) => ids.map(() => undefined));
    collectionsBulkGetMock.mockImplementation(async (ids: string[]) => ids.map(() => undefined));

    const result = await seedFdContentPack(1000);

    const expectedContents = 30 + FD01_LESSONS.flatMap((l) => l.targets).length;
    expect(result.contentsAdded).toBe(expectedContents);
    expect(result.collectionsAdded).toBe(10);
    expect(contentsBulkPutMock).toHaveBeenCalledTimes(1);
    expect(collectionsBulkPutMock).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: an existing install writes nothing', async () => {
    contentsBulkGetMock.mockReset();
    contentsBulkPutMock.mockReset();
    collectionsBulkGetMock.mockReset();
    collectionsBulkPutMock.mockReset();
    contentsBulkGetMock.mockImplementation(async (ids: string[]) => ids.map((id) => ({ id })));
    collectionsBulkGetMock.mockImplementation(async (ids: string[]) => ids.map((id) => ({ id })));

    const result = await seedFdContentPack(1000);

    expect(result.contentsAdded).toBe(0);
    expect(result.collectionsAdded).toBe(0);
    expect(contentsBulkPutMock).not.toHaveBeenCalled();
    expect(collectionsBulkPutMock).not.toHaveBeenCalled();
  });

  it('does not resurrect learner-deleted pack items', async () => {
    contentsBulkGetMock.mockReset();
    contentsBulkPutMock.mockReset();
    collectionsBulkGetMock.mockReset();
    collectionsBulkPutMock.mockReset();
    /* Every key exists but one article is soft-deleted; only new keys
     * (none here) would be written — deleted items stay deleted. */
    contentsBulkGetMock.mockImplementation(async (ids: string[]) =>
      ids.map((id) => ({ id, deletedAt: id === 'fd01.lesson.a01' ? 1 : undefined })),
    );
    collectionsBulkGetMock.mockImplementation(async (ids: string[]) => ids.map((id) => ({ id })));

    const result = await seedFdContentPack(1000);

    expect(result.contentsAdded).toBe(0);
    expect(contentsBulkPutMock).not.toHaveBeenCalled();
  });
});
