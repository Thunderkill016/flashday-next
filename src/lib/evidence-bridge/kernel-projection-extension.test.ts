import { describe, expect, it } from 'vitest';
import { bindAttempt, bindObservation } from '@/vnext/bind';
import { CAPABILITIES } from '@/vnext/capabilities';
import { MISSION_BUY_ITEM, TASKS_BUY_ITEM, TASKS_MEET_AT_TIME } from '@/vnext/fixtures';
import { buildLearnerModel } from '@/vnext/learner-model';
import { generateCandidates } from '@/vnext/next-for-you/candidate-generator';
import { KINDS } from '@/vnext/next-for-you/constants';
import { planNext } from '@/vnext/planner';
import { projectLearnerState } from '@/vnext/projection';

/*
 * W2-PC1 — Kernel Projection Extension regressions.
 *
 * These pins assert the POST-PC1 contract for the three constructs G04
 * proved missing. On the pre-PC1 base they FAIL for exactly the documented
 * reasons:
 *
 *   - verified_consecutive_failure: the projection/learner-model surface
 *     carries no verified-only streak, and production routing moves on a
 *     self-reported (unobserved) failure.
 *   - support_dependency: `support.dependent` mints dependency from a
 *     single aided success with zero demand-lifecycle evidence.
 *   - selection_decision_provenance: REFERENCE mode returns no decision
 *     record and no input digest.
 *
 * Once PC1 lands these are the RESOLUTION pins; the G04 audit file
 * documents the pre-PC1 behavior against its own base.
 */

// biome-ignore lint/suspicious/noExplicitAny: vendored JS kernel has no TS types
type Any = any;

const L = 'learner.pc1';
const OTHER = 'learner.pc1.other';
const T0 = Date.parse('2026-03-02T09:00:00Z');
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

const PRICE = 'reception.listen.understand_spoken_price';
const PRICE_FN = 'understand_spoken_price';
const capOf = (id: string): Any => {
  const c = (CAPABILITIES as Any[]).find((x) => x.id === id);
  if (!c) throw new Error(`capability '${id}' missing`);
  return c;
};

const taskIn =
  (tasks: Any[]) =>
  (id: string): Any => {
    const t = tasks.find((x) => x.id === id);
    if (!t) throw new Error(`task '${id}' missing`);
    return t;
  };

interface Raw {
  id: string;
  at: number;
  outcome: 'success' | 'fail' | 'partial';
  observed?: boolean;
  missing?: string[];
  support?: Record<string, unknown>;
  learner?: string;
  eventType?: string;
}

const attemptOn =
  (tasks: Any[]) =>
  (taskId: string, r: Raw): Any => {
    const t = taskIn(tasks)(taskId);
    return bindAttempt(t, capOf(t.capabilityId), {
      id: r.id,
      learnerId: r.learner ?? L,
      occurredAt: r.at,
      eventType: r.eventType,
      attempt: { observed: r.observed ?? true, outcome: r.outcome, attemptId: r.id },
      evaluation: { missingFunctions: r.missing ?? [] },
      support: r.support,
    });
  };

const price = attemptOn(TASKS_BUY_ITEM as Any[]);
const time = attemptOn(TASKS_MEET_AT_TIME as Any[]);

const model = (events: Any[], extra: Record<string, unknown> = {}) =>
  (buildLearnerModel as Any)({
    learnerId: L,
    events,
    capabilities: CAPABILITIES,
    tasks: TASKS_BUY_ITEM,
    now: T0 + 2 * DAY,
    ...extra,
  });

const priceView = (events: Any[]) => model(events).capabilities[PRICE];
const projectionSlot = (events: Any[], tasks: Any[] = TASKS_BUY_ITEM, capId = PRICE) =>
  (projectLearnerState as Any)(L, events, CAPABILITIES, tasks).byCapability.get(capId);

const taught = price('task.price.retrieval.hear', { id: 'e.taught', at: T0, outcome: 'success' });
const observedFail = (id: string, at: number) =>
  price('task.price.retrieval.hear', { id, at, outcome: 'fail' });
const unobservedFail = (id: string, at: number) =>
  price('task.price.retrieval.hear', { id, at, outcome: 'fail', observed: false });

/* ── PC1-A: verified_consecutive_failure ─────────────────────────── */

describe('PC1-A verified_consecutive_failure — named strict artifact', () => {
  it('exposes verifiedConsecutiveFailures on the projection slot and learner model', () => {
    const events = [taught, observedFail('f1', T0 + MIN)];
    const slot = projectionSlot(events);
    expect(slot.verifiedConsecutiveFailures).toBe(1);
    expect(slot.lastVerifiedObservedOutcome).toBe('fail');
    const view = priceView(events);
    expect(view.failures.verifiedConsecutiveFailures).toBe(1);
  });

  it('unobserved fails neither advance nor break the verified streak', () => {
    // fail → unobserved success → fail: the untrusted middle event is
    // invisible — it can neither reset nor extend the streak.
    const unobservedSuccess = price('task.price.retrieval.hear', {
      id: 'e.unobserved.win',
      at: T0 + 2 * MIN,
      outcome: 'success',
      observed: false,
    });
    const events = [taught, observedFail('f1', T0 + MIN), unobservedSuccess, observedFail('f2', T0 + 3 * MIN)];
    expect(projectionSlot(events).verifiedConsecutiveFailures).toBe(2);
    expect(priceView(events).failures.verifiedConsecutiveFailures).toBe(2);
    // An unobserved fail alone mints nothing.
    expect(projectionSlot([taught, unobservedFail('uf', T0 + MIN)]).verifiedConsecutiveFailures).toBe(0);
  });

  it('a stale-revision fail is unverifiable context — it cannot touch the streak', () => {
    const stale = {
      ...observedFail('stale.f', T0 + MIN),
      taskRevision: 99,
    };
    const events = [taught, stale];
    const slot = projectionSlot(events);
    expect(slot.verifiedConsecutiveFailures).toBe(0);
    expect(priceView(events).evidence.unverifiableEventCount).toBe(1);
    // And a stale SUCCESS cannot break a live streak either.
    const staleSuccess = { ...price('task.price.retrieval.hear', { id: 'ss', at: T0 + 2 * MIN, outcome: 'success' }), taskRevision: 99 };
    const live = [taught, observedFail('f1', T0 + MIN), staleSuccess, observedFail('f2', T0 + 3 * MIN)];
    expect(projectionSlot(live).verifiedConsecutiveFailures).toBe(2);
  });

  it('a foreign learner event, an exact re-delivery, and arrival order are all inert', () => {
    const foreign = observedFail('xf', T0 + MIN);
    foreign.learnerId = OTHER;
    const base = [taught, observedFail('f1', T0 + MIN), observedFail('f2', T0 + 2 * MIN)];
    const a = projectionSlot(base);
    const b = projectionSlot([foreign, base[2], base[1], base[1], base[0]]);
    expect(a.verifiedConsecutiveFailures).toBe(2);
    expect(b.verifiedConsecutiveFailures).toBe(2);
    expect(b.lastVerifiedObservedOutcome).toBe(a.lastVerifiedObservedOutcome);
  });

  it('a fake outcome on a non-attempt context event is inert', () => {
    // A 'feedback' event verifying on an INPUT task with a forged
    // observed fail outcome must not advance the streak — context is
    // not performance. bindObservation strips outcomes by construction,
    // so the counterexample is a tampered delivery: honest bind, then
    // overwrite the attempt block — it still passes verifyEventTask
    // (which does not gate attempt fields on context types).
    const inputTask = taskIn(TASKS_BUY_ITEM as Any[])('task.price.input.scene');
    const forged = (bindObservation as Any)(inputTask, capOf(inputTask.capabilityId), {
      id: 'ctx.fake',
      learnerId: L,
      occurredAt: T0 + MIN,
      eventType: 'feedback',
    });
    forged.attempt = { observed: true, outcome: 'fail', attemptId: 'ctx.fake' };
    expect(forged.eventType).toBe('feedback');
    expect(projectionSlot([taught, forged]).verifiedConsecutiveFailures).toBe(0);
    // …and a support_attempt probe carrying a fail outcome is likewise
    // remediation context on the SUPPORT cap, never a failure signal.
    const probeFail = time('task.time.support.number_probe', {
      id: 'probe.fake', at: T0 + MIN, outcome: 'fail',
    });
    expect(projectionSlot([probeFail], TASKS_MEET_AT_TIME, 'reception.listen.identify_spoken_number').verifiedConsecutiveFailures).toBe(0);
  });

  it('production planNext routes remediation on the VERIFIED streak only — a self-report cannot force a retry', () => {
    const scoped = (CAPABILITIES as Any[]).filter((c) => c.id === PRICE);
    const aided = price('task.price.retrieval.hear', {
      id: 'e.aided',
      at: T0,
      outcome: 'success',
      support: { hint: true },
    });
    const before = (planNext as Any)(L, [aided], { capabilities: scoped, tasks: TASKS_BUY_ITEM, now: T0 + 2 * MIN });
    const after = (planNext as Any)(L, [aided, unobservedFail('uf', T0 + MIN)], {
      capabilities: scoped,
      tasks: TASKS_BUY_ITEM,
      now: T0 + 2 * MIN,
    });
    expect(before.kind).toBe('independent_attempt');
    // The G04 leak is closed: an unobserved self-report cannot flip
    // production routing into remediation.
    expect(after.kind).toBe('independent_attempt');
    // …while a VERIFIED observed failure still routes remediation.
    const real = (planNext as Any)(L, [aided, observedFail('of', T0 + MIN)], {
      capabilities: scoped,
      tasks: TASKS_BUY_ITEM,
      now: T0 + 2 * MIN,
    });
    expect(real.kind).toBe('retry');
  });

  it('candidate facts carry the same verified streak the planner consumes — one derivation, no drift', () => {
    const events = [
      price('task.price.retrieval.hear', { id: 'a1', at: T0, outcome: 'success', support: { hint: true } }),
      price('task.price.retrieval.hear', { id: 'f1', at: T0 + MIN, outcome: 'fail', missing: [PRICE_FN] }),
      price('task.price.retrieval.hear', { id: 'f2', at: T0 + 2 * MIN, outcome: 'fail', missing: [PRICE_FN] }),
    ];
    const scoped = (CAPABILITIES as Any[]).filter((c) => c.id === PRICE);
    const gen = (generateCandidates as Any)({
      learnerId: L,
      events,
      capabilities: scoped,
      tasks: TASKS_BUY_ITEM,
      roles: null,
      now: T0 + 3 * MIN,
      mission: MISSION_BUY_ITEM,
    });
    const correction = gen.candidates.find((c: Any) => c.capabilityId === PRICE && c.kind === KINDS.CORRECTION);
    expect(correction?.facts?.verifiedConsecutiveFailures).toBe(2);
    expect(projectionSlot(events).verifiedConsecutiveFailures).toBe(2);
  });

  it('the raw counter is demoted — consumers can never read it as verified failure semantics', () => {
    const events = [taught, unobservedFail('uf', T0 + MIN)];
    const slot = projectionSlot(events);
    // The legacy field aliases the verified streak — the loose
    // "unobserved outcomes count" semantics is gone for good.
    expect(slot.consecutiveFailures).toBe(slot.verifiedConsecutiveFailures);
    expect(slot.consecutiveFailures).toBe(0);
  });
});
