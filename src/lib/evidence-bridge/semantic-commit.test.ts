import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { LearningAttempt } from '@/types/learning-activity';
import { currentLearnerId, db, switchDatabaseForUser } from '../db';
import { persistLearningAttempt } from '../learning-activity-persistence';
import { importVocabulary, saveVocabularySubmission } from '../vocabulary-repository';
import {
  LEGACY_CONTRACT_AUDIT,
  mapLegacyAttempt,
  runSemanticCommit,
  type LegacyAction,
  type MappedAttempt,
} from './adapter';
import { projectState, submitAttempt } from './bridge';
import { fixtureRegistry } from './registry';
import { createDexieEventStore } from './store';

/*
 * W2-02 / W2-G02 + W2-AT1 — semantic commit adapter.
 *
 * Proves the one invariant: history + EvidenceEvent commit atomically inside
 * a single Dexie transaction, or not at all — and that no legacy action mints
 * evidence without an honestly registered TaskContract.
 */

const registry = fixtureRegistry();
// The persistent anonymous subject — generated once, stored, stable.
const LEARNER = currentLearnerId();

/** A real registered fixture task — used to exercise commit mechanics. */
const MAPPED: MappedAttempt = {
  taskId: 'task.meet.retrieval.ask_name',
  occurredAt: 1000,
  id: 'evt.sub-1',
  attemptId: 'sub-1',
  response: "What's your name?",
};

/**
 * Seed a kernel event via the NATIVE bridge path (submitAttempt) — the
 * legacy adapter must never be the fixture factory for event-only writes.
 */
const seedEvent = (mapped: MappedAttempt) =>
  submitAttempt(createDexieEventStore(db.evidenceEvents), registry, { ...mapped, learnerId: LEARNER });

/**
 * Drive the seam the only legal way: runSemanticCommit owns the transaction
 * and mechanically verifies the canonical history row — a callback's return
 * value is never treated as proof of a write.
 */
const commitViaSeam = (
  mapped: MappedAttempt,
  over: {
    writeHistory?: () => Promise<unknown>;
    tables?: Parameters<typeof runSemanticCommit>[0]['tables'];
    verify?: () => void;
  } = {},
) =>
  runSemanticCommit({
    database: db,
    tables: over.tables ?? [db.learningAttempts],
    historyTable: db.learningAttempts,
    mapped,
    learnerId: LEARNER,
    verify: over.verify,
    // Mirrors the real producers: an existing row early-exits, so a retry
    // never re-writes history — and the seam still skips the event append.
    writeHistory: over.writeHistory ?? (async () => {
      if (await db.learningAttempts.get(mapped.attemptId ?? 'sub-1')) return 'noop';
      await db.learningAttempts.add(attemptRow(mapped.attemptId ?? 'sub-1'));
      return 'created';
    }),
  });

const legacyAction = (over: Partial<LegacyAction> = {}): LegacyAction => ({
  id: 'sub-1',
  kind: 'vocabulary',
  mode: 'meaning',
  occurredAt: 1000,
  response: 'meaning recall',
  ...over,
});

const attemptRow = (id: string) => ({
  id,
  lessonId: 'lesson',
  unitId: 'unit',
  activity: 'writing' as const,
  sourceContentIds: [],
  sourceText: 'source',
  prompt: 'prompt',
  answer: 'answer',
  feedback: { source: 'self' as const, notes: '', checklist: [] },
  status: 'submitted' as const,
  createdAt: 1000,
  updatedAt: 1000,
});

beforeEach(async () => {
  await Promise.all([
    db.contents.clear(),
    db.books.clear(),
    db.importJobs.clear(),
    db.records.clear(),
    db.sessions.clear(),
    db.learningAttempts.clear(),
    db.dailyTasks.clear(),
    db.mediaBlobs.clear(),
    db.evidenceEvents.clear(),
  ]);
});

describe('contract-mapping audit (W2-02 §6–§8)', () => {
  it('covers every live legacy action shape', () => {
    const expected = [
      ...['meaning', 'spelling', 'dictation', 'application', 'construction'].map(
        (m) => `vocabulary:${m}`,
      ),
      ...['comprehension', 'writing', 'retelling', 'personal-example', 'sentence-pronunciation'].map(
        (a) => `learning-attempt:${a}`,
      ),
      ...['understand', 'output', 'correct', 'recall', 'apply'].map((s) => `text-cycle:${s}`),
    ];
    expect(LEGACY_CONTRACT_AUDIT.map((e) => e.action).sort()).toEqual(expected.sort());
  });

  it('maps exactly one action — the W2-02.5 spelling pilot; the rest stay blocked', () => {
    const safe = LEGACY_CONTRACT_AUDIT.filter((e) => e.status === 'MAPPED_SAFE');
    expect(safe.map((e) => e.action)).toEqual(['vocabulary:spelling']);
    expect(safe[0].taskId).toBe('task.vocab.spelling.v1');
    expect(typeof safe[0].map).toBe('function');
    expect(typeof safe[0].resolveScoring).toBe('function');
    for (const entry of LEGACY_CONTRACT_AUDIT) {
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });

  it('mapLegacyAttempt returns null for every still-unmapped action — no fake minting', () => {
    for (const entry of LEGACY_CONTRACT_AUDIT) {
      if (entry.status === 'MAPPED_SAFE') continue;
      const [kind, mode] = entry.action.split(':') as [LegacyAction['kind'], string];
      expect(mapLegacyAttempt(legacyAction({ kind, mode })), entry.action).toBeNull();
    }
  });
});

describe('MAPPED_SAFE requires an action-specific provenance mapper (W2-02R)', () => {
  const AUDIT = LEGACY_CONTRACT_AUDIT as unknown as { push(e: unknown): number; pop(): unknown };

  it('a bare {status, taskId} flip is not activatable — missing map throws', () => {
    AUDIT.push({
      action: 'vocabulary:meaning',
      status: 'MAPPED_SAFE',
      taskId: 'task.meet.retrieval.ask_name',
      reason: 'injected MAPPED_SAFE without a mapper',
    });
    try {
      expect(() => mapLegacyAttempt(legacyAction())).toThrow(/no provenance mapper/);
    } finally {
      AUDIT.pop();
    }
  });

  it('a mapper that drops declared support provenance fails closed (laundering guard)', () => {
    AUDIT.push({
      action: 'text-cycle:recall',
      status: 'MAPPED_SAFE',
      taskId: 'task.meet.retrieval.ask_name',
      // Dishonest mapper: omits assisted/sourceRevealed → would mint
      // apparent independent evidence from an assisted recall.
      map: (a: LegacyAction) => ({ response: a.response }),
      reason: 'injected laundering mapper',
    });
    try {
      const assistedRecall = legacyAction({
        kind: 'text-cycle',
        mode: 'recall',
        support: { assisted: true, sourceRevealed: true, translation: true },
      });
      expect(() => mapLegacyAttempt(assistedRecall)).toThrow(
        /dropped support provenance: assisted, sourceRevealed, translation/,
      );
    } finally {
      AUDIT.pop();
    }
  });

  it('an honest mapper preserves every declared support fact', () => {
    AUDIT.push({
      action: 'text-cycle:recall',
      status: 'MAPPED_SAFE',
      taskId: 'task.meet.retrieval.ask_name',
      map: (a: LegacyAction) => ({ response: a.response, support: { ...a.support } }),
      reason: 'injected honest mapper',
    });
    try {
      const mapped = mapLegacyAttempt(
        legacyAction({ kind: 'text-cycle', mode: 'recall', support: { assisted: true } }),
      );
      expect(mapped).toBeTruthy();
      expect(mapped?.support?.assisted).toBe(true);
      expect(mapped?.id).toBe('evt.sub-1');
    } finally {
      AUDIT.pop();
    }
  });
});

describe('atomic commit mechanics (W2-02 §3, §13, W2-02R2)', () => {
  it('commits history + event in one seam-owned transaction', async () => {
    await commitViaSeam(MAPPED);
    expect(await db.learningAttempts.get('sub-1')).toBeTruthy();
    const events = await db.evidenceEvents.toArray();
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('evt.sub-1');
    expect(events[0].taskId).toBe('task.meet.retrieval.ask_name');
    expect(events[0].learnerId).toBe(LEARNER);
  });

  it('F1 — event conflict inside the transaction rolls back legacy history', async () => {
    // Seed a conflicting event via the native path: same id, different content.
    await seedEvent(MAPPED);
    await expect(
      commitViaSeam({ ...MAPPED, response: 'a different answer' }),
    ).rejects.toThrow(/conflict/);
    expect(await db.learningAttempts.count()).toBe(0);
    const events = await db.evidenceEvents.toArray();
    expect(events).toHaveLength(1);
    expect(events[0].attempt?.response).toBe("What's your name?");
  });

  it('F2 — legacy write failure inside the transaction rolls back the event', async () => {
    await expect(
      commitViaSeam(MAPPED, {
        writeHistory: async () => {
          await db.learningAttempts.add({ answer: 'no id' } as never);
        },
      }),
    ).rejects.toThrow();
    expect(await db.evidenceEvents.count()).toBe(0);
    expect(await db.learningAttempts.count()).toBe(0);
  });

  it('duplicate submit dedupes — identical redelivery does not double-mint', async () => {
    await commitViaSeam(MAPPED);
    await commitViaSeam(MAPPED);
    const events = await db.evidenceEvents.toArray();
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('evt.sub-1');
  });

  it('R4-B — divergent post-cutover redelivery is refused (conflict), not silently accepted', async () => {
    await commitViaSeam(MAPPED);
    // History + event both exist → the seam re-delivers through the
    // canonical store: same event id, different content → conflict → throw.
    await expect(commitViaSeam({ ...MAPPED, occurredAt: 2000 })).rejects.toThrow(/conflict/);
    const events = await db.evidenceEvents.toArray();
    expect(events).toHaveLength(1);
    expect(events[0].occurredAt).toBe(1000);
    // Original history row unchanged — writeHistory never ran.
    expect((await db.learningAttempts.get('sub-1'))?.createdAt).toBe(1000);
  });

  it('the legacy seam has NO event-only escape hatch (W2-02R2/R3)', async () => {
    // The append primitive is module-private — the only export is the
    // transaction-owning coordinator, so `commitMappedAttempt`-style
    // standalone minting cannot be expressed by any caller.
    const adapter = await import('./adapter');
    expect('commitMappedAttempt' in adapter).toBe(false);
    // History tables alone cannot smuggle an event — the seam adds
    // evidenceEvents to the transaction itself, and the append primitive
    // never reaches a caller at all.
  });

  it('R3-A — a lying writeHistory (claims success, writes nothing) is refused', async () => {
    await expect(
      commitViaSeam(MAPPED, { writeHistory: async () => 'created' }),
    ).rejects.toThrow(/no history row/);
    expect(await db.learningAttempts.count()).toBe(0);
    expect(await db.evidenceEvents.count()).toBe(0);
  });

  it('R3-B — empty tables cannot mint an event either', async () => {
    await expect(
      commitViaSeam(MAPPED, { tables: [], writeHistory: async () => 'created' }),
    ).rejects.toThrow(/no history row/);
    expect(await db.evidenceEvents.count()).toBe(0);
  });

  it('R3-C — a history row under the wrong id does not satisfy the proof', async () => {
    await expect(
      commitViaSeam(MAPPED, {
        writeHistory: async () => {
          await db.learningAttempts.add(attemptRow('a-different-attempt'));
          return 'created';
        },
      }),
    ).rejects.toThrow(/no history row/);
    // Everything rolls back — including the wrong-id row the callback wrote.
    expect(await db.learningAttempts.count()).toBe(0);
    expect(await db.evidenceEvents.count()).toBe(0);
  });

  it('R4-C — pre-cutover row: writeHistory is never invoked and no event mints', async () => {
    await db.learningAttempts.add(attemptRow('sub-1'));
    let writeCalls = 0;
    await commitViaSeam(MAPPED, {
      writeHistory: async () => {
        writeCalls++;
        return 'created';
      },
    });
    expect(writeCalls).toBe(0);
    expect(await db.learningAttempts.count()).toBe(1);
    expect(await db.evidenceEvents.count()).toBe(0);
  });

  it('R3-G — post-append verify failure rolls back history AND event', async () => {
    await expect(
      commitViaSeam(MAPPED, {
        verify: () => {
          throw new Error('Account changed');
        },
      }),
    ).rejects.toThrow(/Account changed/);
    expect(await db.learningAttempts.count()).toBe(0);
    expect(await db.evidenceEvents.count()).toBe(0);
  });
});

describe('learner identity (W2-02 §9, W2-02R)', () => {
  it('anonymous subject is a persistent unique local.<uuid>, not a constant', async () => {
    const subject = currentLearnerId();
    expect(subject).toMatch(/^local\.[0-9a-f-]{36}$/);
    // Stable across repeated calls — generated once, persisted, not per-call.
    expect(currentLearnerId()).toBe(subject);
    await switchDatabaseForUser('w2-02-identity-test');
    try {
      expect(currentLearnerId()).toBe('w2-02-identity-test');
    } finally {
      await db.delete();
      await switchDatabaseForUser(null);
    }
    // Switching back to the anonymous store restores the SAME local subject —
    // the subject outlives the account transition; events keep it forever.
    expect(currentLearnerId()).toBe(subject);
  });

  it('anonymous EvidenceEvent learnerId is never rewritten by an account switch', async () => {
    const subject = currentLearnerId();
    await seedEvent({ ...MAPPED, id: 'evt.identity-1', attemptId: 'identity-1' });
    await switchDatabaseForUser('w2-02-identity-test-2');
    try {
      expect(await db.evidenceEvents.count()).toBe(0); // fresh account DB
    } finally {
      await db.delete();
      await switchDatabaseForUser(null);
    }
    const event = await db.evidenceEvents.get('evt.identity-1');
    expect(event?.learnerId).toBe(subject); // immutable, not rebound to the user id
  });
});

describe('production paths stay history-only while unmapped (W2-02 §8, §24)', () => {
  it('saveVocabularySubmission commits history and mints zero events', async () => {
    await importVocabulary('Words', 'word,meaning\nhelpful,有帮助的');
    const word = (await db.contents.toArray())[0];
    await saveVocabularySubmission({
      id: 'vocab-sub-1',
      contentId: word.id,
      mode: 'meaning',
      answer: 'có ích',
      revealed: true,
      rating: 3,
    });
    expect(await db.learningAttempts.get('vocab-sub-1')).toBeTruthy();
    expect(await db.sessions.get('vocab-sub-1')).toBeTruthy();
    expect(await db.evidenceEvents.count()).toBe(0);
  });

  it('pre-cutover history never gains a synthetic event on retry', async () => {
    await importVocabulary('Words', 'word,meaning\nhelpful,有帮助的');
    const word = (await db.contents.toArray())[0];
    const sub = {
      id: 'pre-cutover-1',
      contentId: word.id,
      mode: 'meaning' as const,
      answer: 'recall',
      revealed: true,
      rating: 3,
    };
    await saveVocabularySubmission(sub);
    // Retry the same submission — idempotent no-op, still no event.
    await saveVocabularySubmission(sub);
    expect(await db.learningAttempts.count()).toBe(1);
    expect(await db.evidenceEvents.count()).toBe(0);
  });
});

describe('event-store determinism preserved through the seam', () => {
  it('bridge re-scores deterministic contracts — UI outcome is never trusted', async () => {
    await seedEvent({ ...MAPPED, id: 'evt.sub-2', attemptId: 'sub-2', outcome: 'success' });
    const event = (await db.evidenceEvents.toArray())[0];
    // The evaluator decides; a caller-claimed outcome cannot force success.
    expect(event.evaluation?.authority).not.toBe('self_report');
  });
});

describe('wired production path — seam proven end-to-end (W2-02 §13, §24, §26)', () => {
  const AUDIT = LEGACY_CONTRACT_AUDIT as unknown as { push(e: unknown): number; pop(): unknown };
  const injectMapping = () =>
    AUDIT.push({
      action: 'vocabulary:meaning',
      status: 'MAPPED_SAFE',
      taskId: 'task.meet.retrieval.ask_name',
      // Action-specific provenance mapper (W2-02R): carries declared support
      // facts (revealed) through verbatim — the guard refuses any drop.
      map: (a: LegacyAction) => ({ response: a.response, support: a.support }),
      reason: 'test-injected mapping — exercises the wired seam on a real registered contract',
    });
  const importAndSubmit = async (id: string, answer = 'có ích') => {
    await importVocabulary('Words', 'word,meaning\nhelpful,有帮助的');
    const word = (await db.contents.toArray())[0];
    await saveVocabularySubmission({ id, contentId: word.id, mode: 'meaning', answer, revealed: true, rating: 3 });
  };

  it('a mapped submission commits history + EvidenceEvent in one transaction', async () => {
    injectMapping();
    try {
      await importAndSubmit('vocab-mapped-1');
      expect(await db.learningAttempts.get('vocab-mapped-1')).toBeTruthy();
      expect(await db.sessions.get('vocab-mapped-1')).toBeTruthy();
      const events = await db.evidenceEvents.toArray();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('evt.vocab-mapped-1');
      expect(events[0].attempt?.attemptId).toBe('vocab-mapped-1');
      expect(events[0].taskId).toBe('task.meet.retrieval.ask_name');
      expect(events[0].learnerId).toBe(LEARNER);
    } finally {
      AUDIT.pop();
    }
  });

  it('F1 on the real path — event conflict rolls back the whole vocab submission', async () => {
    injectMapping();
    try {
      // Seed a conflicting event under the id this submission would mint.
      await seedEvent({
        taskId: 'task.meet.retrieval.ask_name',
        occurredAt: 1,
        id: 'evt.vocab-f1',
        response: 'earlier',
      });
      await expect(importAndSubmit('vocab-f1', 'a different answer')).rejects.toThrow(/conflict/);
      expect(await db.learningAttempts.count()).toBe(0);
      expect(await db.sessions.count()).toBe(0);
      expect(await db.records.count()).toBe(0);
      expect(await db.evidenceEvents.count()).toBe(1); // the seed, unchanged
    } finally {
      AUDIT.pop();
    }
  });

  it('projection changes only per the registered contract — no capability promotion (§25)', async () => {
    injectMapping();
    try {
      await importAndSubmit('vocab-proj-1');
      const projection = await projectState(LEARNER, createDexieEventStore(db.evidenceEvents), registry);
      // Exactly one capability was touched — the contract's, not a legacy claim.
      const touched = [...projection.byCapability.entries()].filter(
        ([, s]) => s.lastEventAt != null,
      );
      expect(touched.map(([id]) => id)).toEqual(['interaction.ask_name']);
      const slot = touched[0][1];
      // A single retrieval attempt can at most mark practiced milestones —
      // never retention/transfer/fluency from a legacy heuristic.
      expect(slot?.milestones.retained).toBe(false);
      expect(slot?.milestones.transferred).toBe(false);
      expect(slot?.milestones.fluent).toBe(false);
    } finally {
      AUDIT.pop();
    }
  });

  it('identical redelivery dedupes — one history row, one event (W2-AT1, R4-A)', async () => {
    injectMapping();
    try {
      await importVocabulary('Words', 'word,meaning\nhelpful,有帮助的');
      const word = (await db.contents.toArray())[0];
      const sub = { id: 'vocab-dupe', contentId: word.id, mode: 'meaning' as const, answer: 'có ích', revealed: true, rating: 3 };
      // Truly identical redelivery — same submission id AND same occurredAt —
      // produces the identical event → canonical dedupe, no double-mint.
      await saveVocabularySubmission(sub, db, 1000);
      await saveVocabularySubmission(sub, db, 1000);
      expect(await db.learningAttempts.count()).toBe(1);
      expect(await db.evidenceEvents.count()).toBe(1);
      // A redelivery with divergent content (different occurredAt) is a
      // canonical conflict — refused, not silently accepted (R4-B).
      await expect(saveVocabularySubmission(sub, db, 2000)).rejects.toThrow(/conflict/);
      expect(await db.evidenceEvents.count()).toBe(1);
    } finally {
      AUDIT.pop();
    }
  });
});

describe('mapped persistLearningAttempt retry integrity (W2-02R4 D/E)', () => {
  const AUDIT = LEGACY_CONTRACT_AUDIT as unknown as { push(e: unknown): number; pop(): unknown };
  const injectWritingMapping = () =>
    AUDIT.push({
      action: 'learning-attempt:writing',
      status: 'MAPPED_SAFE',
      taskId: 'task.meet.retrieval.ask_name',
      map: (a: LegacyAction) => ({ response: a.response }),
      reason: 'test-injected mapping — exercises the seam through persistLearningAttempt',
    });
  // persistLearningAttempt's writeHistory uses unconditional .add — the
  // seam must skip it entirely on retry or the second call ConstraintErrors.
  const attempt = (id: string, answer = 'answer') => ({ ...attemptRow(id), answer }) as LearningAttempt;

  it('R4-D — identical mapped retry is idempotent: no ConstraintError, one row, one event', async () => {
    injectWritingMapping();
    try {
      await persistLearningAttempt(db, attempt('la-1'), undefined, () => true);
      await persistLearningAttempt(db, attempt('la-1'), undefined, () => true);
      expect(await db.learningAttempts.count()).toBe(1);
      const events = await db.evidenceEvents.toArray();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('evt.la-1');
    } finally {
      AUDIT.pop();
    }
  });

  it('R4-E — divergent mapped retry is refused; original row and event unchanged', async () => {
    injectWritingMapping();
    try {
      await persistLearningAttempt(db, attempt('la-1'), undefined, () => true);
      await expect(
        persistLearningAttempt(db, attempt('la-1', 'a different answer'), undefined, () => true),
      ).rejects.toThrow(/conflict/);
      const row = await db.learningAttempts.get('la-1');
      expect(row?.answer).toBe('answer');
      const events = await db.evidenceEvents.toArray();
      expect(events).toHaveLength(1);
      expect(events[0].attempt?.response).toBe('answer');
    } finally {
      AUDIT.pop();
    }
  });
});
