import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { currentLearnerId, db, switchDatabaseForUser } from '../db';
import { importVocabulary, saveVocabularySubmission } from '../vocabulary-repository';
import {
  commitMappedAttempt,
  LEGACY_CONTRACT_AUDIT,
  mapLegacyAttempt,
  type LegacyAction,
  type MappedAttempt,
} from './adapter';
import { projectState } from './bridge';
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
const LEARNER = 'local.anonymous';

/** A real registered fixture task — used to exercise commit mechanics. */
const MAPPED: MappedAttempt = {
  taskId: 'task.meet.retrieval.ask_name',
  occurredAt: 1000,
  id: 'evt.sub-1',
  attemptId: 'sub-1',
  response: "What's your name?",
};

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

  it('maps nothing today — every action is history-only or a W2-03 gap', () => {
    for (const entry of LEGACY_CONTRACT_AUDIT) {
      expect(entry.status, `${entry.action} claims a mapping`).not.toBe('MAPPED_SAFE');
      expect(entry.status).not.toBe('MAPPED_SAFE');
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });

  it('mapLegacyAttempt returns null for every audited action — no fake minting', () => {
    for (const entry of LEGACY_CONTRACT_AUDIT) {
      const [kind, mode] = entry.action.split(':') as [LegacyAction['kind'], string];
      expect(mapLegacyAttempt(legacyAction({ kind, mode })), entry.action).toBeNull();
    }
  });
});

describe('atomic commit mechanics (W2-02 §3, §13)', () => {
  it('commits history + event in one transaction', async () => {
    await db.transaction('rw', [db.learningAttempts, db.evidenceEvents], async () => {
      await db.learningAttempts.add(attemptRow('sub-1'));
      await commitMappedAttempt(db, MAPPED, LEARNER);
    });
    expect(await db.learningAttempts.get('sub-1')).toBeTruthy();
    const events = await db.evidenceEvents.toArray();
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('evt.sub-1');
    expect(events[0].taskId).toBe('task.meet.retrieval.ask_name');
    expect(events[0].learnerId).toBe(LEARNER);
  });

  it('F1 — event conflict inside the transaction rolls back legacy history', async () => {
    // Seed a conflicting event: same id, different content.
    await commitMappedAttempt(db, MAPPED, LEARNER);
    await expect(
      db.transaction('rw', [db.learningAttempts, db.evidenceEvents], async () => {
        await db.learningAttempts.add(attemptRow('sub-1'));
        await commitMappedAttempt(db, { ...MAPPED, response: 'a different answer' }, LEARNER);
      }),
    ).rejects.toThrow(/conflict/);
    expect(await db.learningAttempts.count()).toBe(0);
    const events = await db.evidenceEvents.toArray();
    expect(events).toHaveLength(1);
    expect(events[0].attempt?.response).toBe("What's your name?");
  });

  it('F2 — legacy write failure inside the transaction rolls back the event', async () => {
    await expect(
      db.transaction('rw', [db.learningAttempts, db.evidenceEvents], async () => {
        await commitMappedAttempt(db, MAPPED, LEARNER);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.learningAttempts.add({ answer: 'no id' } as any);
      }),
    ).rejects.toThrow();
    expect(await db.evidenceEvents.count()).toBe(0);
    expect(await db.learningAttempts.count()).toBe(0);
  });

  it('duplicate submit dedupes — identical redelivery does not double-mint', async () => {
    await commitMappedAttempt(db, MAPPED, LEARNER);
    await commitMappedAttempt(db, MAPPED, LEARNER);
    const events = await db.evidenceEvents.toArray();
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('evt.sub-1');
  });

  it('same event id with different content is refused (fail-closed)', async () => {
    await commitMappedAttempt(db, MAPPED, LEARNER);
    await expect(
      commitMappedAttempt(db, { ...MAPPED, occurredAt: 2000 }, LEARNER),
    ).rejects.toThrow(/conflict/);
    expect(await db.evidenceEvents.count()).toBe(1);
  });

  it('a mapped commit outside any transaction still works via the same bridge path', async () => {
    await commitMappedAttempt(db, MAPPED, LEARNER);
    expect(await db.evidenceEvents.count()).toBe(1);
  });
});

describe('learner identity (W2-02 §9)', () => {
  it('uses the authenticated user id or the stable local anonymous subject', async () => {
    expect(currentLearnerId()).toBe('local.anonymous');
    await switchDatabaseForUser('w2-02-identity-test');
    try {
      expect(currentLearnerId()).toBe('w2-02-identity-test');
    } finally {
      await db.delete();
      await switchDatabaseForUser(null);
    }
    expect(currentLearnerId()).toBe('local.anonymous');
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
    await commitMappedAttempt(
      db,
      { ...MAPPED, id: 'evt.sub-2', attemptId: 'sub-2', outcome: 'success' },
      LEARNER,
    );
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
      expect(events[0].learnerId).toBe('local.anonymous');
    } finally {
      AUDIT.pop();
    }
  });

  it('F1 on the real path — event conflict rolls back the whole vocab submission', async () => {
    injectMapping();
    try {
      // Seed a conflicting event under the id this submission would mint.
      await commitMappedAttempt(
        db,
        { taskId: 'task.meet.retrieval.ask_name', occurredAt: 1, id: 'evt.vocab-f1', response: 'earlier' },
        LEARNER,
      );
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

  it('double submit is an idempotent no-op — one history row, one event (W2-AT1)', async () => {
    injectMapping();
    try {
      await importVocabulary('Words', 'word,meaning\nhelpful,有帮助的');
      const word = (await db.contents.toArray())[0];
      const sub = { id: 'vocab-dupe', contentId: word.id, mode: 'meaning' as const, answer: 'có ích', revealed: true, rating: 3 };
      await saveVocabularySubmission(sub);
      await saveVocabularySubmission(sub);
      expect(await db.learningAttempts.count()).toBe(1);
      expect(await db.evidenceEvents.count()).toBe(1);
    } finally {
      AUDIT.pop();
    }
  });
});
