import 'fake-indexeddb/auto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractOccurrences } from '@/lib/authority-guardrails/patterns';
import { useAssessmentStore } from '@/stores/assessment-store';
import type { PlanTask } from '@/stores/daily-plan-store';
import { projectLearnerState } from '@/vnext/projection';
import { db } from '../db';
import { createDexieEventStore } from './index';
import { fixtureRegistry } from './registry';
import type { EvidenceEvent } from './types';
import { createMissionSession } from './session';

/*
 * W2-G03 — placement boundary contract.
 *
 * Placement is an advisory domain: PlacementEstimate answers "where to aim
 * content", never "what the learner can do". These pins prove the boundary
 * is structural, not doc-only:
 *
 *   1. no kernel/evidence-bridge/sync source file can even NAME placement
 *      state — the W2-G01 sensitive-source pattern finds nothing;
 *   2. no placement write path can mint an EvidenceEvent;
 *   3. the capability projection of identical evidence is identical under
 *      any placement value — placement is outside its input space;
 *   4. a mission session's served task, evidence, and completion are
 *      indistinguishable under null vs C2 placement;
 *   5. legacy `{ currentLevel, history }` payloads hydrate into advisory
 *      estimates with provenance 'legacy_payload' — history preserved,
 *      nothing replayed as evidence.
 */

const LEARNER = 'learner.placement-boundary';
const PILOT_MISSION = 'mission.meet_at_a_time';
const PILOT_TASK = 'task.time.diagnostic.hear';
const T0 = Date.parse('2026-03-02T09:00:00Z');

let clock = T0;

const sessionFor = (learnerId = LEARNER) =>
  createMissionSession({
    learnerId,
    missionId: PILOT_MISSION,
    registry: fixtureRegistry(),
    store: createDexieEventStore(db.evidenceEvents),
    now: () => clock,
  });

const deliver = (s: ReturnType<typeof sessionFor>) => {
  const scr = s.screen();
  return s.confirmDelivery(scr.type === 'task' ? { taskId: scr.taskId, attemptId: scr.attemptId } : {});
};

const resetPlacementStore = () =>
  useAssessmentStore.setState({
    placement: null,
    history: [],
    dismissedReminder: false,
    reminderThreshold: 50,
  });

const localStorageData = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => localStorageData.get(k) ?? null,
  setItem: (k: string, v: string) => void localStorageData.set(k, String(v)),
  removeItem: (k: string) => void localStorageData.delete(k),
  clear: () => localStorageData.clear(),
  key: (i: number) => [...localStorageData.keys()][i] ?? null,
  get length() {
    return localStorageData.size;
  },
};

vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('window', { localStorage: localStorageMock });

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx|js)$/.test(name)) yield p;
  }
}

beforeEach(async () => {
  clock = T0;
  localStorageData.clear();
  resetPlacementStore();
  await db.evidenceEvents.clear();
});

/* ── 1. Structural impossibility: the kernel cannot name placement ── */

describe('authority surface scan', () => {
  it('no kernel, evidence-bridge, or sync source file touches placement state', () => {
    const root = join(__dirname, '..', '..');
    const offenders: string[] = [];
    for (const scope of ['vnext', 'lib/evidence-bridge', 'lib/sync']) {
      for (const abs of walk(join(root, scope))) {
        if (/\.test\.[tj]sx?$/.test(abs)) continue;
        const hits = extractOccurrences(readFileSync(abs, 'utf8'), 'assessment.currentLevel');
        for (const line of hits) offenders.push(`${abs.slice(root.length + 1)}: ${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('recurring planner, recommendations, chat tutor, and generated-content paths never read placement', () => {
    const root = join(__dirname, '..', '..');
    const files = [
      'lib/daily-plan.ts',
      'stores/daily-plan-store.ts',
      'components/dashboard/today-plan.tsx',
      'lib/learning-goals.ts',
      'hooks/use-recommendations.ts',
      'app/api/recommendations/route.ts',
      'app/api/chat/route.ts',
      'lib/chat-analytics.ts',
      'lib/chat-tool-executor.ts',
    ];
    const offenders: string[] = [];
    for (const rel of files) {
      const text = readFileSync(join(root, rel), 'utf8');
      for (const line of extractOccurrences(text, 'assessment.currentLevel')) offenders.push(`${rel}: ${line}`);
      if (/\buserLevel\b|\bcefrLevel\b/.test(text)) offenders.push(`${rel}: userLevel/cefrLevel channel`);
    }
    expect(offenders).toEqual([]);
  });

  it('ChatPanel touches the assessment store only through the claim writer', () => {
    const root = join(__dirname, '..', '..');
    const text = readFileSync(join(root, 'components/chat/chat-panel.tsx'), 'utf8');
    const storeAccesses = [...text.matchAll(/useAssessmentStore\(\s*\(\s*\w+\s*\)\s*=>\s*([^)]*)\)/g)].map((m) =>
      m[1].trim(),
    );
    expect(storeAccesses).toEqual(['s.setPlacementEstimate']);
    expect(text).not.toMatch(/\blevelEstimate\b|\bplacement\b|\bcurrentLevel\b|\bcefrToDifficulty\b/);
  });

  it('no file outside evidence-bridge can call the evidence mint seam', () => {
    const root = join(__dirname, '..', '..');
    const offenders: string[] = [];
    for (const abs of walk(join(root))) {
      const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
      if (/\.(test|spec)\.[tj]sx?$/.test(rel)) continue;
      if (rel.startsWith('lib/evidence-bridge/')) continue;
      const text = readFileSync(abs, 'utf8');
      if (/\bsubmitAttempt\b|\bsubmitObservation\b/.test(text)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});

/* ── 2. Placement writes mint zero evidence ── */

describe('placement writes never mint evidence', () => {
  it('setResult writes an advisory estimate + history and zero evidenceEvents', async () => {
    useAssessmentStore.getState().setResult({
      level: 'B1',
      score: 52,
      completedAt: T0,
      sessionsAtTest: 10,
      answers: [{ questionIndex: 0, correct: true }],
      breakdown: { vocabulary: 60, grammar: 50, reading: 46 },
    });

    const placement = useAssessmentStore.getState().placement;
    expect(placement).toMatchObject({
      levelEstimate: 'B1',
      source: 'placement_test',
      score: 52,
      completedAt: T0,
      method: 'adaptive_quiz',
      version: 1,
    });
    expect(useAssessmentStore.getState().history).toHaveLength(1);
    expect(await db.evidenceEvents.count()).toBe(0);
  });

  it('setPlacementEstimate (chat-tool claim) writes an advisory estimate and zero evidenceEvents', async () => {
    useAssessmentStore.getState().setPlacementEstimate('C1');

    const placement = useAssessmentStore.getState().placement;
    expect(placement?.source).toBe('chat_tool');
    expect(placement?.method).toBe('chat_tool');
    expect(placement?.score).toBeNull();
    expect(await db.evidenceEvents.count()).toBe(0);
  });
});

/* ── 3+4. Placement cannot alter capability authority ── */

describe('capability authority ignores placement', () => {
  const runPilotAttempt = async (learnerId: string) => {
    const s = sessionFor(learnerId);
    await s.init();
    s.start({ learnerName: 'Mai' });
    await deliver(s);
    const screen = s.screen();
    if (screen.type !== 'task' || screen.taskId !== PILOT_TASK) {
      throw new Error(`expected ${PILOT_TASK}, got ${screen.type}`);
    }
    await s.commit({ optionId: 'three' });
    return db.evidenceEvents.toArray();
  };

  it('the same evidence projects identically under null vs claimed placement', async () => {
    await runPilotAttempt(LEARNER);
    const events = await db.evidenceEvents.toArray();
    const registry = fixtureRegistry();

    resetPlacementStore();
    const withoutPlacement = projectLearnerState(
      LEARNER,
      events as never[],
      registry.capabilities as never,
      registry.tasks as never,
      {},
    );

    useAssessmentStore.getState().setPlacementEstimate('C2');
    const withPlacement = projectLearnerState(
      LEARNER,
      events as never[],
      registry.capabilities as never,
      registry.tasks as never,
      {},
    );

    expect(withPlacement).toEqual(withoutPlacement);
  });

  it('a mission session serves, evaluates, and evidences identically regardless of placement', async () => {
    const strip = (events: EvidenceEvent[]) =>
      events.map(({ occurredAt: _o, ...rest }) => rest);

    resetPlacementStore();
    const runA = strip(await runPilotAttempt(LEARNER));

    await db.evidenceEvents.clear();
    useAssessmentStore.getState().setPlacementEstimate('C2');
    const runB = strip(await runPilotAttempt(LEARNER));

    expect(runB).toEqual(runA);
    expect(runA).toHaveLength(2); // claim-bearing attempt + feedback observation
    expect(runA[0].attempt?.outcome).toBe('success');
  });
});

/* ── 5. Hydration: legacy payload → advisory estimate, history preserved ── */

describe('hydration', () => {
  const legacyResult = {
    level: 'B1' as const,
    score: 52,
    completedAt: T0 - 86_400_000,
    sessionsAtTest: 10,
    answers: [{ questionIndex: 0, correct: true }],
    breakdown: { vocabulary: 60, grammar: 50, reading: 46 },
  };

  it('a legacy { currentLevel, history } payload hydrates into a legacy_payload estimate', () => {
    localStorageData.set(
      'echotype_assessment',
      JSON.stringify({
        currentLevel: 'B1',
        history: [legacyResult],
        dismissedReminder: true,
        reminderThreshold: 80,
      }),
    );

    useAssessmentStore.getState().hydrate();
    const state = useAssessmentStore.getState();

    expect(state.placement).toMatchObject({
      levelEstimate: 'B1',
      source: 'legacy_payload',
      method: 'hydrated_legacy',
      // No inference: the bare legacy level never proved which (if any)
      // history entry produced it — a chat claim could have written it after
      // this quiz. score/completedAt stay unknown rather than borrowing the
      // colliding history entry's provenance.
      score: null,
      completedAt: 0,
      version: 1,
    });
    expect(state.history).toEqual([legacyResult]);
    expect(state.dismissedReminder).toBe(true);
    expect(state.reminderThreshold).toBe(80);
  });

  it('a legacy level with no matching history recovers honest null provenance', () => {
    localStorageData.set(
      'echotype_assessment',
      JSON.stringify({ currentLevel: 'C2', history: [legacyResult] }),
    );

    useAssessmentStore.getState().hydrate();
    const placement = useAssessmentStore.getState().placement;

    expect(placement?.levelEstimate).toBe('C2');
    expect(placement?.source).toBe('legacy_payload');
    expect(placement?.score).toBeNull();
    expect(placement?.completedAt).toBe(0);
  });

  it('the persisted payload keeps the legacy currentLevel mirror and round-trips', () => {
    useAssessmentStore.getState().setResult(legacyResult);

    const persisted = JSON.parse(localStorageData.get('echotype_assessment') ?? '{}');
    expect(persisted.currentLevel).toBe('B1');
    expect(persisted.placement?.levelEstimate).toBe('B1');

    resetPlacementStore();
    useAssessmentStore.getState().hydrate();
    const state = useAssessmentStore.getState();

    expect(state.placement?.source).toBe('placement_test');
    expect(state.placement?.score).toBe(52);
    expect(state.history).toEqual([legacyResult]);
  });

  it('hydration mints zero evidenceEvents', async () => {
    localStorageData.set(
      'echotype_assessment',
      JSON.stringify({ currentLevel: 'B2', history: [legacyResult] }),
    );

    useAssessmentStore.getState().hydrate();
    expect(useAssessmentStore.getState().placement?.levelEstimate).toBe('B2');
    expect(await db.evidenceEvents.count()).toBe(0);
  });
});

/* ── 6. Provenance cannot be forged ── */

describe('provenance integrity', () => {
  it('the claim setter always writes chat_tool provenance, even if a JS caller passes a source', () => {
    // Runtime pin: the writer takes no source parameter and hard-codes
    // provenance, so an untyped caller smuggling a second argument cannot
    // produce placement_test — quiz provenance exists only via setResult().
    const untypedSetter = useAssessmentStore.getState().setPlacementEstimate as (...args: unknown[]) => void;
    untypedSetter('C1', 'placement_test');

    expect(useAssessmentStore.getState().placement).toMatchObject({
      levelEstimate: 'C1',
      source: 'chat_tool',
      method: 'chat_tool',
      score: null,
      version: 1,
    });
    const persisted = JSON.parse(localStorageData.get('echotype_assessment') ?? '{}');
    expect(persisted.placement?.source).toBe('chat_tool');
  });

  it('a malformed persisted placement object is rejected, not trusted', () => {
    for (const bad of [
      { levelEstimate: 'B1' }, // missing provenance fields
      {
        levelEstimate: 'B1',
        source: 'placement_test',
        method: 'adaptive_quiz',
        score: null,
        completedAt: 0,
        version: 1,
      }, // score null on a claimed quiz provenance — malformed
      {
        levelEstimate: 'C9',
        source: 'chat_tool',
        method: 'chat_tool',
        score: null,
        completedAt: 1,
        version: 1,
      }, // invalid CEFR
      {
        levelEstimate: 'B1',
        source: 'legacy_payload',
        method: 'hydrated_legacy',
        score: null,
        completedAt: 1_700_000_000_000,
        version: 1,
      }, // legacy provenance claiming a known timestamp — malformed
    ]) {
      localStorageData.set('echotype_assessment', JSON.stringify({ placement: bad }));
      resetPlacementStore();
      useAssessmentStore.getState().hydrate();
      expect(useAssessmentStore.getState().placement).toBeNull();
    }
  });
});

/* ── 7. Placement cannot steer the recurring daily plan ── */

describe('daily-plan boundary', () => {
  const goal = { wordsPerDay: 10, sessionsPerDay: 4 };
  const seedContent = async () => {
    await db.contents.bulkAdd([
      {
        id: 'art-a',
        title: 'Article A',
        text: 'Sample text a',
        type: 'article',
        tags: [],
        source: 'builtin',
        difficulty: 'beginner',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'sen-b',
        title: 'Sentence B',
        text: 'Sample text b',
        type: 'sentence',
        tags: [],
        source: 'builtin',
        difficulty: 'advanced',
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
  };

  const semanticKey = (tasks: PlanTask[]) =>
    tasks
      .map((t) => `${t.type}|${t.module}|${t.bookId ?? ''}|${t.contentId ?? ''}|${t.limit ?? ''}`)
      .sort();

  it('placement A1 vs C2 yields an identical recurring plan', async () => {
    await seedContent();
    const { generateDailyPlan } = await import('@/lib/daily-plan');

    useAssessmentStore.getState().setPlacementEstimate('A1');
    const lowPlan = await generateDailyPlan(goal, { dateKey: '2026-03-12' });

    useAssessmentStore.getState().setPlacementEstimate('C2');
    const highPlan = await generateDailyPlan(goal, { dateKey: '2026-03-12' });

    expect(semanticKey(highPlan)).toEqual(semanticKey(lowPlan));
    expect(lowPlan.length).toBeGreaterThan(0);
  });

  it('generateDailyPlan exposes no placement parameter', async () => {
    const { generateDailyPlan } = await import('@/lib/daily-plan');
    // Structural pin: the recurring planner has no input channel for the
    // estimate — the option was removed, not merely left unused.
    // @ts-expect-error — levelEstimate must never steer the recurring plan
    await generateDailyPlan(goal, { levelEstimate: 'C2' });
    const plan = await generateDailyPlan(goal, { dateKey: '2026-03-12' });
    expect(Array.isArray(plan)).toBe(true);
  });
});
