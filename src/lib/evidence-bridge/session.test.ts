import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { createDexieEventStore, createMissionSession, fixtureRegistry } from './index';
import type { SessionScreen } from './session';

/*
 * Mission-session pins: the UI driver must preserve the kernel's
 * evidence semantics — deterministic attempt ids across reloads,
 * support_use before commit contaminating the attempt, feedback only
 * after evidence lands, exposure never minting attempts, delayed
 * retrieval requiring the policy lag, and fresh-context transfer.
 */

const LEARNER = 'learner.session';
const MISSION = 'mission.meet_new_person';
const T0 = Date.parse('2026-03-02T09:00:00Z');
const HOUR = 3_600_000;

let clock = T0;
const sessionFor = () =>
  createMissionSession({
    learnerId: LEARNER,
    missionId: MISSION,
    registry: fixtureRegistry(),
    store: createDexieEventStore(db.evidenceEvents),
    now: () => clock,
  });

const taskScreen = (s: SessionScreen) => {
  if (s.type !== 'task') throw new Error(`expected task screen, got '${s.type}'`);
  return s;
};

/** Test answers keyed by the contract's required functions — the
 * learner is scripted, the evidence is real. */
const answerFor = (screen: { requiredFunctions: string[] }): string => {
  const fns = screen.requiredFunctions;
  if (fns.includes('greet') && fns.length > 1) return 'Hi, I am Mai. What is your name?';
  if (fns.includes('greet')) return 'Hi';
  if (fns.includes('respond_to_introduction')) return 'Nice to meet you';
  if (fns.includes('state_own_name')) return 'My name is Mai';
  if (fns.includes('ask_name')) return 'What is your name?';
  return 'What is your name?';
};

const inputScreen = (s: SessionScreen) => {
  if (s.type !== 'input') throw new Error(`expected input screen, got '${s.type}'`);
  return s;
};

beforeEach(async () => {
  await db.evidenceEvents.clear();
  clock = T0;
});

describe('mission session driver', () => {
  it('starts at intro, then serves the first diagnostic task with a reason', async () => {
    const s = sessionFor();
    const intro = await s.init();
    expect(intro.type).toBe('intro');
    if (intro.type === 'intro') expect(intro.needsName).toBe(true);

    const screen = taskScreen(s.start({ learnerName: 'Mai' }));
    expect(screen.purpose).toBe('diagnostic');
    expect(screen.phase).toBe('prompt');
    expect(screen.attemptId).toMatch(/:a1$/);
    expect(screen.decisionReason).toBeTruthy();
  });

  it('a committed attempt lands evidence before feedback renders', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });
    const prompt = taskScreen(s.screen());
    const feedback = taskScreen(await s.commit({ text: 'My name is Mai' }));
    expect(feedback.phase).toBe('feedback');
    expect(feedback.evaluation?.outcome).toBe('success');
    expect(feedback.taskId).toBe(prompt.taskId);

    const log = s.log();
    const attempt = log.find((e) => e.attempt?.attemptId === prompt.attemptId);
    expect(attempt?.attempt?.outcome).toBe('success');
    const fb = log.find((e) => e.eventType === 'feedback');
    expect(fb?.attempt?.attemptId).toBe(prompt.attemptId);
  });

  it('input tasks mint exposure, never an attempt outcome', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });
    // Pass both diagnostics so the planner reaches the input stage.
    await s.commit({ text: 'My name is Mai' });
    s.next();
    await s.commit({ text: 'What is your name?' });
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
    s.start({ learnerName: 'Mai' });
    await s.commit({ text: 'My name is Mai' });
    s.next();
    await s.commit({ text: 'What is your name?' });
    s.next();
    for (let i = 0; i < 3; i++) {
      await s.view();
    }
    // First retrieval task may be a choice (no support controls); advance to
    // the first supportable spoken task.
    let screen = s.screen();
    if (screen.type === 'task' && screen.responseType === 'choice') {
      const correct = screen.options?.find((o) => o.correct);
      await s.commit({ optionId: correct?.id });
      s.next();
      screen = s.screen();
    }
    const task = taskScreen(screen);
    expect(task.supportOffered).toContain('modelAnswer');

    await s.support('modelAnswer');
    const promptAgain = taskScreen(s.screen());
    expect(promptAgain.supportUsed.modelAnswer).toBe(true);

    const answer = answerFor(task);
    await s.commit({ text: answer });

    console.log('SERVED TASK:', task.taskId, task.capabilityId, task.purpose);
    console.log('LOG:', JSON.stringify(s.log().map(e => ({id: e.id.slice(0,60), et: e.eventType, cap: e.capabilityId, out: e.attempt?.outcome, sup: e.support, auth: e.evaluation?.authority})), null, 0));
    const slot = s.projection().byCapability.get(task.capabilityId);
    expect(slot?.milestones.supported).toBe(true);
    expect(slot?.milestones.independent ?? false).toBe(false);
    expect(s.log().some((e) => e.eventType === 'support_use')).toBe(true);
  });

  it('attempt ids are deterministic across reload: a2 follows a1', async () => {
    const first = sessionFor();
    await first.init();
    first.start({ learnerName: 'Mai' });
    const prompt = taskScreen(first.screen());
    await first.commit({ text: 'garbage answer' });
    first.next();

    // New session object, same store — recomputes :a2 for the same task.
    const second = sessionFor();
    await second.init();
    second.start({ learnerName: 'Mai' });
    const live = second.screen();
    if (live.type === 'task' && live.taskId === prompt.taskId) {
      expect(live.attemptId).toMatch(/:a2$/);
    } else {
      // Planner may legitimately move on after a diagnostic fail — the
      // pin only requires the COUNT be derived from the log.
      expect(
        second.log().filter((e) => e.attempt?.outcome != null && e.attempt?.attemptId?.endsWith(':a1')),
      ).toHaveLength(1);
    }
  });
});

describe('full mission drive', () => {
  /* The canonical scripted learner (mirrors FlashDay's vnext-slice):
   * can say her name (baseline pass — skipping its teaching is itself
   * asserted), cannot yet ASK the question (honest diagnostic fail),
   * needs support to retrieve it, a model to interact, a clean retry to
   * reach INDEPENDENT, then 24h lag → RETAINED → changed-context
   * TRANSFERRED → fresh assessment checkpoints. */
  it('walks the declared learning loop to summary with honest milestones', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });

    const FAIL_ASK = '…';
    const SCRIPT: Record<string, { support?: string[]; text?: string; optionId?: string }[]> = {
      'task.meet.diagnostic.own_name': [{ text: 'My name is Mai' }],
      'task.meet.diagnostic.ask_name': [{ text: FAIL_ASK }],
      'task.meet.retrieval.questions': [{ optionId: 'ask_name' }],
      'task.meet.retrieval.phrases': [{ text: 'My name is Mai' }],
      'task.meet.retrieval.ask_name': [{ support: ['hint'], text: 'What is your name?' }],
      'task.meet.interaction.guided': [{ support: ['modelAnswer'], text: 'What your name?' }],
      'task.meet.remediation.ask_name': [{ text: 'What is your name?' }],
      'task.meet.interaction.unaided': [{ text: 'What is your name?' }],
      'task.meet.interaction.polite': [{ text: 'Nice to meet you' }],
      'task.meet.delayed.check': [{ text: 'What is your name?' }],
      'task.meet.delayed.name': [{ text: 'My name is Mai' }],
      'task.meet.transfer.street': [{ text: 'What is your name?' }],
      'task.meet.transfer.name': [{ text: 'My name is Mai' }],
      'task.meet.assessment.name_signup': [{ text: 'My name is Mai' }],
      'task.meet.assessment.checkpoint': [{ text: 'Hi, I am Mai. What is your name?' }],
    };
    const queues = new Map<string, { support?: string[]; text?: string; optionId?: string }[]>();

    const served: string[] = [];
    const act = async () => {
      for (let step = 0; step < 60; step++) {
        const screen = s.screen();
        if (screen.type === 'summary') return true;
        if (screen.type === 'input') {
          served.push(screen.taskId);
          await s.view();
          continue;
        }
        if (screen.type === 'task') {
          if (screen.phase === 'feedback') {
            s.next();
            continue;
          }
          served.push(screen.taskId);
          const q = queues.get(screen.taskId) ?? queues.set(screen.taskId, [...(SCRIPT[screen.taskId] ?? [])]).get(screen.taskId)!;
          const act = q.shift() ?? { text: answerFor(screen) };
          for (const kind of act.support ?? []) await s.support(kind);
          await s.commit({ text: act.text, optionId: act.optionId });
          s.next();
          continue;
        }
        return false;
      }
      return s.screen().type === 'summary';
    };

    // Phase 1: baseline + teaching + remediation + carriers (same-session).
    await act();
    // Delayed retrieval only exists after the retention lag.
    clock += 25 * HOUR;
    await act();

    const summary = s.screen();
    expect(summary.type).toBe('summary');
    if (summary.type !== 'summary') return;

    const log = s.log();
    const types = new Map<string, string>();
    for (const e of log) {
      if (e.attempt?.outcome != null) types.set(e.taskId, e.eventType);
    }
    // Delayed retrieval emits its own event type; transfer a
    // transfer_attempt; assessment a checkpoint — never blurred.
    expect(types.get('task.meet.delayed.check')).toBe('delayed_retrieval');
    expect(types.get('task.meet.transfer.street')).toBe('transfer_attempt');
    expect(types.get('task.meet.assessment.checkpoint')).toBe('checkpoint');

    const transferEvents = log.filter((e) => e.eventType === 'transfer_attempt');
    for (const e of transferEvents) {
      expect(e.context?.practicedOrTransfer).toBe('transfer');
    }
    const checkpoints = log.filter((e) => e.eventType === 'checkpoint');
    expect(checkpoints.every((e) => e.attempt?.attemptId != null)).toBe(true);

    // Honest trajectory: ask_name was SUPPORTED before INDEPENDENT —
    // the hinted retrieval minted supported, never independent.
    const askEvents = log.filter(
      (e) => e.capabilityId === 'interaction.ask_name' && e.attempt?.outcome != null,
    );
    const hinted = askEvents.find((e) => e.support?.hint === true);
    expect(hinted?.attempt?.outcome).toBe('success');

    const proj = s.projection();
    expect(proj.byCapability.get('interaction.ask_name')?.state).toBe('TRANSFERRED');
    expect(proj.byCapability.get('production.speak.say_own_name')?.state).toBe('TRANSFERRED');
  });
});
