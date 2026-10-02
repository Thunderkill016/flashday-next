import { describe, expect, it } from 'vitest';
import { bindAttempt } from '@/vnext/bind';
import { CAPABILITIES } from '@/vnext/capabilities';
import {
  deriveCorrectionEpisodes,
  episodeDigest,
  pickRetestSurface,
  retestSurfaces,
} from '@/vnext/correction-episodes';
import { MISSION_BUY_ITEM, MISSION_MEET_AT_TIME, TASKS_BUY_ITEM, TASKS_MEET_AT_TIME } from '@/vnext/fixtures';
import { buildLearnerModel } from '@/vnext/learner-model';
import { decisionAuditRecord, SELECTION_MODES, selectNextTask } from '@/vnext/next-for-you/selector';
import { deriveTaskConsumption } from '@/vnext/next-for-you/task-resolver';
import { deriveSupportLifecycle, planNext } from '@/vnext/planner';
import { projectLearnerState } from '@/vnext/projection';

/*
 * W2-G04 — Projection Coverage Audit regressions.
 *
 * AUDIT ONLY: nothing here changes runtime behavior. Each block pins how
 * an existing kernel artifact behaves TODAY so the coverage table in
 * docs/flashday/W2_03_G04_PROJECTION_COVERAGE.md is backed by executable
 * evidence inside this repo (the vendored kernel's upstream suites live in
 * FlashDay @85ce4101 and are not part of this repo's gate).
 *
 * PRESENT rows prove the construct's semantics. The three rows G04 found
 * MISSING (verified_consecutive_failure, support_dependency,
 * selection_decision_provenance) were resolved by W2-PC1 — the blocks
 * below assert the post-PC1 resolution semantics on this base, not the
 * pre-PC1 gap behavior.
 */

// biome-ignore lint/suspicious/noExplicitAny: vendored JS kernel has no TS types
type Any = any;

const L = 'learner.g04';
const OTHER = 'learner.g04.other';
const T0 = Date.parse('2026-03-02T09:00:00Z');
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

const PRICE = 'reception.listen.understand_spoken_price';
const PRICE_FN = 'understand_spoken_price';
const NUMBER_FN = 'identify_spoken_number';

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

const projectionSlot = (events: Any[]) =>
  (projectLearnerState as Any)(L, events, CAPABILITIES, TASKS_BUY_ITEM).byCapability.get(PRICE);

const observedStreak = (events: Any[]) => {
  const taskByRev = new Map((TASKS_BUY_ITEM as Any[]).map((t) => [`${t.id}@${t.revision}`, t]));
  return (deriveTaskConsumption as Any)({ learnerId: L, events, capabilities: CAPABILITIES, taskByRev })
    .observedFailStreak.get(PRICE) ?? 0;
};

const episodes = (events: Any[], now = T0 + 2 * DAY) =>
  (deriveCorrectionEpisodes as Any)({
    learnerId: L,
    events,
    capabilities: CAPABILITIES,
    tasks: TASKS_BUY_ITEM,
    now,
  });

const taught = price('task.price.retrieval.hear', { id: 'e.taught', at: T0, outcome: 'success' });

/* ── capability_state / capability_milestones ─────────────────────── */

describe('G04 capability_state + milestones — PRESENT', () => {
  it('state is learner-isolated, arrival-order independent, and duplicate-safe', () => {
    const mine = [
      taught,
      price('task.price.delayed.hear', { id: 'e.delayed', at: T0 + DAY + MIN, outcome: 'success' }),
    ];
    const foreign = price('task.price.retrieval.hear', {
      id: 'e.foreign',
      at: T0 + 5 * MIN,
      outcome: 'fail',
      learner: OTHER,
    });
    const a = projectionSlot([...mine, foreign]);
    const b = projectionSlot([foreign, mine[1], mine[0], mine[0]]);
    expect(a).toEqual(b);
    expect(a.state).toBe('RETAINED');
    expect(a.consecutiveFailures).toBe(0);
  });

  it('an unobserved success cannot mint INDEPENDENT', () => {
    const slot = projectionSlot([
      price('task.price.retrieval.hear', { id: 'e.self', at: T0, outcome: 'success', observed: false }),
    ]);
    expect(slot.milestones.independent).toBe(false);
    expect(slot.state).toBe('SUPPORTED');
  });
});

/* ── verified_consecutive_failure — PRESENT (resolved by W2-PC1) ──── */

describe('G04 verified_consecutive_failure — PRESENT (PC1 resolution)', () => {
  const unobservedFail = price('task.price.retrieval.hear', {
    id: 'e.unobserved.fail',
    at: T0 + MIN,
    outcome: 'fail',
    observed: false,
  });

  it('an UNOBSERVED fail is invisible to the verified streak on every surface', () => {
    const events = [taught, unobservedFail];
    const slot = projectionSlot(events);
    const view = priceView(events);
    /* PC1: the named artifact — and the legacy alias can never drift
     * from it because the loose counter was removed. */
    expect(slot.verifiedConsecutiveFailures).toBe(0);
    expect(slot.consecutiveFailures).toBe(0);
    expect(view.failures.verifiedConsecutiveFailures).toBe(0);
    expect(view.failures.consecutiveFailures).toBe(0);
    // No consumer label can be minted from an unverified outcome.
    expect(model(events).profile.fragile).not.toContain(PRICE);
    expect(view.uncertainty.reasons.map((r: Any) => r.code)).not.toContain('currently_failing');
    // The next-for-you stream IS the same derivation — no divergence.
    expect(observedStreak(events)).toBe(0);
    expect(observedStreak(events)).toBe(slot.verifiedConsecutiveFailures);
  });

  it('a stale-revision fail is unverifiable context — the verified streak never sees it', () => {
    const stale = { ...unobservedFail, id: 'e.stale.fail', taskRevision: 99, attempt: { ...unobservedFail.attempt, observed: true } };
    const slot = projectionSlot([taught, stale]);
    expect(slot.verifiedConsecutiveFailures).toBe(0);
    expect(slot.consecutiveFailures).toBe(0);
    expect(priceView([taught, stale]).evidence.unverifiableEventCount).toBe(1);
    expect(observedStreak([taught, stale])).toBe(0);
  });

  it('production REFERENCE routing ignores a self-reported fail; a verified fail still remediates', () => {
    const scoped = (CAPABILITIES as Any[]).filter((c) => c.id === PRICE);
    const aided = price('task.price.retrieval.hear', {
      id: 'e.aided',
      at: T0,
      outcome: 'success',
      support: { hint: true },
    });
    const before = (planNext as Any)(L, [aided], { capabilities: scoped, tasks: TASKS_BUY_ITEM, now: T0 + 2 * MIN });
    const after = (planNext as Any)(L, [aided, unobservedFail], {
      capabilities: scoped,
      tasks: TASKS_BUY_ITEM,
      now: T0 + 2 * MIN,
    });
    expect(before.kind).toBe('independent_attempt');
    // PC1 resolution: the G04 flip is closed — a self-report cannot
    // force remediation; a VERIFIED observed fail still can.
    expect(after.kind).toBe('independent_attempt');
    const real = (planNext as Any)(L, [aided, price('task.price.retrieval.hear', {
      id: 'e.real.fail', at: T0 + MIN, outcome: 'fail',
    })], {
      capabilities: scoped,
      tasks: TASKS_BUY_ITEM,
      now: T0 + 2 * MIN,
    });
    expect(real.kind).toBe('retry');
  });
});

/* ── function_gap_ledger — PRESENT / recurring_error — PRESENT ────── */

describe('G04 function_gap_ledger — PRESENT', () => {
  it('only an observed miss under an attributing contract opens a gap; independent recovery closes it', () => {
    const miss = price('task.price.retrieval.hear', { id: 'e.miss', at: T0 + MIN, outcome: 'fail', missing: [PRICE_FN] });
    const unobs = price('task.price.retrieval.hear', {
      id: 'e.miss.unobs',
      at: T0 + MIN,
      outcome: 'fail',
      observed: false,
      missing: [PRICE_FN],
    });
    const recover = price('task.price.retrieval.hear', { id: 'e.recover', at: T0 + 2 * MIN, outcome: 'success' });

    expect(priceView([taught, unobs]).failures.unresolvedFunctions).toEqual([]);
    expect(priceView([taught, miss]).failures.unresolvedFunctions).toEqual([PRICE_FN]);
    expect(priceView([taught, miss, recover]).failures.unresolvedFunctions).toEqual([]);
    expect(priceView([taught, miss, recover]).failures.resolvedFunctions).toEqual([PRICE_FN]);
  });

  it('a success on a task that never exercised the function does not resolve it', () => {
    const miss = price('task.price.remediation.hear', { id: 'e.num.miss', at: T0 + MIN, outcome: 'fail', missing: [NUMBER_FN] });
    const unrelated = price('task.price.retrieval.hear', { id: 'e.unrelated', at: T0 + 2 * MIN, outcome: 'success' });
    expect(priceView([taught, miss, unrelated]).failures.unresolvedFunctions).toEqual([NUMBER_FN]);
  });
});

describe('G04 recurring_error — PRESENT via episode RELAPSED; recurringFunctions is NOT the authority', () => {
  const miss = (id: string, at: number) =>
    price('task.price.retrieval.hear', { id, at, outcome: 'fail', missing: [PRICE_FN] });
  const win = (id: string, at: number) => price('task.price.retrieval.hear', { id, at, outcome: 'success' });

  it('learner-model recurringFunctions is a looser signal: two back-to-back misses with no recovery are flagged "recurring" (repeated failure ≠ recurrence)', () => {
    const view = priceView([taught, miss('m1', T0 + MIN), miss('m2', T0 + 2 * MIN)]);
    expect(view.failures.recurringFunctions).toEqual([PRICE_FN]);
  });

  it('recurringFunctions cannot distinguish a true miss→recover→miss relapse from plain repetition', () => {
    const repeated = priceView([taught, miss('m1', T0 + MIN), miss('m2', T0 + 2 * MIN)]).failures;
    const relapse = priceView([taught, miss('m1', T0 + MIN), win('w1', T0 + 2 * MIN), miss('m2', T0 + 3 * MIN)]).failures;
    expect(relapse.recurringFunctions).toEqual(repeated.recurringFunctions);
    expect(relapse.unresolvedFunctions).toEqual(repeated.unresolvedFunctions);
  });

  it('recurringFunctions never decays — a healed function stays "recurring" forever (consumers must use episode relapseCount instead)', () => {
    const view = priceView([
      taught,
      miss('m1', T0 + MIN),
      win('w1', T0 + 2 * MIN),
      miss('m2', T0 + 3 * MIN),
      win('w2', T0 + 4 * MIN),
      price('task.price.delayed.hear', { id: 'w3', at: T0 + 30 * DAY, outcome: 'success' }),
    ]);
    expect(view.failures.unresolvedFunctions).toEqual([]);
    expect(view.failures.recurringFunctions).toEqual([PRICE_FN]);
  });
});

/* ── support_dependency — PRESENT (resolved by W2-PC1) / support_demand_lifecycle — PRESENT ── */

describe('G04 support_dependency — PRESENT (PC1 resolution)', () => {
  it('a single aided success is usage, not dependency — zero demand evidence means no dependent state', () => {
    const once = [price('task.price.retrieval.hear', { id: 'a1', at: T0, outcome: 'success', support: { hint: true } })];
    const view = priceView(once);
    /* PC1: the G04 trap is closed — `dependent` aliases the strict
     * dependency state, which requires a demanded function still
     * lacking independent covering recovery. Without mission roles the
     * demand lifecycle is unmodeled, so the honest state is UNMODELED. */
    expect(view.support.dependency.state).toBe('UNMODELED');
    expect(view.support.dependency.demandedFunctions).toEqual([]);
    expect(view.support.dependency.dependentFunctions).toEqual([]);
    expect(view.support.dependent).toBe(false);
    expect(view.support.servedEpisodes).toBe(0);
    expect(view.support.pendingFunctions).toEqual([]);
  });

  it('with roles but no attributed demand, supported work is CLEAR — not DEPENDENT', () => {
    const roles = {
      targets: new Set(MISSION_MEET_AT_TIME.targetCapabilities),
      supports: new Set(MISSION_MEET_AT_TIME.supportCapabilities),
      prereqs: new Set(MISSION_MEET_AT_TIME.prerequisiteCapabilities ?? []),
    };
    const events = [
      time('task.time.retrieval.hear', { id: 'a1', at: T0, outcome: 'success', support: { hint: true } }),
      time('task.time.retrieval.hear', { id: 'a2', at: T0 + MIN, outcome: 'success', support: { hint: true } }),
    ];
    const view = (buildLearnerModel as Any)({
      learnerId: L, events, capabilities: CAPABILITIES, tasks: TASKS_MEET_AT_TIME, roles, now: T0 + 2 * DAY,
    }).capabilities['reception.listen.understand_clock_time'];
    expect(view.support.dependency.state).toBe('CLEAR');
    expect(view.support.dependent).toBe(false);
  });
});

describe('G04 support_demand_lifecycle — PRESENT', () => {
  const roles = {
    targets: new Set(MISSION_MEET_AT_TIME.targetCapabilities),
    supports: new Set(MISSION_MEET_AT_TIME.supportCapabilities),
    prereqs: new Set(MISSION_MEET_AT_TIME.prerequisiteCapabilities ?? []),
  };
  const lifecycle = (events: Any[]) =>
    (deriveSupportLifecycle as Any)(L, events, { capabilities: CAPABILITIES, tasks: TASKS_MEET_AT_TIME, roles });
  const demandingMiss = (observed: boolean) =>
    time('task.time.retrieval.hear', { id: `d.miss.${observed}`, at: T0, outcome: 'fail', observed, missing: [NUMBER_FN] });

  it('an observed attributed miss issues a function-scoped demand; an unobserved one issues nothing', () => {
    expect(lifecycle([demandingMiss(false)]).pending).toEqual([]);
    const { pending } = lifecycle([demandingMiss(true)]);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      targetCapabilityId: 'reception.listen.understand_clock_time',
      missingFunction: NUMBER_FN,
      supportCapabilityId: 'reception.listen.identify_spoken_number',
    });
  });

  it('a verified support probe that tested the function consumes the demand', () => {
    const probe = time('task.time.support.number_probe', { id: 'd.probe', at: T0 + MIN, outcome: 'success' });
    const { pending, resolved } = lifecycle([demandingMiss(true), probe]);
    expect(pending).toEqual([]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ status: 'consumed', resolvedByEventId: 'd.probe' });
  });

  it('without mission roles the lifecycle is empty — demand history is mission-scoped', () => {
    const none = (deriveSupportLifecycle as Any)(L, [demandingMiss(true)], {
      capabilities: CAPABILITIES,
      tasks: TASKS_MEET_AT_TIME,
      roles: { supports: new Set() },
    });
    expect(none).toEqual({ pending: [], resolved: [] });
  });
});

/* ── correction_episode / retest_surface / remediation_demand — PRESENT ── */

describe('G04 correction_episode + retest_surface + remediation_demand — PRESENT', () => {
  const sourceMiss = price('task.price.remediation.hear', {
    id: 'c.miss',
    at: T0 + MIN,
    outcome: 'fail',
    missing: [NUMBER_FN],
  });

  it('an episode opens only on an observed attributed miss on a taught capability', () => {
    const unobserved = { ...sourceMiss, id: 'c.miss.unobs', attempt: { ...sourceMiss.attempt, observed: false } };
    expect(episodes([taught, unobserved]).episodes).toEqual([]);
    expect(episodes([sourceMiss]).episodes).toEqual([]); // baseline miss: untaught
    const derived = episodes([taught, sourceMiss]);
    expect(derived.episodes).toHaveLength(1);
    expect(derived.openByCapability[PRICE].state).toBe('OPEN');
  });

  it('an unrelated success does not close the episode', () => {
    const unrelated = price('task.price.retrieval.hear', { id: 'c.unrelated', at: T0 + 2 * MIN, outcome: 'success' });
    expect(episodes([taught, sourceMiss, unrelated]).openByCapability[PRICE].state).toBe('OPEN');
  });

  it('independent covering repair → REPAIRED_WAITING; retest surfaces exclude burned surfaces', () => {
    // Retest surfaces must cover a remaining missing function, so the gap
    // here is attributed to the function the retest-eligible tasks require.
    const priceMiss = price('task.price.remediation.hear', {
      id: 'c.miss.pricefn',
      at: T0 + MIN,
      outcome: 'fail',
      missing: [PRICE_FN],
    });
    const repair = price('task.price.remediation.hear', { id: 'c.repair', at: T0 + 2 * MIN, outcome: 'success' });
    const derived = episodes([taught, priceMiss, repair], T0 + 3 * MIN);
    const ep = derived.openByCapability[PRICE];
    expect(ep.state).toBe('REPAIRED_WAITING');
    const surfaceIds = retestSurfaces(ep, TASKS_BUY_ITEM).map((t: Any) => t.id);
    expect(surfaceIds).toContain('task.price.retrieval.hear');
    expect(surfaceIds).toContain('task.price.delayed.hear');
    expect(surfaceIds).not.toContain('task.price.remediation.hear'); // burned source+repair surface
    expect(pickRetestSurface(ep, TASKS_BUY_ITEM).id).toBe('task.price.delayed.hear');
    // Past the lag the same unresolved episode is due — remediation demand
    // is readable as (openByCapability state + retestSurfaces) without
    // rebuilding episode state.
    expect(episodes([taught, priceMiss, repair], T0 + 2 * MIN + DAY).openByCapability[PRICE].state).toBe('RETEST_DUE');
  });

  it('a capability whose covering surfaces all burned exposes an EMPTY retest set — honest no-surface state', () => {
    const repair = price('task.price.remediation.hear', { id: 'c.repair.burned', at: T0 + 2 * MIN, outcome: 'success' });
    const ep = episodes([taught, sourceMiss, repair], T0 + 3 * MIN).openByCapability[PRICE];
    // identify_spoken_number is required only by the burned remediation
    // task — no fresh surface can serve the retest.
    expect(retestSurfaces(ep, TASKS_BUY_ITEM)).toEqual([]);
    expect(pickRetestSurface(ep, TASKS_BUY_ITEM)).toBeNull();
    expect(ep.state).toBe('REPAIRED_WAITING');
  });

  it('a verified attributed failure while waiting/due → RELAPSED with relapseCount — the recurring-error artifact', () => {
    const repair = price('task.price.remediation.hear', { id: 'c.repair', at: T0 + 2 * MIN, outcome: 'success' });
    const relapse = price('task.price.remediation.hear', {
      id: 'c.relapse',
      at: T0 + 2 * MIN + DAY + MIN,
      outcome: 'fail',
      missing: [NUMBER_FN],
    });
    const ep = episodes([taught, sourceMiss, repair, relapse], T0 + 2 * MIN + DAY + 2 * MIN).openByCapability[PRICE];
    expect(ep.state).toBe('RELAPSED');
    expect(ep.relapseCount).toBe(1);
    // A second failure while still OPEN is absorbed in place (widens the
    // gap) — it is repetition, NOT recurrence.
    const absorbed = episodes([
      taught,
      sourceMiss,
      price('task.price.remediation.hear', { id: 'c.repeat', at: T0 + 90 * 1000, outcome: 'fail', missing: [NUMBER_FN] }),
    ]).openByCapability[PRICE];
    expect(absorbed.state).not.toBe('RELAPSED');
    expect(absorbed.relapseCount).toBe(0);
    expect(absorbed.missingFunctions).toContain(NUMBER_FN);
  });

  it('episode derivation is order-independent and foreign-learner safe', () => {
    const foreign = price('task.price.remediation.hear', { id: 'c.foreign', at: T0 + 90 * 1000, outcome: 'success', learner: OTHER });
    const a = episodeDigest(episodes([taught, sourceMiss]));
    const b = episodeDigest(episodes([foreign, sourceMiss, taught, sourceMiss]));
    expect(b).toEqual(a);
  });
});

/* ── selection + decision provenance ──────────────────────────────── */

describe('G04 next_action_selection — PRESENT / selection_decision_provenance — MISSING', () => {
  const input = (mode: string) => ({
    mode,
    learnerId: L,
    mission: MISSION_BUY_ITEM,
    tasks: TASKS_BUY_ITEM,
    capabilities: CAPABILITIES,
    events: [taught],
    now: T0 + 2 * MIN,
  });

  it('B0 selection is deterministic from identical frozen input and binds its input digest into the decision id', () => {
    const a = (selectNextTask as Any)(input(SELECTION_MODES.B0));
    const b = (selectNextTask as Any)(input(SELECTION_MODES.B0));
    expect(a.decision.decisionId).toBe(b.decision.decisionId);
    expect(a.decision.decisionId).toContain(a.inputDigest.slice('sha256:'.length, 'sha256:'.length + 16));
    const audit = (decisionAuditRecord as Any)(a.decision, {
      learnerId: L,
      missionId: MISSION_BUY_ITEM.id,
      missionRevision: MISSION_BUY_ITEM.revision,
      sessionId: 's',
      timestamp: T0,
      digest: a.inputDigest,
    });
    expect(audit.decisionId).toBe(a.decision.decisionId);
    expect(audit.decisionInputDigest).toBe(a.inputDigest);
    expect(audit.taskId).toBe(a.taskId);
  });

  it('the production REFERENCE path — the only mode the bridge and session serve — carries a digest-bound decision record', () => {
    const ref = (selectNextTask as Any)(input(SELECTION_MODES.REFERENCE));
    expect(ref.status).toBe('ready');
    /* PC1 resolution: REFERENCE now returns the same provenance shape
     * as the engine modes — the served payload is unchanged, the
     * decision id binds the canonical input digest. */
    expect(ref.inputDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(ref.decision.decisionId).toContain(ref.inputDigest.slice('sha256:'.length, 'sha256:'.length + 16));
    expect(ref.decision.selectionPolicyVersion).toBe('production.nextMissionTask');
    expect(ref.decision.chosen.taskId).toBe(ref.taskId);
    expect(ref.decision.production.status).toBe('ready');
    // Same frozen input → identical digest → identical decision id.
    const again = (selectNextTask as Any)(input(SELECTION_MODES.REFERENCE));
    expect(again.inputDigest).toBe(ref.inputDigest);
    expect(again.decision.decisionId).toBe(ref.decision.decisionId);
    // The digest agrees with the engine modes' canonical input.
    const b0 = (selectNextTask as Any)(input(SELECTION_MODES.B0));
    expect(ref.inputDigest).toBe(b0.inputDigest);
  });
});
