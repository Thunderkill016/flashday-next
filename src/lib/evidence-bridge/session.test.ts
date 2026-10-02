import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { canonicalFamilyId, makeMission, makeTask } from '@/vnext/contracts';
import { db } from '../db';
import { createDexieEventStore, createMissionSession } from './index';
import { createRegistry, fixtureRegistry } from './registry';
import type { SessionScreen } from './session';
import type { ContractRegistry } from './types';

/*
 * Mission-session pins: the UI driver must preserve the kernel's
 * evidence semantics — deterministic attempt ids across reloads,
 * transport-confirmed stimulus before commit, support_use before commit
 * contaminating the attempt, feedback only after evidence lands,
 * exposure never minting attempts, delayed retrieval requiring the
 * policy lag.
 *
 * W2-02.6: the web surface executes only exposure + listening/audio_line/
 * choice tasks — every fixture mission now stalls on its first spoken
 * task (surface_unavailable), so driver-trajectory pins run on a
 * TEST-ONLY mission whose every task is web-servable. The contracts are
 * real kernel shape, registered through the same authoring gate.
 */

const LEARNER = 'learner.session';
const TEST_CAP = 'capability.test.listen_choice.v1';
const TEST_MISSION = 'mission.test.listen_choice.v1';
const TEST_MISSION_SPOKEN = 'mission.test.listen_choice_blocked.v1';
const T0 = Date.parse('2026-03-02T09:00:00Z');
const HOUR = 3_600_000;

let clock = T0;

const SIGNATURE = {
  cueTopology: 'audio_word_to_choice',
  setting: 'lab',
  register: 'neutral',
  channel: 'audio',
  lexicalDomain: 'test',
  responseTopology: 'mc_choice',
};

const listenTask = (id: string, purpose: string, missionId = TEST_MISSION) =>
  makeTask({
    id,
    missionId,
    capabilityId: TEST_CAP,
    modality: 'listening',
    purpose,
    promptFamily: canonicalFamilyId(TEST_CAP, SIGNATURE, 1),
    contextSignature: SIGNATURE,
    stimulus: { type: 'audio_line', languageComponents: [`stimulus for ${id}`] },
    response: {
      type: 'choice',
      requiredFunctions: ['test_listen'],
      options: [
        { id: 'yes', text: 'yes', correct: true },
        { id: 'no', text: 'no' },
      ],
    },
    evaluation: { authority: 'deterministic', contractId: 'eval.choice.correct.v1' },
    freshness: { required: false, familyClass: 'practiced' },
    supportPolicy: { allowed: ['hint', 'modelAnswer', 'transcript', 'repeat'] },
  }) as never;

const exposureTask = makeTask({
  id: 'task.test.input.listen',
  missionId: TEST_MISSION,
  capabilityId: TEST_CAP,
  modality: 'listening',
  purpose: 'input',
  promptFamily: canonicalFamilyId(TEST_CAP, SIGNATURE, 1),
  contextSignature: SIGNATURE,
  stimulus: { type: 'dialogue', languageComponents: ['Hi', 'Hello'] },
  response: { type: 'none', requiredFunctions: [] },
  freshness: { required: false, familyClass: 'practiced' },
  supportPolicy: { allowed: ['transcript', 'repeat'] },
}) as never;

const spokenTask = makeTask({
  id: 'task.test.say.unsupported',
  missionId: TEST_MISSION_SPOKEN,
  capabilityId: TEST_CAP,
  modality: 'spoken_production',
  purpose: 'retrieval',
  promptFamily: canonicalFamilyId(TEST_CAP, { ...SIGNATURE, channel: 'speech' }, 1),
  contextSignature: { ...SIGNATURE, channel: 'speech' },
  stimulus: { type: 'cued_prompt', languageComponents: ['Say it'] },
  response: { type: 'spoken_turn', requiredFunctions: ['test_say'] },
  evaluation: { authority: 'deterministic', contractId: 'eval.choice.correct.v1' },
  freshness: { required: false, familyClass: 'practiced' },
  supportPolicy: { allowed: [] },
}) as never;

const TEST_CAP_CONTRACT = {
  id: TEST_CAP,
  version: 1,
  performance: 'TEST-ONLY: understand a spoken cue and pick its meaning.',
  modality: 'listening',
  prerequisites: [],
  conditions: { partnerCooperative: false, topicFamiliar: true, supportAllowed: ['repeat'] },
  language: { chunks: [], constructions: [], vocabulary: [] },
  evidence: { independentRequired: true, delayedRequired: false, transferRequired: false },
  vietnameseRiskProbes: [],
  criteria: {
    meaningDelivered: false,
    intelligibleEnoughForPartner: false,
    requiredFunctions: [],
  },
} as never;

const testMission = (id: string, taskIds: string[]) =>
  makeMission({
    id,
    revision: 1,
    scenario: 'TEST-ONLY: hear a cue, pick its meaning.',
    learnerGoal: 'Understand spoken cues.',
    targetCapabilities: [TEST_CAP],
    language: {
      assumedKnown: { chunks: [], vocabulary: [], constructions: [] },
      introduced: { chunks: [], vocabulary: [], constructions: [] },
    },
    taskIds,
  }) as never;

/* Two TEST-ONLY missions, both registered through the same authoring
 * gate the fixtures pass:
 *
 *   MISSION A — every claim-bearing task is a web-servable listening/
 *               audio_line/choice surface, so the honest planner
 *               trajectory (baseline → expose → elicit → delayed check)
 *               is fully drivable. The capability is a target, so the
 *               gate requires diagnostic + practiced + delayed — all
 *               present; no transferPlan/assessmentPlan is declared.
 *   MISSION B — identical shell, but its only eliciting task is
 *               spoken_turn: the planner's expose fallback must serve it
 *               and the surface must fail CLOSED, minting nothing. */
const TEST_TASKS = [
  listenTask('task.test.diagnostic.hear', 'diagnostic'),
  exposureTask,
  listenTask('task.test.retrieval.hear', 'retrieval'),
  listenTask('task.test.delayed.hear', 'delayed_retrieval'),
  listenTask('task.test.diagnostic2.hear', 'diagnostic', TEST_MISSION_SPOKEN),
  spokenTask,
  listenTask('task.test.delayed2.hear', 'delayed_retrieval', TEST_MISSION_SPOKEN),
];

const MISSION_A_TASKS = TEST_TASKS.slice(0, 4).map((t) => (t as { id: string }).id);
const MISSION_B_TASKS = TEST_TASKS.slice(4).map((t) => (t as { id: string }).id);

const testRegistry = (): ContractRegistry =>
  createRegistry({
    capabilities: [TEST_CAP_CONTRACT],
    missions: [testMission(TEST_MISSION, MISSION_A_TASKS), testMission(TEST_MISSION_SPOKEN, MISSION_B_TASKS)],
    tasks: TEST_TASKS,
  });

const sessionFor = (missionId = TEST_MISSION, registry = testRegistry()) =>
  sessionForLearner(LEARNER, missionId, registry);

const sessionForLearner = (learnerId: string, missionId = TEST_MISSION, registry = testRegistry()) =>
  createMissionSession({
    learnerId,
    missionId,
    registry,
    store: createDexieEventStore(db.evidenceEvents),
    now: () => clock,
  });

const taskScreen = (s: SessionScreen) => {
  if (s.type !== 'task') throw new Error(`expected task screen, got '${s.type}'`);
  return s;
};

const inputScreen = (s: SessionScreen) => {
  if (s.type !== 'input') throw new Error(`expected input screen, got '${s.type}'`);
  return s;
};

/** Mirror the page's delivery handshake: the utterance binds the
 * taskId+attemptId its screen showed at press time, then onend calls
 * confirmDelivery with that identity. */
const deliver = (s: ReturnType<typeof sessionFor>) => {
  const scr = s.screen();
  return s.confirmDelivery(scr.type === 'task' ? { taskId: scr.taskId, attemptId: scr.attemptId } : {});
};

/** Honest interaction: hear the stimulus (transport-confirmed), then
 * pick the correct option. */
const answerCorrect = async (s: ReturnType<typeof sessionFor>) => {
  await deliver(s);
  await s.commit({ optionId: 'yes' });
};

/** Drive until the planner exhausts; returns served task ids. */
const drive = async (s: ReturnType<typeof sessionFor>) => {
  const served: string[] = [];
  const reasons: (string | null)[] = [];
  for (let i = 0; i < 40; i++) {
    const screen = s.screen();
    if (screen.type === 'summary') return { served, reasons };
    if (screen.type === 'input') {
      served.push(screen.taskId);
      reasons.push(screen.decisionReason);
      await s.view();
      continue;
    }
    if (screen.type === 'surface_unavailable') {
      served.push(`unavailable:${screen.taskId}`);
      reasons.push(screen.decisionReason);
      break; // fail-closed is terminal for this task on this surface
    }
    if (screen.type === 'task') {
      if (screen.phase === 'feedback') {
        s.next();
        continue;
      }
      served.push(screen.taskId);
      reasons.push(screen.decisionReason);
      await answerCorrect(s);
      s.next();
      continue;
    }
    break;
  }
  return { served, reasons };
};

beforeEach(async () => {
  await db.evidenceEvents.clear();
  clock = T0;
});

describe('mission session driver', () => {
  it('starts at intro, then serves the baseline diagnostic with a reason', async () => {
    const s = sessionFor();
    const intro = await s.init();
    expect(intro.type).toBe('intro');

    const screen = taskScreen(s.start());
    expect(screen.purpose).toBe('diagnostic');
    expect(screen.phase).toBe('prompt');
    expect(screen.attemptId).toMatch(/:a1$/);
    expect(screen.delivered).toBe(false);
    expect(screen.decisionReason).toBeTruthy();
  });

  it('a committed attempt lands evidence before feedback renders', async () => {
    const s = sessionFor();
    await s.init();
    s.start();
    const prompt = taskScreen(s.screen());
    await deliver(s);
    const feedback = taskScreen(await s.commit({ optionId: 'yes' }));
    expect(feedback.phase).toBe('feedback');
    expect(feedback.evaluation?.outcome).toBe('success');

    const log = s.log();
    const attempt = log.find((e) => e.attempt?.attemptId === prompt.attemptId);
    expect(attempt?.attempt?.outcome).toBe('success');
    expect(attempt?.id).toBe(`evt.${prompt.attemptId}`);
    const fb = log.find((e) => e.eventType === 'feedback');
    expect(fb?.attempt?.attemptId).toBe(prompt.attemptId);
  });

  it('a failed baseline routes to input; input mints exposure, never an outcome', async () => {
    const s = sessionFor();
    await s.init();
    s.start();
    await deliver(s);
    await s.commit({ optionId: 'no' }); // baseline miss → planner exposes
    s.next();

    const input = inputScreen(s.screen());
    expect(input.purpose).toBe('input');
    const before = s.log().length;
    await s.view();
    const gained = s.log().slice(before);
    expect(gained).toHaveLength(1);
    expect(gained[0].eventType).toBe('exposure');
    expect(gained[0].attempt?.outcome ?? null).toBeNull();
  });

  it('pre-commit support stamps the attempt: supported ≠ independent', async () => {
    const s = sessionFor();
    await s.init();
    s.start();
    await deliver(s);
    await s.commit({ optionId: 'no' }); // baseline miss → expose → input
    s.next();
    await s.view();

    const task = taskScreen(s.screen());
    expect(task.taskId).toBe('task.test.retrieval.hear');
    await deliver(s);
    await s.support('hint');
    await s.commit({ optionId: 'yes' });

    const slot = s.projection().byCapability.get(task.capabilityId);
    expect(slot?.milestones.supported).toBe(true);
    expect(slot?.milestones.independent ?? false).toBe(false);
    expect(s.log().some((e) => e.eventType === 'support_use' && e.support?.hint)).toBe(true);
  });

  it('a supported attempt re-serves the same task for an unaided retry: a2 follows a1', async () => {
    const s = sessionFor();
    await s.init();
    s.start();
    await deliver(s);
    await s.commit({ optionId: 'no' }); // baseline miss → expose → input
    s.next();
    await s.view();

    const a1 = taskScreen(s.screen());
    expect(a1.taskId).toBe('task.test.retrieval.hear');
    expect(a1.attemptId).toMatch(/:a1$/);
    await deliver(s);
    await s.support('hint');
    await s.commit({ optionId: 'yes' }); // supported success → not independent
    s.next();

    /* The planner wants an unaided attempt; the only eliciting surface
     * is the same consumed (repeatable) task — re-served under a NEW
     * deterministic attempt ordinal. */
    const a2 = taskScreen(s.screen());
    expect(a2.taskId).toBe(a1.taskId);
    expect(a2.attemptId).toMatch(/:a2$/);
    await deliver(s);
    await s.commit({ optionId: 'yes' });

    const slot = s.projection().byCapability.get(a1.capabilityId);
    expect(slot?.milestones.independent).toBe(true);
  });
});

describe('falsification', () => {
  it('reloading mid-prompt mints no evidence and re-serves the same attempt id', async () => {
    const s1 = sessionFor();
    await s1.init();
    s1.start();
    const prompt = taskScreen(s1.screen());
    const n0 = s1.log().length;

    const s2 = sessionFor();
    const intro = await s2.init();
    if (intro.type === 'intro') expect(intro.resumed).toBe(false);
    s2.start();
    const again = taskScreen(s2.screen());
    expect(again.taskId).toBe(prompt.taskId);
    expect(again.attemptId).toBe(prompt.attemptId);
    expect(s2.log().length).toBe(n0);
  });

  it('support used before a reload still contaminates the post-reload attempt', async () => {
    const s1 = sessionFor();
    await s1.init();
    s1.start();
    await deliver(s1);
    await s1.commit({ optionId: 'no' }); // baseline miss
    s1.next();
    await s1.view();
    const task = taskScreen(s1.screen());
    const attemptId = task.attemptId;
    await deliver(s1);
    await s1.support('hint');
    expect(s1.log().some((e) => e.eventType === 'support_use')).toBe(true);

    // Reload — the in-memory snapshot is gone; the committed attempt
    // must STILL stamp hint:true unioned from durable support_use rows.
    const s2 = sessionFor();
    await s2.init();
    s2.start();
    const resumed = taskScreen(s2.screen());
    expect(resumed.taskId).toBe(task.taskId);
    expect(resumed.attemptId).toBe(attemptId);

    await deliver(s2);
    await s2.commit({ optionId: 'yes' });
    const attemptEvent = s2
      .log()
      .find((e) => e.attempt?.attemptId === attemptId && e.attempt?.outcome != null);
    expect(attemptEvent?.support?.hint).toBe(true);
    const slot = s2.projection().byCapability.get(task.capabilityId);
    expect(slot?.milestones.supported).toBe(true);
    expect(slot?.milestones.independent ?? false).toBe(false);
  });

  it('a second learner inherits nothing — no resume leak, fresh attempt ids, empty state', async () => {
    const a = sessionForLearner('learner.alpha');
    await a.init();
    a.start();
    await deliver(a);
    await a.commit({ optionId: 'yes' });

    const b = sessionForLearner('learner.beta');
    const intro = await b.init();
    if (intro.type !== 'intro') throw new Error(`expected intro, got '${intro.type}'`);
    expect(intro.resumed).toBe(false);

    const screen = taskScreen(b.start());
    expect(screen.attemptId).toMatch(/:a1$/);
    for (const slot of b.projection().byCapability.values()) {
      expect(slot.state).toBe('NOT_SEEN');
    }
    expect(b.log().every((e) => e.learnerId === 'learner.beta')).toBe(true);
  });

  it('corrupted rows never crash the session nor mint credit', async () => {
    await db.evidenceEvents.add({
      id: 'corrupt~1',
      learnerId: LEARNER,
      occurredAt: clock - 1,
    } as never);
    await db.evidenceEvents.add({
      id: 'forged~1',
      learnerId: LEARNER,
      occurredAt: clock,
      eventType: 'checkpoint',
      taskId: 'task.test.retrieval.hear',
      taskRevision: 1,
      capabilityId: TEST_CAP,
      modality: 'listening',
      attempt: { attemptId: 'task.test.retrieval.hear@1:forged', outcome: 'success', observed: true },
      evaluation: { authority: 'deterministic', contractId: 'eval.choice.correct.v1' },
    } as never);

    const s = sessionFor();
    const intro = await s.init();
    expect(intro.type).toBe('intro');
    const slot = s.projection().byCapability.get(TEST_CAP);
    expect(slot?.milestones.independent ?? false).toBe(false);
    expect(['INDEPENDENT', 'RETAINED', 'TRANSFERRED', 'FLUENT']).not.toContain(slot?.state ?? 'NOT_SEEN');
  });

  it('wrong-screen controls are honest no-ops', async () => {
    const s = sessionFor();
    await s.init();
    s.start();

    const diag = taskScreen(s.screen());
    expect(diag.purpose).toBe('diagnostic');
    const n0 = s.log().length;
    await s.view(); // diagnostic is not an exposure purpose
    await s.support('hint'); // diagnostics offer no support
    expect(s.log().length).toBe(n0);

    // On an input screen: commit() must not mint an attempt.
    await deliver(s);
    await s.commit({ optionId: 'no' }); // baseline miss → expose → input
    s.next();
    const input = inputScreen(s.screen());
    const n1 = s.log().length;
    await s.commit({ optionId: 'yes' });
    expect(s.log().length).toBe(n1);
    expect(input.purpose).toBe('input');
  });

  it('concurrent identical commits dedupe; conflicting content refuses silent overwrite', async () => {
    const s = sessionFor();
    await s.init();
    s.start();
    await deliver(s);

    await Promise.all([s.commit({ optionId: 'no' }), s.commit({ optionId: 'no' })]);
    const attempts = s.log().filter((e) => e.attempt?.outcome != null);
    expect(attempts).toHaveLength(1);

    s.next();
    await s.view(); // input
    const task2 = taskScreen(s.screen());
    await deliver(s);
    const p1 = s.commit({ optionId: 'yes' });
    const p2 = s.commit({ optionId: 'no' });
    const settled = await Promise.allSettled([p1, p2]);
    const rejected = settled.filter((r) => r.status === 'rejected');
    const attempts2 = s.log().filter((e) => e.taskId === task2.taskId && e.attempt?.outcome != null);
    expect(attempts2).toHaveLength(1);
    expect(rejected.length).toBeLessThanOrEqual(1);
  });

  it('reloading during feedback never re-serves or duplicates the committed attempt', async () => {
    const s1 = sessionFor();
    await s1.init();
    s1.start();
    const task = taskScreen(s1.screen());
    await deliver(s1);
    await s1.commit({ optionId: 'yes' }); // baseline success → INDEPENDENT

    const s2 = sessionFor();
    await s2.init();
    s2.start();
    const scr = s2.screen();
    if (scr.type === 'task' && scr.phase === 'prompt') {
      expect(scr.taskId).not.toBe(task.taskId);
    }
    const attempts = s2
      .log()
      .filter((e) => e.attempt?.attemptId === task.attemptId && e.attempt?.outcome != null);
    expect(attempts).toHaveLength(1);
  });

  it('an unaided delayed check past the retention lag earns RETAINED', async () => {
    const s = sessionFor();
    await s.init();
    s.start();
    // Baseline success → INDEPENDENT; the planner then has nothing due.
    await deliver(s);
    await s.commit({ optionId: 'yes' });
    s.next();
    expect(s.screen().type).toBe('summary');

    clock += 25 * HOUR;
    const s2 = sessionFor();
    await s2.init();
    s2.start();
    const delayed = taskScreen(s2.screen());
    expect(delayed.taskId).toBe('task.test.delayed.hear');
    expect(delayed.purpose).toBe('delayed_retrieval');
    await deliver(s2);
    await s2.commit({ optionId: 'yes' });

    const slot = s2.projection().byCapability.get(TEST_CAP);
    expect(slot?.milestones.independent).toBe(true);
    expect(slot?.milestones.retained).toBe(true);
    const evt = s2.log().find((e) => e.taskId === 'task.test.delayed.hear' && e.attempt?.outcome != null);
    expect(evt?.eventType).toBe('delayed_retrieval');
  });

  it('a mission whose eliciting surface is spoken fails closed at surface_unavailable', async () => {
    const s = sessionFor(TEST_MISSION_SPOKEN);
    await s.init();
    s.start();
    const diag = taskScreen(s.screen());
    await deliver(s);
    await s.commit({ optionId: 'no' }); // baseline miss → expose intent
    s.next();

    /* The only eliciting task is spoken_turn — the planner legitimately
     * selects it, and the surface must refuse to run it. */
    const blocked = s.screen();
    expect(blocked.type).toBe('surface_unavailable');
    if (blocked.type !== 'surface_unavailable') throw new Error('unreachable');
    expect(blocked.taskId).toBe('task.test.say.unsupported');
    expect(blocked.decisionReason).toBeTruthy();

    // No channel mints evidence for an unsupported task.
    const n0 = s.log().length;
    await s.commit({ optionId: 'yes' });
    await deliver(s);
    await s.support('hint');
    await s.view();
    expect(s.log().length).toBe(n0);
    expect(s.log().filter((e) => e.taskId === 'task.test.say.unsupported')).toHaveLength(0);

    // The blocked attempt earned nothing: the capability stays untaught.
    const slot = s.projection().byCapability.get(TEST_CAP);
    expect(slot?.milestones.independent ?? false).toBe(false);
    expect(slot?.milestones.supported ?? false).toBe(false);
  });
});

describe('planner auditability on the servable surface', () => {
  it('every served step carries a planner reason — no hard-coded happy path', async () => {
    const s = sessionFor();
    await s.init();
    s.start();
    const { served, reasons } = await drive(s);
    // The honest terminal state: baseline success → INDEPENDENT → idle.
    expect(served).toContain('task.test.diagnostic.hear');
    expect(reasons.length).toBeGreaterThan(0);
    for (const r of reasons) expect(r).toBeTruthy();
  });
});
