import { describe, expect, it, vi } from 'vitest';
import { V2_LESSONS, V2_PACKS, CAPABILITIES } from '../fd-content-v2/index';
import { compilePack, v2CueText, v2LessonText, packManifest } from './compile';
import { validateLesson, validateLibrary } from './validate';
import { lessonOrder, findCycles, buildEdges } from './graph';
import { seedV2Pack } from './seed';
import { SOURCE_MANIFEST } from './sources';
import { RESEARCH_MANIFEST } from './research';
import type { LessonSpec } from './types';

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

const ALL = V2_LESSONS;

describe('v2 curriculum shape', () => {
  it('contains 142 lessons across 8 tracks', () => {
    expect(ALL).toHaveLength(142);
    const tracks = new Set(ALL.map((l) => l.track));
    expect([...tracks].sort()).toEqual(
      ['chunks', 'developer', 'everyday', 'grammar-support', 'listening', 'pronunciation', 'review', 'survival'].sort(),
    );
  });

  it('passes the full validator with zero issues', () => {
    expect(validateLibrary(ALL, 'fd02')).toEqual([]);
  });

  it('has unique lesson and target ids', () => {
    expect(new Set(ALL.map((l) => l.id)).size).toBe(ALL.length);
    const tids = ALL.flatMap((l) => l.targets.map((t) => t.id));
    expect(new Set(tids).size).toBe(tids.length);
  });

  it('every capability id resolves in the ontology', () => {
    for (const l of ALL) for (const c of l.capabilities) expect(CAPABILITIES[c], `${l.id}:${c}`).toBeDefined();
  });

  it('cites only registered source and research references', () => {
    for (const l of ALL) {
      for (const s of l.sourceRefs) expect(SOURCE_MANIFEST[s], `${l.id}:${s}`).toBeDefined();
      for (const r of l.researchRefs) expect(RESEARCH_MANIFEST[r], `${l.id}:${r}`).toBeDefined();
    }
  });

  it('every declared pack lesson exists exactly once', () => {
    const allIds = new Set(ALL.map((l) => l.id));
    for (const p of V2_PACKS) {
      for (const id of p.lessonIds) expect(allIds.has(id), `${p.packId}:${id}`).toBe(true);
      expect(new Set(p.lessonIds).size).toBe(p.lessonIds.length);
    }
    expect(V2_PACKS.map((p) => p.lessonIds.length).reduce((a, b) => a + b, 0)).toBe(ALL.length);
  });
});

describe('dependency graph', () => {
  it('has no true-prerequisite cycles', () => {
    expect(findCycles(buildEdges(ALL))).toEqual([]);
  });

  it('orders lessons so prerequisites come first', () => {
    const order = lessonOrder(ALL);
    const pos = new Map(order.map((id, i) => [id, i]));
    for (const l of ALL)
      for (const pre of l.truePrerequisites) expect(pos.get(pre)).toBeLessThan(pos.get(l.id)!);
  });
});

describe('compiler', () => {
  const pack = V2_PACKS[0];
  const lessons = ALL.filter((l) => pack.lessonIds.includes(l.id));

  it('is deterministic — same inputs, identical output', () => {
    const a = compilePack(pack, lessons, 1000);
    const b = compilePack(pack, lessons, 1000);
    expect(JSON.stringify(a.items)).toBe(JSON.stringify(b.items));
    expect(JSON.stringify(a.collections)).toBe(JSON.stringify(b.collections));
  });

  it('emits article + word items with provenance', () => {
    const { items, report } = compilePack(pack, lessons, 1000);
    expect(items.filter((i) => i.type === 'article')).toHaveLength(lessons.length);
    expect(report.targets).toBe(lessons.reduce((n, l) => n + l.targets.length, 0));
    for (const item of items) expect(report.provenance[item.id]).toBeDefined();
  });

  it('masks the chunk inside every cloze prompt (attempt before reveal)', () => {
    for (const lesson of lessons)
      for (const t of lesson.targets) {
        const cue = v2CueText(t);
        expect(cue).toContain('___');
        expect(cue.startsWith(t.cueVi)).toBe(true);
      }
  });

  it('embeds input text + vi support + transfer prompt in lesson text', () => {
    const lesson = lessons[0];
    const text = v2LessonText(lesson);
    expect(text).toContain(lesson.input.text.split('\n')[0]);
    expect(text).toContain(lesson.input.noteVi);
    expect(text).toContain(lesson.transferTask.promptVi);
  });

  it('builds stable manifests — wording edits keep ids', () => {
    const m1 = packManifest('p', 'content/2.0.0', lessons, [], 0);
    const edited = lessons.map((l) => ({ ...l, title: `${l.title}!` }));
    const m2 = packManifest('p', 'content/2.0.0', edited, [], 0);
    expect(m1.lessonIds).toEqual(m2.lessonIds);
    expect(m1.targetIds).toEqual(m2.targetIds);
    expect(m1.lessonIds).toEqual([...m1.lessonIds].sort());
  });
});

describe('validator — fails closed on real violations', () => {
  const base = ALL[0];
  const bad = (patch: Partial<LessonSpec>): LessonSpec => ({ ...base, ...patch });

  it('rejects a chunk absent from its source sentence', () => {
    const broken = bad({
      targets: [{ ...base.targets[0], chunk: 'absolutely not present anywhere' }, ...base.targets.slice(1)],
    });
    expect(validateLesson(broken).some((i) => i.code === 'chunk-not-in-source')).toBe(true);
  });

  it('rejects derived input without an exact sourceRefId', () => {
    const broken = bad({ input: { ...base.input, origin: 'derived', sourceRefId: undefined } });
    expect(validateLesson(broken).some((i) => i.code === 'derived-source-missing')).toBe(true);
  });

  it('rejects derived input backed by a non-derivable source', () => {
    const broken = bad({ input: { ...base.input, origin: 'derived', sourceRefId: 'english-for-it' } });
    expect(validateLesson(broken).some((i) => i.code === 'derived-from-restricted')).toBe(true);
  });

  it('rejects a support step or cue that leaks the chunk', () => {
    const broken = bad({
      targets: [{ ...base.targets[0], cueVi: `nghĩa là ${base.targets[0].chunk}` }, ...base.targets.slice(1)],
    });
    const codes = validateLesson(broken).map((i) => i.code);
    expect(codes).toContain('cue-leaks-answer');
  });

  it('rejects audio scaffold steps on non-audio tracks', () => {
    const spoken = ALL.find((l) => l.track === 'survival')!;
    const broken = { ...spoken, supportLadder: [...spoken.supportLadder, 'audio' as const] };
    expect(validateLesson(broken).some((i) => i.code === 'audio-outside-listening')).toBe(true);
  });
});

describe('seeder — migration/progress safety', () => {
  const pack = V2_PACKS[0];
  const lessons = ALL.filter((l) => pack.lessonIds.includes(l.id));

  it('seeds items + collections on an empty db', async () => {
    contentsBulkGetMock.mockResolvedValueOnce([]);
    collectionsBulkGetMock.mockResolvedValueOnce([]);
    const res = await seedV2Pack(pack, lessons, 1000);
    expect(res.contentsAdded).toBeGreaterThan(0);
    expect(res.collectionsAdded).toBeGreaterThan(0);
    expect(contentsBulkPutMock).toHaveBeenCalledOnce();
    expect(collectionsBulkPutMock).toHaveBeenCalledOnce();
  });

  it('is idempotent — a second run writes nothing', async () => {
    const { items, collections } = compilePack(pack, lessons, 1000);
    contentsBulkGetMock.mockResolvedValueOnce(items);
    collectionsBulkGetMock.mockResolvedValueOnce(collections);
    const res = await seedV2Pack(pack, lessons, 1000);
    expect(res.contentsAdded).toBe(0);
    expect(res.collectionsAdded).toBe(0);
    expect(contentsBulkPutMock).not.toHaveBeenCalled();
    expect(collectionsBulkPutMock).not.toHaveBeenCalled();
  });

  it('never resurrects learner-deleted rows', async () => {
    const { items, collections } = compilePack(pack, lessons, 1000);
    const first = items[0];
    contentsBulkGetMock.mockResolvedValueOnce(items.map((r) => (r.id === first.id ? { ...r, deletedAt: 1 } : r)));
    collectionsBulkGetMock.mockResolvedValueOnce(collections);
    const res = await seedV2Pack(pack, lessons, 1000);
    expect(res.skippedDeleted).toBe(1);
    const written = contentsBulkPutMock.mock.calls[0]?.[0] ?? [];
    expect(written.some((i: { id: string }) => i.id === first.id)).toBe(false);
  });

  it('fails closed — an invalid pack writes nothing', async () => {
    const broken = [
      { ...lessons[0], targets: [{ ...lessons[0].targets[0], chunk: 'not in the source text at all' }, ...lessons[0].targets.slice(1)] },
      ...lessons.slice(1),
    ];
    await expect(seedV2Pack(pack, broken, 1000)).rejects.toThrow('failed validation');
    expect(contentsBulkPutMock).not.toHaveBeenCalled();
  });
});
