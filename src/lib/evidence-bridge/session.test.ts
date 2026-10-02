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
const sessionFor = () => sessionForLearner(LEARNER);

const sessionForLearner = (learnerId: string) =>
  createMissionSession({
    learnerId,
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

/* Canonical scripted learner (mirrors FlashDay's vnext-slice): passes
 * the own-name baseline, honestly fails ask_name at diagnostic, needs a
 * hint to retrieve it, a model for guided interaction, a clean retry to
 * reach INDEPENDENT, then +25h → RETAINED → changed-context TRANSFERRED
 * → fresh assessment checkpoints. */
const SCRIPT: Record<string, { support?: string[]; text?: string; optionId?: string }[]> = {
  'task.meet.diagnostic.own_name': [{ text: 'My name is Mai' }],
  'task.meet.diagnostic.ask_name': [{ text: '…' }],
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

/** Drive the scripted learner until the selector exhausts; returns the
 * served task ids and every rendered decision reason. */
const scriptedDrive = async (s: ReturnType<typeof sessionFor>) => {
  const served: string[] = [];
  const reasons: (string | null)[] = [];
  const queues = new Map<string, { support?: string[]; text?: string; optionId?: string }[]>();
  for (let step = 0; step < 60; step++) {
    const screen = s.screen();
    if (screen.type === 'summary') return { served, reasons };
    if (screen.type === 'input') {
      served.push(screen.taskId);
      reasons.push(screen.decisionReason);
      await s.view();
      continue;
    }
    if (screen.type === 'task') {
      if (screen.phase === 'feedback') {
        s.next();
        continue;
      }
      served.push(screen.taskId);
      reasons.push(screen.decisionReason);
      const q =
        queues.get(screen.taskId) ??
        queues.set(screen.taskId, [...(SCRIPT[screen.taskId] ?? [])]).get(screen.taskId)!;
      const act = q.shift() ?? { text: answerFor(screen) };
      for (const kind of act.support ?? []) await s.support(kind);
      await s.commit({ text: act.text, optionId: act.optionId });
      s.next();
      continue;
    }
    return { served, reasons };
  }
  return { served, reasons };
};

/** Reach the first supportable (non-choice) task of the canonical path:
 * both diagnostics + exposure views + the choice-check if served first. */
const advanceToSupportableTask = async (s: ReturnType<typeof sessionFor>) => {
  await s.commit({ text: 'My name is Mai' });
  s.next();
  await s.commit({ text: '…' });
  s.next();
  for (let i = 0; i < 3; i++) await s.view();
  let screen = s.screen();
  if (screen.type === 'task' && screen.responseType === 'choice') {
    const correct = screen.options?.find((o) => o.correct);
    await s.commit({ optionId: correct?.id });
    s.next();
    screen = s.screen();
  }
  return taskScreen(screen);
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
    const task = await advanceToSupportableTask(s);
    expect(task.supportOffered).toContain('modelAnswer');

    await s.support('modelAnswer');
    const promptAgain = taskScreen(s.screen());
    expect(promptAgain.supportUsed.modelAnswer).toBe(true);

    const answer = answerFor(task);
    await s.commit({ text: answer });

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

describe('falsification', () => {
  it('reloading mid-prompt mints no evidence and re-serves the same attempt id', async () => {
    const s1 = sessionFor();
    await s1.init();
    s1.start({ learnerName: 'Mai' });
    const prompt = taskScreen(s1.screen());
    const n0 = s1.log().length;

    // Reload before any commit — a fresh session re-derives the same
    // attempt identity and must not have minted anything.
    const s2 = sessionFor();
    const intro = await s2.init();
    if (intro.type === 'intro') expect(intro.resumed).toBe(false);
    s2.start({ learnerName: 'Mai' });
    const again = taskScreen(s2.screen());
    expect(again.taskId).toBe(prompt.taskId);
    expect(again.attemptId).toBe(prompt.attemptId);
    expect(s2.log().length).toBe(n0);
  });

  it('support used before a reload still contaminates the post-reload attempt', async () => {
    const s1 = sessionFor();
    await s1.init();
    s1.start({ learnerName: 'Mai' });
    const task = await advanceToSupportableTask(s1);
    const attemptId = task.attemptId;
    await s1.support('hint');
    expect(s1.log().some((e) => e.eventType === 'support_use')).toBe(true);

    // Reload — the in-memory support snapshot is gone; the attempt that
    // now commits must STILL be stamped hint:true (unioned from the
    // durable support_use evidence), or the stamp lies.
    const s2 = sessionFor();
    await s2.init();
    s2.start({ learnerName: 'Mai' });
    const resumed = taskScreen(s2.screen());
    expect(resumed.taskId).toBe(task.taskId);
    expect(resumed.attemptId).toBe(attemptId);

    await s2.commit({ text: answerFor(resumed) });
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
    a.start({ learnerName: 'Mai' });
    await a.commit({ text: 'My name is Mai' });

    const b = sessionForLearner('learner.beta');
    const intro = await b.init();
    if (intro.type !== 'intro') throw new Error(`expected intro, got '${intro.type}'`);
    expect(intro.resumed).toBe(false);

    const screen = taskScreen(b.start({ learnerName: 'Bảo' }));
    expect(screen.attemptId).toMatch(/:a1$/);
    for (const slot of b.projection().byCapability.values()) {
      expect(slot.state).toBe('NOT_SEEN');
    }
    expect(b.log().every((e) => e.learnerId === 'learner.beta')).toBe(true);
  });

  it('corrupted rows never crash the session nor mint credit', async () => {
    // A shapeless row and a forged success with wrong semantics — both
    // injected directly, bypassing the bridge.
    // Cast past the EvidenceEvent type — the whole point is that these
    // rows could NOT have been produced by the bridge.
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
      taskId: 'task.meet.remediation.ask_name',
      taskRevision: 1,
      capabilityId: 'interaction.ask_name',
      modality: 'speaking',
      attempt: { attemptId: 'task.meet.remediation.ask_name@1:forged', outcome: 'success', observed: true },
      evaluation: { authority: 'deterministic', contractId: 'eval.intro.ask_name' },
    } as never);

    const s = sessionFor();
    const intro = await s.init();
    expect(intro.type).toBe('intro');
    // A forged event failing verifyEventTask can mark SUPPORTED at most —
    // never INDEPENDENT or beyond.
    const slot = s.projection().byCapability.get('interaction.ask_name');
    expect(slot?.milestones.independent ?? false).toBe(false);
    expect(['INDEPENDENT', 'RETAINED', 'TRANSFERRED', 'FLUENT']).not.toContain(slot?.state ?? 'NOT_SEEN');
  });

  it('wrong-screen controls are honest no-ops', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });

    // On a diagnostic task screen: view() is not an exposure purpose and
    // support is not offered — neither may mint evidence.
    const diag = taskScreen(s.screen());
    expect(diag.purpose).toBe('diagnostic');
    const n0 = s.log().length;
    await s.view();
    await s.support('hint');
    expect(s.log().length).toBe(n0);

    // On an input screen: commit() must not mint an attempt.
    await s.commit({ text: 'My name is Mai' });
    s.next();
    await s.commit({ text: '…' });
    s.next();
    const input = inputScreen(s.screen());
    const n1 = s.log().length;
    await s.commit({ text: 'What is your name?' });
    expect(s.log().length).toBe(n1);
    expect(input.purpose).toBe('input');
  });

  it('concurrent identical commits dedupe; conflicting content refuses silent overwrite', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });

    // Same response twice in flight — one logical commit, one event set.
    await Promise.all([s.commit({ text: 'My name is Mai' }), s.commit({ text: 'My name is Mai' })]);
    const attempts = s.log().filter((e) => e.attempt?.outcome != null);
    expect(attempts).toHaveLength(1);

    // A commit still queued from the prompt phase with DIFFERENT content
    // must not overwrite the landed evidence — the store throws and the
    // session stays honest on the landed feedback.
    s.next();
    const task2 = taskScreen(s.screen());
    const p1 = s.commit({ text: '…' });
    const p2 = s.commit({ text: 'totally different answer' });
    const settled = await Promise.allSettled([p1, p2]);
    const rejected = settled.filter((r) => r.status === 'rejected');
    const attempts2 = s.log().filter(
      (e) => e.taskId === task2.taskId && e.attempt?.outcome != null,
    );
    // Exactly one attempt may land; a conflict throws rather than
    // silently replacing the first writer's evidence.
    expect(attempts2).toHaveLength(1);
    expect(attempts2[0].attempt?.outcome).toBe('fail');
    expect(rejected.length).toBeLessThanOrEqual(1);
  });

  it('reloading during feedback never re-serves or duplicates the committed attempt', async () => {
    const s1 = sessionFor();
    await s1.init();
    s1.start({ learnerName: 'Mai' });
    const task = taskScreen(s1.screen());
    await s1.commit({ text: answerFor(task) }); // now in feedback phase

    const s2 = sessionFor();
    await s2.init();
    s2.start({ learnerName: 'Mai' });
    const scr = s2.screen();
    if (scr.type === 'task' && scr.phase === 'prompt') {
      expect(scr.taskId).not.toBe(task.taskId);
    }
    const attempts = s2.log().filter((e) => e.attempt?.attemptId === task.attemptId && e.attempt?.outcome != null);
    expect(attempts).toHaveLength(1);
  });

  it('no checkpoint or TRANSFERRED exists before delayed+transfer evidence lands', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });

    // Phase 1 only — everything before the retention lag.
    await scriptedDrive(s);
    const log1 = s.log();
    expect(log1.filter((e) => e.eventType === 'checkpoint')).toHaveLength(0);
    expect(log1.filter((e) => e.eventType === 'delayed_retrieval')).toHaveLength(0);
    expect(log1.filter((e) => e.eventType === 'transfer_attempt')).toHaveLength(0);
    for (const slot of s.projection().byCapability.values()) {
      expect(slot.milestones.retained ?? false).toBe(false);
      expect(slot.milestones.transferred ?? false).toBe(false);
    }

    clock += 25 * HOUR;
    await scriptedDrive(s);
    expect(s.log().filter((e) => e.eventType === 'checkpoint').length).toBeGreaterThanOrEqual(1);
  });

  it('the summary is replay-derived: a fresh session reproduces identical states', async () => {
    const s1 = sessionFor();
    await s1.init();
    s1.start({ learnerName: 'Mai' });
    await scriptedDrive(s1);
    clock += 25 * HOUR;
    await scriptedDrive(s1);
    const sum1 = s1.screen();
    if (sum1.type !== 'summary') throw new Error('expected summary');

    // Brand-new session object — zero in-memory state; the summary must
    // come entirely from the replayed log.
    const s2 = sessionFor();
    await s2.init();
    s2.start({ learnerName: 'Mai' });
    const sum2 = s2.screen();
    if (sum2.type !== 'summary') throw new Error('expected summary after reload');
    expect(sum2.progress).toEqual(sum1.progress);
  });

  it('every served step carries a planner reason — no hard-coded happy path', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });
    await scriptedDrive(s);
    clock += 25 * HOUR;
    const { reasons } = await scriptedDrive(s);
    expect(reasons.length).toBeGreaterThan(0);
    for (const r of reasons) expect(r).toBeTruthy();
  });
});

describe('speech capture provenance (FDN-SPEECH-001)', () => {
  const asr = (provider: string, confidence: number | null = null) => ({
    mode: 'speech' as const,
    authority: 'asr' as const,
    provider,
    final: true,
    confidence,
  });
  const direct = { mode: 'text' as const, authority: 'direct' as const, final: true };

  it('spoken_turn tasks surface the speech channel in the screen contract', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });
    const scr = taskScreen(s.screen());
    expect(scr.responseType).toBe('spoken_turn');
  });

  it('an ASR transcript still goes through the deterministic evaluator — success and misses both land', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });
    const scr = taskScreen(s.screen());

    const fb = await s.commit({ text: 'My name is Mai', capture: asr('web-speech', 0.91) });
    const scored = taskScreen(fb);
    expect(scored.evaluation?.outcome).toBe('success');

    // A transcript missing the required function fails honestly — ASR
    // changes the channel, never the scoring. (Free-text scoring cannot
    // attribute the miss to a substrate — `missed` is the observable.)
    s.next();
    const fb2 = await s.commit({ text: 'banana', capture: asr('web-speech') });
    const scored2 = taskScreen(fb2);
    expect(scored2.evaluation?.outcome).toBe('fail');
    expect(scored2.evaluation?.missed).toContain('ask_name');
    const failed = s.log().find((e) => e.attempt?.outcome === 'fail');
    expect(failed?.attempt?.capture?.authority).toBe('asr');
  });

  it('ASR-captured success mints SUPPORTED at most — never INDEPENDENT/RETAINED/TRANSFERRED', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });

    // Drive the canonical path entirely over the ASR channel.
    const queues = new Map<string, { support?: string[]; text?: string; optionId?: string }[]>();
    for (let step = 0; step < 80; step++) {
      const screen = s.screen();
      if (screen.type === 'summary') break;
      if (screen.type === 'input') {
        await s.view();
        continue;
      }
      if (screen.type !== 'task') break;
      if (screen.phase === 'feedback') {
        s.next();
        continue;
      }
      const q =
        queues.get(screen.taskId) ??
        queues.set(screen.taskId, [...(SCRIPT[screen.taskId] ?? [])]).get(screen.taskId)!;
      const act = q.shift() ?? { text: answerFor(screen) };
      for (const kind of act.support ?? []) await s.support(kind);
      const capture =
        screen.responseType === 'choice' ? undefined : asr(screen.taskId.includes('delayed') ? 'groq' : 'web-speech');
      await s.commit({ text: act.text, optionId: act.optionId, capture });
      s.next();
    }
    clock += 25 * HOUR;
    // Keep answering over ASR after the retention lag too.
    for (let step = 0; step < 80; step++) {
      const screen = s.screen();
      if (screen.type === 'summary') break;
      if (screen.type === 'input') {
        await s.view();
        continue;
      }
      if (screen.type !== 'task') break;
      if (screen.phase === 'feedback') {
        s.next();
        continue;
      }
      const q = queues.get(screen.taskId);
      const act = q?.shift() ?? { text: answerFor(screen) };
      await s.commit({ text: act.text, capture: asr('web-speech') });
      s.next();
    }

    const proj = s.projection();
    for (const [capId, slot] of proj.byCapability) {
      expect(slot.milestones.independent ?? false, capId).toBe(false);
      expect(slot.milestones.retained ?? false, capId).toBe(false);
      expect(slot.milestones.transferred ?? false, capId).toBe(false);
    }
    // …while asr successes on non-transfer tasks still mint SUPPORTED —
    // the channel is recorded, the credit is capped, not erased.
    const nameSlot = proj.byCapability.get('production.speak.say_own_name');
    expect(nameSlot?.milestones.supported ?? false).toBe(true);
    expect(nameSlot?.state).toBe('SUPPORTED');
  });

  it('the typed control path keeps minting independent credit — the ASR gate is channel-scoped', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });
    const scr = taskScreen(s.screen());
    await s.commit({ text: 'My name is Mai', capture: direct });
    const proj = s.projection();
    expect(proj.byCapability.get(scr.capabilityId)?.milestones.independent).toBe(true);
  });

  it('an interim (non-final) ASR transcript can never commit', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });
    const n0 = s.log().length;
    await expect(
      s.commit({ text: 'My name is Mai', capture: { ...asr('web-speech'), final: false } }),
    ).rejects.toThrow(/final/);
    expect(s.log().length).toBe(n0);
  });

  it('unknown capture authorities and malformed provenance are refused', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });
    await expect(
      s.commit({
        text: 'My name is Mai',
        capture: { mode: 'speech', authority: 'human' as never, final: true },
      }),
    ).rejects.toThrow(/authority/);
    await expect(
      s.commit({
        text: 'My name is Mai',
        capture: { mode: 'pigeon' as never, authority: 'asr', final: true },
      }),
    ).rejects.toThrow(/mode/);
  });

  it('capture provenance — including provider — survives persistence and reload', async () => {
    const s1 = sessionFor();
    await s1.init();
    s1.start({ learnerName: 'Mai' });
    await s1.commit({ text: 'My name is Mai', capture: asr('groq', 0.83) });

    // Fresh session over the same table — replay must carry capture.
    const s2 = sessionFor();
    await s2.init();
    const ev = s2.log().find((e) => e.attempt?.outcome != null);
    expect(ev?.attempt?.capture).toEqual({
      mode: 'speech',
      authority: 'asr',
      provider: 'groq',
      final: true,
      confidence: 0.83,
    });
  });

  it('a refresh during recording mints nothing — only committed finals land', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });
    const before = s.log().length;
    // "Recording" means the learner hasn't committed — a reload here is
    // a fresh session whose log is identical.
    const s2 = sessionFor();
    await s2.init();
    s2.start({ learnerName: 'Mai' });
    expect(s2.log().length).toBe(before);
  });
});

describe('full mission drive', () => {
  it('walks the declared learning loop to summary with honest milestones', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });

    // Phase 1: baseline + teaching + remediation + carriers (same-session).
    await scriptedDrive(s);
    // Delayed retrieval only exists after the retention lag.
    clock += 25 * HOUR;
    await scriptedDrive(s);

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
