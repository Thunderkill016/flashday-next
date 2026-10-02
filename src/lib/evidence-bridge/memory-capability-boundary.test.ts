import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { canonicalFamilyId, makeMission, makeTask } from '@/vnext/contracts';
import { EVALUATORS } from '@/vnext/evaluators';
import { canonicalExactText } from '@/vnext/normalize';
import { projectLearnerState } from '@/vnext/projection';
import { currentLearnerId, db } from '../db';
import { normalizeSpelling, spellingMatches, vocabularyRecordId } from '../vocabulary';
import { importVocabulary, saveVocabularySubmission } from '../vocabulary-repository';
import { LEGACY_CONTRACT_AUDIT, type LegacyAction } from './adapter';
import { submitAttempt } from './bridge';
import { createRegistry, fixtureRegistry } from './registry';
import { createDexieEventStore } from './store';
import type { ContractRegistry } from './types';

/*
 * W2-02.5 — MEMORY vs CAPABILITY authority boundary.
 *
 * The mission question: is `vocabulary:spelling` capability evidence or
 * item-level memory evidence? The falsification harness below registers a
 * TEST-ONLY generic lexical-form capability scored by a TEST-ONLY
 * deterministic exact-match evaluator, then replays the real projection:
 *
 *   one independently correct lexical item  → capability INDEPENDENT
 *   a second correct attempt after the lag  → capability RETAINED
 *
 * Both promotions are mechanically real — and semantically dishonest:
 * the evidence proves retention of ONE item, while the claim 'the learner
 * can produce learned lexical forms in general' erases the item identity
 * that makes it true. The honest home for that evidence is the memory
 * domain (FSRS item state), so spelling stays unmapped. These tests prove
 * the overclaim is possible, pin why it is rejected, and verify the real
 * production path mints nothing for vocabulary actions.
 *
 * Nothing here ships: the capability/task/evaluator are file-scoped test
 * fixtures, never registered in fixtureRegistry() or EVALUATORS beyond
 * each test's lifetime.
 */

const TEST_EVAL = 'eval.test.lexical_exact.v1';
const TEST_CAP = 'capability.test.lexical_form_generic.v1';
const TEST_TASK = 'task.test.lexical_form.v1';
const TEST_MISSION = 'mission.test.lexical_form.v1';
const LEARNER = currentLearnerId();

/* Deterministic exact-match scorer — identical semantics to the evaluator
 * considered and rejected for production registration: normalized equality
 * against the target FIXED IN THE TEST TASK CONTRACT (test metadata — the
 * falsification does not broaden production submitAttempt). Abstains
 * (null) when the contract carries no target; never invents a partial.
 * Registered into the module map ONLY for the test's lifetime. */
const exactMatchEvaluator = {
  contractId: TEST_EVAL,
  describe: 'test-only: success iff canonicalized response === canonicalized contract target',
  attributesFunctions: false,
  score: (
    task: { evaluation?: { target?: string } },
    response: unknown,
  ): { outcome: 'success' | 'fail'; missingFunctions: string[]; scoredTarget?: string } | null => {
    const target = task?.evaluation?.target;
    if (typeof target !== 'string' || !target.trim()) return null;
    const scoredTarget = canonicalExactText(target);
    const raw =
      typeof response === 'string' ? response : ((response as { text?: unknown })?.text ?? '');
    const answer = canonicalExactText(typeof raw === 'string' ? raw : '');
    return {
      outcome: answer.length > 0 && answer === scoredTarget ? 'success' : 'fail',
      missingFunctions: [],
      scoredTarget,
    };
  },
};

/* A GENERIC lexical-form capability — deliberately the shape a spelling
 * mapping would need: 'can produce written forms of learned lexical items
 * under a meaning cue'. One flag per item is exactly the overclaim the
 * falsification targets. */
const SIGNATURE = {
  cueTopology: 'definition_to_form',
  setting: 'self_paced_practice',
  register: 'neutral',
  channel: 'typed',
  lexicalDomain: 'learned_vocabulary',
  responseTopology: 'single_orthographic_form',
};

const taskIdFor = (target: string) => `${TEST_TASK}.${canonicalExactText(target)}`;

/* One registry per test covering the targets it needs — each target gets
 * its own test task (the contract pins what the evaluator scores), all
 * bound to the SAME generic capability. */
const testRegistry = (targets: string[]): ContractRegistry =>
  createRegistry({
    capabilities: [
      {
        id: TEST_CAP,
        version: 1,
        performance:
          'Produce the written form of learned lexical items when cued by their stored meaning.',
        modality: 'writing',
        prerequisites: [],
        conditions: { partnerCooperative: false, topicFamiliar: true, supportAllowed: [] },
        language: { chunks: [], constructions: [], vocabulary: [] },
        evidence: { independentRequired: true, delayedRequired: false, transferRequired: false },
        vietnameseRiskProbes: [],
        criteria: {
          meaningDelivered: false,
          intelligibleEnoughForPartner: false,
          requiredFunctions: [],
        },
      } as never,
    ],
    missions: [
      makeMission({
        id: TEST_MISSION,
        revision: 1,
        scenario: 'TEST-ONLY: write a learned word from its definition.',
        learnerGoal: 'Recall the written form of a familiar vocabulary item.',
        carrierCapabilities: [TEST_CAP],
        language: {
          assumedKnown: { chunks: [], vocabulary: [], constructions: [] },
          introduced: { chunks: [], vocabulary: [], constructions: [] },
        },
        taskIds: targets.map(taskIdFor),
      }) as never,
    ],
    tasks: targets.map(
      (target) =>
        makeTask({
          id: taskIdFor(target),
          missionId: TEST_MISSION,
          capabilityId: TEST_CAP,
          modality: 'writing',
          purpose: 'retrieval',
          promptFamily: canonicalFamilyId(TEST_CAP, SIGNATURE, 1),
          contextSignature: SIGNATURE,
          response: { type: 'text', requiredFunctions: [] },
          evaluation: { authority: 'deterministic', contractId: TEST_EVAL, target },
          freshness: { required: false, familyClass: 'practiced' },
          supportPolicy: { allowed: [] },
        }) as never,
    ),
  });

const store = () => createDexieEventStore(db.evidenceEvents);

const mintLexical = (attemptId: string, target: string, text: string, occurredAt: number) =>
  submitAttempt(store(), testRegistry([target]), {
    learnerId: LEARNER,
    taskId: taskIdFor(target),
    attemptId,
    occurredAt,
    response: { text },
  });

/* Replay over the FULL capability space — production set + the test-only
 * capability — so 'nothing else moved' is asserted against every
 * registered capability, not just the test one. */
const projectFromStore = async (retentionDelayMs?: number) => {
  const registry = testRegistry(['helpful', 'portable', 'xylophone']);
  const production = fixtureRegistry();
  const events = await db.evidenceEvents.toArray();
  return projectLearnerState(
    LEARNER,
    events as never,
    [...production.capabilities, ...registry.capabilities] as never,
    [...production.tasks, ...registry.tasks] as never,
    { retentionDelayMs },
  );
};

/** Register a word through the real producer path. */
const seedWords = async (csv: string) => {
  await importVocabulary('Words', csv);
  return db.contents.toArray();
};

const submitSpelling = (id: string, contentId: string, answer: string, over = {}) =>
  saveVocabularySubmission(
    { id, contentId, mode: 'spelling', answer, revealed: true, rating: 3, ...over },
    db,
    1000,
  );

beforeEach(async () => {
  (EVALUATORS as Record<string, unknown>)[TEST_EVAL] = exactMatchEvaluator;
  await Promise.all([
    db.contents.clear(),
    db.books.clear(),
    db.importJobs.clear(),
    db.records.clear(),
    db.sessions.clear(),
    db.learningAttempts.clear(),
    db.dailyTasks.clear(),
    db.evidenceEvents.clear(),
  ]);
});

afterEach(() => {
  delete (EVALUATORS as Record<string, unknown>)[TEST_EVAL];
});

/* ── Reusable finding: canonical normalization is a single definition ── */

describe('canonical normalization — single definition shared by scorer and UI (reusable finding)', () => {
  const cases: [string, string, boolean][] = [
    ['hello', 'Hello', true],
    ['  hello  ', 'hello', true],
    ['rock ’ n', "rock ' n", true],
    ['well–known', 'well-known', true],
    ['a   b', 'a b', true],
    ['helpfull', 'helpful', false],
    ['[not recalled]', 'helpful', false],
    ['', 'hello', false],
  ];
  it.each(cases)('canonicalExactText(%j) vs %j === legacy spellingMatches', (a, b, expected) => {
    expect(canonicalExactText(a) === canonicalExactText(b)).toBe(expected);
    expect(spellingMatches(a, b)).toBe(expected);
  });
  it('normalizeSpelling delegates to the canonical definition — no drift', () => {
    for (const v of ['  Well–Known  ', 'rock ’n’ roll', 'A  B', 'HELLO']) {
      expect(normalizeSpelling(v)).toBe(canonicalExactText(v));
    }
  });
});

/* ── The falsification: the projection WILL overclaim a generic capability ── */

describe('projection counterexample — deterministic item success inflates a generic capability', () => {
  it('ONE correct lexical item mints INDEPENDENT on a generic capability', async () => {
    await mintLexical('att-1', 'helpful', 'helpful', 1_000);
    const slot = (await projectFromStore()).byCapability.get(TEST_CAP);
    // The promotion is mechanically real — and the documented overclaim:
    // one item's recall is not evidence of a general lexical-form ability.
    expect(slot?.state).toBe('INDEPENDENT');
    expect(slot?.milestones.independent).toBe(true);
    expect(slot?.milestones.retained).toBe(false);
  });

  it('a second correct attempt >= retention delay mints RETAINED — on two items', async () => {
    await mintLexical('att-1', 'helpful', 'helpful', 1_000);
    // The delay is a projection-policy override so the test stays fast;
    // semantic content is identical to waiting the real 24h.
    await mintLexical('att-2', 'portable', 'portable', 2_000);
    const slot = (await projectFromStore(500)).byCapability.get(TEST_CAP);
    expect(slot?.state).toBe('RETAINED');
    expect(slot?.milestones.retained).toBe(true);
  });

  it('the generic capability cannot even say WHICH item the evidence was about', async () => {
    // Two entirely different learned items promote the SAME generic
    // capability — the item identity that makes each claim honest is
    // invisible to LearnerProjection by construction.
    await mintLexical('att-1', 'helpful', 'helpful', 1_000);
    await mintLexical('att-2', 'xylophone', 'xylophone', 2_000);
    const events = await db.evidenceEvents.toArray();
    const caps = new Set(events.map((e) => e.capabilityId));
    expect([...caps]).toEqual([TEST_CAP]);
    // Nothing on the event or slot distinguishes 'helpful' from
    // 'xylophone' — the item lives only in attempt.response, not in the
    // capability claim.
    const slot = (await projectFromStore()).byCapability.get(TEST_CAP);
    expect(slot?.milestones.independent).toBe(true);
  });

  it('deterministic scoring does NOT justify the domain — spelling stays MEMORY_ITEM', () => {
    const entry = LEGACY_CONTRACT_AUDIT.find((e) => e.action === 'vocabulary:spelling');
    expect(entry?.authorityDomain).toBe('MEMORY_ITEM');
    expect(entry?.status).toBe('BLOCKED_PENDING_W2_03');
  });
});

/* ── The real path: spelling writes memory state, never capability events ── */

describe('vocabulary:spelling on the real producer path — memory domain only', () => {
  it('FSRS state advances while the capability projection stays untouched', async () => {
    const [word] = await seedWords('word,meaning\nhelpful,有帮助的');
    await submitSpelling('sp-1', word.id, 'helpful');
    // Memory domain moved: FSRS card + review scheduling updated.
    const record = await db.records.get(vocabularyRecordId(word.id, 'spelling'));
    expect(record?.fsrsCard).toBeTruthy();
    expect(record?.lastPracticed).toBe(1000);
    expect(await db.learningAttempts.get('sp-1')).toBeTruthy();
    // Capability domain untouched: no event minted, nothing to replay.
    expect(await db.evidenceEvents.count()).toBe(0);
    const projection = await projectFromStore();
    const touched = [...projection.byCapability.entries()].filter(([, s]) => s.lastEventAt != null);
    expect(touched).toEqual([]);
    expect(projection.byCapability.get('production.write.personal_info_short')?.lastEventAt).toBeNull();
  });

  it('every vocabulary mode stays event-free — none is a capability claim', async () => {
    const [word] = await seedWords('word,meaning\nhelpful,有帮助的');
    for (const [i, mode] of ['meaning', 'spelling', 'dictation'].entries()) {
      await saveVocabularySubmission(
        {
          id: `vm-${i}`,
          contentId: word.id,
          mode: mode as 'meaning' | 'spelling' | 'dictation',
          answer: mode === 'meaning' ? 'not-empty' : 'helpful',
          revealed: true,
          rating: 3,
        },
        db,
        1000 + i,
      );
    }
    expect(await db.learningAttempts.count()).toBe(3);
    expect(await db.evidenceEvents.count()).toBe(0);
  });
});

/* ── Post-response reveal is never attempt support ── */

describe('post-response reveal is not attempt support (reusable finding)', () => {
  const AUDIT = LEGACY_CONTRACT_AUDIT as unknown as { push(e: unknown): number; pop(): unknown };

  it('the producer never declares `revealed` on the semantic action — even a mapped event shows none', async () => {
    // Hypothetical activation: inject a spelling mapping onto a real
    // fixture task and let the honest mapper pass declared support through.
    // The producer's action carries NO `revealed` flag — the word is hidden
    // until the answer locks, so the compare step is post-response, and the
    // minted event proves it never reached the attempt.
    AUDIT.push({
      action: 'vocabulary:spelling',
      status: 'MAPPED_SAFE',
      authorityDomain: 'MEMORY_ITEM',
      taskId: 'task.meet.retrieval.ask_name',
      map: (a: LegacyAction) => ({ response: { text: a.response }, support: a.support }),
      reason: 'test-injected mapping — proves the producer never declares reveal support',
    });
    try {
      const [word] = await seedWords('word,meaning\nhelpful,有帮助的');
      await submitSpelling('sp-rev', word.id, 'helpful');
      const [event] = await db.evidenceEvents.toArray();
      const support = (event.support ?? {}) as Record<string, unknown>;
      // The binder stamps unused support kinds as explicit false — the
      // invariant is that no support flag is TRUE, not that keys are absent.
      expect(support.revealed).toBeFalsy();
      expect(support.modelAnswer).toBeFalsy();
      expect(support.hint).toBeFalsy();
    } finally {
      AUDIT.pop();
    }
  });

  it('an answer-bearing support flag can never mint independence (kernel invariant)', async () => {
    await submitAttempt(store(), testRegistry(['helpful']), {
      learnerId: LEARNER,
      taskId: taskIdFor('helpful'),
      attemptId: 'att-sup',
      occurredAt: 1_000,
      response: { text: 'helpful' },
      support: { modelAnswer: true },
    });
    const slot = (await projectFromStore()).byCapability.get(TEST_CAP);
    expect(slot?.milestones.supported).toBe(true);
    expect(slot?.milestones.independent).toBe(false);
  });
});

/* ── Scoring truth is never caller-authored (design requirement, enforced) ── */

describe('scoring-truth forgery boundary — callers may never author it', () => {
  const submission = (evaluationCtx?: Record<string, unknown>) => ({
    learnerId: LEARNER,
    taskId: taskIdFor('helpful'),
    occurredAt: 1000,
    attemptId: 'forge-1',
    response: { text: 'wrong' },
    evaluationCtx,
  });

  it('rejects a caller-supplied scoring target', async () => {
    await expect(
      submitAttempt(store(), testRegistry(['helpful']), submission({ target: 'wrong' }) as never),
    ).rejects.toThrow(/target|evaluationCtx/i);
    expect(await db.evidenceEvents.count()).toBe(0);
  });

  it('rejects a caller-supplied scoring channel outright', async () => {
    await expect(
      submitAttempt(store(), testRegistry(['helpful']), submission({ scoring: { target: 'wrong' } }) as never),
    ).rejects.toThrow();
    expect(await db.evidenceEvents.count()).toBe(0);
  });

  it('rejects caller-authored scoredAgainst provenance', async () => {
    await expect(
      submitAttempt(
        store(),
        testRegistry(['helpful']),
        { ...submission(), evaluation: { scoredAgainst: { contentId: 'x' } } } as never,
      ),
    ).rejects.toThrow(/scoredAgainst/);
    expect(await db.evidenceEvents.count()).toBe(0);
  });

  it('a deterministic contract whose evaluator abstains fails closed — no mint', async () => {
    // The abstaining case: a contract with no target fixed — the evaluator
    // returns null and the bridge refuses rather than mint outcome-less
    // evidence or fall back to a caller-claimed outcome.
    const registry = testRegistry(['abstain']);
    const task = registry.taskById(taskIdFor('abstain')) as { evaluation: Record<string, unknown> };
    delete task.evaluation.target;
    await expect(
      submitAttempt(store(), registry, {
        learnerId: LEARNER,
        taskId: taskIdFor('abstain'),
        occurredAt: 1000,
        attemptId: 'forge-2',
        response: { text: 'anything' },
      }),
    ).rejects.toThrow(/no report|refusing/i);
    expect(await db.evidenceEvents.count()).toBe(0);
  });

  it('deterministic scoring ignores the caller-claimed outcome — rating cannot launder a miss', async () => {
    await mintLexical('att-miss', 'helpful', 'helpfull', 1_000);
    const [event] = await db.evidenceEvents.toArray();
    expect(event.attempt?.outcome).toBe('fail');
    const slot = (await projectFromStore()).byCapability.get(TEST_CAP);
    expect(slot?.milestones.independent).toBe(false);
    expect(slot?.milestones.exposed).toBe(true);
  });
});

/* ── Canonical event identity (evt.<attemptId> pin — W2-02 invariant) ── */

describe('canonical event identity on the mapped path', () => {
  const AUDIT = LEGACY_CONTRACT_AUDIT as unknown as { push(e: unknown): number; pop(): unknown };

  it('event id is pinned to evt.<attemptId> — the seam derives it, the payload cannot', async () => {
    AUDIT.push({
      action: 'vocabulary:spelling',
      status: 'MAPPED_SAFE',
      authorityDomain: 'MEMORY_ITEM',
      taskId: 'task.meet.retrieval.ask_name',
      map: (a: LegacyAction) => ({ response: { text: a.response }, support: a.support }),
      reason: 'test-injected mapping — proves identity invariants on the real producer',
    });
    try {
      const [word] = await seedWords('word,meaning\nhelpful,有帮助的');
      await saveVocabularySubmission(
        { id: 'sp-ts', contentId: word.id, mode: 'spelling', answer: 'helpful', revealed: true, rating: 3 },
        db,
        999999,
      );
      const [event] = await db.evidenceEvents.toArray();
      expect(event.id).toBe('evt.sp-ts');
      expect(event.occurredAt).toBe(999999);
      expect(event.attempt?.attemptId).toBe('sp-ts');
    } finally {
      AUDIT.pop();
    }
  });
});
