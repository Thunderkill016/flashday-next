import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { canonicalFamilyId, makeTask } from '@/vnext/contracts';
import { db } from '../db';
import { submitAttempt } from './bridge';
import { createDexieEventStore } from './index';
import { fixtureRegistry } from './registry';
import {
  createMissionSession,
  type SessionScreen,
  surfaceKindForTask,
} from './session';
import type { ContractRegistry, KernelTask } from './types';

/*
 * W2-02.6 — native mission surface integrity.
 *
 * A TaskContract's modality is an EXECUTION REQUIREMENT, not descriptive
 * metadata: a surface that cannot produce the declared modality must
 * refuse the task rather than substitute another response channel. The
 * pre-gate defect: every non-choice task rendered a text input and
 * commit() minted typed text as evidence for spoken_* capabilities
 * (modality laundering), and listening choice tasks committed before any
 * auditory stimulus was delivered.
 *
 * Supported surfaces are deliberately narrow:
 *   response none + input/notice purpose            → exposure
 *   listening + audio_line stimulus + choice        → listening choice
 *   everything else                                 → unsupported
 */
const LEARNER = 'learner.surface';
const PILOT_MISSION = 'mission.meet_at_a_time';
const PILOT_TASK = 'task.time.diagnostic.hear';
const SPOKEN_TASK = 'task.time.diagnostic.say';
const CLOCK_CAP = 'reception.listen.understand_clock_time';

let clock = Date.parse('2026-03-02T09:00:00Z');

const sessionFor = (missionId = PILOT_MISSION, learnerId = LEARNER) =>
  createMissionSession({
    learnerId,
    missionId,
    registry: fixtureRegistry(),
    store: createDexieEventStore(db.evidenceEvents),
    now: () => clock,
  });

const attemptEvents = async () =>
  (await db.evidenceEvents.toArray()).filter((e) => e.attempt?.outcome != null);

beforeEach(async () => {
  clock = Date.parse('2026-03-02T09:00:00Z');
  await db.evidenceEvents.clear();
});

/* ── Surface classification — the §20 matrix over every fixture task ── */

describe('surface compatibility matrix', () => {
  it('classifies every registered task: exposure / listening-choice / unsupported', () => {
    const registry = fixtureRegistry();
    for (const task of registry.tasks) {
      const kind = surfaceKindForTask(task);
      const resp = task.response?.type;
      const stim = (task.stimulus as { type?: string } | undefined)?.type;
      if (resp === 'none' && (task.purpose === 'input' || task.purpose === 'notice')) {
        expect(kind, `${task.id}: exposure`).toBe('exposure');
      } else if (task.modality === 'listening' && stim === 'audio_line' && resp === 'choice') {
        expect(kind, `${task.id}: listening choice`).toBe('listening_choice_audio');
      } else {
        expect(kind, `${task.id}: must be unsupported`).toBe('unsupported');
      }
    }
  });

  it('no spoken_turn task is servable — the text fallback is gone', () => {
    const registry = fixtureRegistry();
    const spoken = registry.tasks.filter((t) => t.response?.type === 'spoken_turn');
    expect(spoken.length).toBeGreaterThan(0);
    for (const t of spoken) expect(surfaceKindForTask(t)).toBe('unsupported');
  });
});

/* ── The laundered path is closed ── */

describe('spoken tasks fail closed', () => {
  it('a spoken_turn task renders surface_unavailable — never a text box', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });
    // Commit the servable diagnostic first so the planner reaches 'say'.
    await s.play();
    const hear = s.screen();
    if (hear.type !== 'task' || hear.taskId !== PILOT_TASK) {
      throw new Error(`expected ${PILOT_TASK}, got ${hear.type}`);
    }
    await s.commit({ optionId: 'three' });
    s.next();

    const say = s.screen();
    expect(say.type).toBe('surface_unavailable');
    if (say.type !== 'surface_unavailable') return;
    expect(say.taskId).toBe(SPOKEN_TASK);
    expect(say.modality).toBe('spoken_production');

    // No channel can mint: not a rogue text payload, not an option.
    const n0 = (await attemptEvents()).length;
    await s.commit({ text: 'It is three o’clock' } as never);
    await s.commit({ optionId: 'three' });
    expect((await attemptEvents()).length).toBe(n0);
    expect(s.screen().type).toBe('surface_unavailable');
  });

  it('meet_new_person opens on an unservable spoken task — no demo backdoor', async () => {
    const s = sessionFor('mission.meet_new_person');
    await s.init();
    const scr = s.start({ learnerName: 'Mai' });
    expect(scr.type).toBe('surface_unavailable');
    expect(await db.evidenceEvents.count()).toBe(0);
  });
});

/* ── Listening evidence requires real auditory delivery ── */

describe('listening choice requires stimulus delivery', () => {
  const openHear = async (s: ReturnType<typeof sessionFor>) => {
    await s.init();
    const scr = s.start({ learnerName: 'Mai' });
    if (scr.type !== 'task' || scr.taskId !== PILOT_TASK) {
      throw new Error(`expected ${PILOT_TASK} prompt, got ${scr.type}`);
    }
    return scr;
  };

  it('choices are gated: commit before any delivered audio mints nothing', async () => {
    const s = sessionFor();
    const scr = await openHear(s);
    expect(scr.delivered).toBe(false);
    const before = await db.evidenceEvents.count();
    const after = await s.commit({ optionId: 'three' });
    expect(after.type).toBe('task'); // still the prompt, not feedback
    if (after.type === 'task') expect(after.phase).toBe('prompt');
    expect(await db.evidenceEvents.count()).toBe(before);
  });

  it('confirmed delivery enables exactly the canonical attempt: evt.<attemptId>', async () => {
    const s = sessionFor();
    const scr = await openHear(s);
    await s.play(); // transport-confirmed stimulus delivery
    const gated = s.screen();
    if (gated.type !== 'task') throw new Error('expected task screen');
    expect(gated.delivered).toBe(true);

    const fb = await s.commit({ optionId: 'three' });
    if (fb.type !== 'task') throw new Error('expected feedback screen');
    expect(fb.phase).toBe('feedback');
    expect(fb.evaluation?.outcome).toBe('success');

    const [attempt] = await attemptEvents();
    expect(attempt.id).toBe(`evt.${scr.attemptId}`);
    expect(attempt.attempt?.attemptId).toBe(scr.attemptId);
    expect(attempt.taskId).toBe(PILOT_TASK);
    expect(attempt.capabilityId).toBe(CLOCK_CAP);
    expect(attempt.modality).toBe('listening');
  });

  it('a wrong option mints a deterministic fail with attributed misses', async () => {
    const s = sessionFor();
    await openHear(s);
    await s.play();
    const fb = await s.commit({ optionId: 'four' });
    if (fb.type !== 'task') throw new Error('expected feedback');
    expect(fb.evaluation?.outcome).toBe('fail');
    const [attempt] = await attemptEvents();
    expect(attempt.attempt?.outcome).toBe('fail');
    expect(attempt.modality).toBe('listening');
    expect(attempt.capabilityId).toBe(CLOCK_CAP);
    const missed = (attempt.evaluation as { missingFunctions?: string[] } | undefined)?.missingFunctions;
    expect(missed).toEqual(
      expect.arrayContaining(['understand_clock_time', 'identify_spoken_number']),
    );
  });

  it('latency starts at completed delivery, not render time', async () => {
    const s = sessionFor();
    await openHear(s);
    clock += 5_000; // learner stares at the screen before pressing play
    await s.play();
    clock += 1_200; // hears it, decides, answers
    await s.commit({ optionId: 'three' });
    const [attempt] = await attemptEvents();
    expect(attempt.attempt?.latencyMs).toBe(1_200);
  });

  it('first play is stimulus delivery — never support; play #2+ is repeat support', async () => {
    const s = sessionFor();
    const scr = await openHear(s);
    await s.play();
    expect(s.log().filter((e) => e.eventType === 'support_use')).toHaveLength(0);
    await s.play();
    await s.play();
    const repeats = s.log().filter((e) => e.eventType === 'support_use' && e.support?.repeat);
    expect(repeats).toHaveLength(2);
    // The kernel unions repeatCount additively — each event contributes
    // one replay; the ordinal lives in the deterministic event id.
    expect(repeats[0].support?.repeatCount).toBe(1);
    expect(repeats[1].support?.repeatCount).toBe(1);
    expect(repeats[0].id).toContain('~sup~repeat~1');
    expect(repeats[1].id).toContain('~sup~repeat~2');
    // The committed attempt stamps the truthful union: two replays.
    await s.commit({ optionId: 'three' });
    const [attempt] = await attemptEvents();
    expect(attempt.support?.repeat).toBe(true);
    expect(attempt.support?.repeatCount).toBe(2);
    expect(scr.attemptId).toBeTruthy();
  });

  it('text input is not a response channel on a choice task', async () => {
    const s = sessionFor();
    await openHear(s);
    await s.play();
    const n0 = await db.evidenceEvents.count();
    const scr = await s.commit({ text: 'three' } as never);
    expect(scr.type).toBe('task');
    if (scr.type === 'task') expect(scr.phase).toBe('prompt');
    expect(await db.evidenceEvents.count()).toBe(n0);
  });

  it('reload resets delivery — the learner must hear it again (fail-safe)', async () => {
    const s1 = sessionFor();
    const scr = await openHear(s1);
    await s1.play();
    expect(s1.screen().type).toBe('task');

    const s2 = sessionFor();
    await s2.init();
    s2.start({ learnerName: 'Mai' });
    const again = s2.screen();
    if (again.type !== 'task') throw new Error('expected task screen after reload');
    expect(again.taskId).toBe(PILOT_TASK);
    expect(again.attemptId).toBe(scr.attemptId);
    expect(again.delivered).toBe(false);
    const n0 = await db.evidenceEvents.count();
    await s2.commit({ optionId: 'three' });
    expect(await db.evidenceEvents.count()).toBe(n0);
    await s2.play();
    await s2.commit({ optionId: 'three' });
    const attempts = await attemptEvents();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].id).toBe(`evt.${scr.attemptId}`);
  });
});

/* ── Canonical attempt identity at the bridge mint boundary ── */

describe('attempt event identity is unforgeable (§13)', () => {
  const sub = (over: Record<string, unknown>) => ({
    learnerId: LEARNER,
    taskId: PILOT_TASK,
    occurredAt: 1_000,
    attemptId: 'time-hear:a1',
    response: { optionId: 'three' },
    ...over,
  });

  it('a caller id that mismatches evt.<attemptId> is refused, not ignored', async () => {
    await expect(
      submitAttempt(createDexieEventStore(db.evidenceEvents), fixtureRegistry(), sub({ id: 'e~custom~1' })),
    ).rejects.toThrow(/canonical|evt\.|event id/i);
    expect(await db.evidenceEvents.count()).toBe(0);
  });

  it('the canonical id is accepted verbatim and also derived when omitted', async () => {
    await submitAttempt(createDexieEventStore(db.evidenceEvents), fixtureRegistry(), sub({}));
    let [e] = await db.evidenceEvents.toArray();
    expect(e.id).toBe('evt.time-hear:a1');

    await db.evidenceEvents.clear();
    await submitAttempt(
      createDexieEventStore(db.evidenceEvents),
      fixtureRegistry(),
      sub({ id: 'evt.time-hear:a1' }),
    );
    [e] = await db.evidenceEvents.toArray();
    expect(e.id).toBe('evt.time-hear:a1');
  });
});

/* ── Pilot isolation: only the contract-bound capability moves ── */

describe('pilot projection isolation (§19)', () => {
  it('a correct listening answer moves only reception.listen.understand_clock_time', async () => {
    const s = sessionFor();
    await s.init();
    s.start({ learnerName: 'Mai' });
    await s.play();
    await s.commit({ optionId: 'three' });

    const projection = s.projection();
    const slot = projection.byCapability.get(CLOCK_CAP);
    expect(slot?.milestones.independent ?? slot?.state !== 'NOT_SEEN').toBeTruthy();
    for (const other of [
      'production.speak.state_clock_time',
      'interaction.greet',
      'interaction.ask_name',
    ]) {
      const o = projection.byCapability.get(other);
      expect(o?.lastEventAt ?? null).toBeNull();
      expect(o?.state ?? 'NOT_SEEN').toBe('NOT_SEEN');
    }
    // And nothing spoken was minted anywhere.
    const events = await db.evidenceEvents.toArray();
    expect(events.every((e) => e.modality !== 'spoken_production' && e.modality !== 'spoken_interaction')).toBe(
      true,
    );
  });
});
