/*
 * Verified attempt facts (W2-PC1, construct verified_consecutive_failure).
 *
 * The single derivation every authority consumer shares. Before PC1 the
 * kernel kept two divergent counters:
 *
 *   - projection.consecutiveFailures — ANY attempt-type outcome counted,
 *     including unobserved self-reports and stale-revision events the
 *     learner model itself filed under unverifiableEventCount.
 *   - task-resolver.observedFailStreak — stricter (verifyEventTask +
 *     observed===true) but internal to next-for-you, and it still
 *     counted any verified observed outcome event, so a support_attempt
 *     probe or a forged outcome on a feedback context could move it.
 *
 * This module is the truth bar both collapse onto. An event contributes
 * to the verified failure stream only when ALL of the following hold:
 *
 *   - learnerId === the projected learner (foreign events are invisible);
 *   - the event id has not been delivered before (dedupe — a resynced
 *     duplicate cannot double-count);
 *   - taskId@taskRevision resolves to a REGISTERED exact revision in
 *     taskByRev (stale revisions are unverifiable context, not evidence);
 *   - verifyEventTask(event, task, capability) — the contract's own
 *     binding/authority/family checks;
 *   - eventType ∈ ATTEMPT_TYPES — a performance-bearing attempt type.
 *     Context events (exposure/support_use/feedback) and support_attempt
 *     probes can carry an outcome field, but it is context, never a
 *     failure signal on the capability;
 *   - attempt.observed === true — self-reported outcomes are invisible
 *     to the stream: they can neither advance NOR break a streak.
 *
 * An event that fails any gate is IGNORED — it does not reset a live
 * streak either (fail → unobserved success → fail stays 2).
 */

import { verifyEventTask } from './contracts.js';

/* Performance-bearing attempt types — the same gate the projection and
 * learner model use to distinguish performance from context.
 * support_attempt is deliberately absent: a probe is remediation
 * context on the support capability, never ability/failure evidence. */
const ATTEMPT_TYPES = new Set([
  'recognition_attempt',
  'recall_attempt',
  'production_attempt',
  'interaction_turn',
  'retry',
  'delayed_retrieval',
  'transfer_attempt',
  'checkpoint'
]);

/* Returns Map<capabilityId, {
 *   verifiedConsecutiveFailures: number,   // consecutive observed fail/partial ending the verified attempt trail
 *   lastVerifiedObservedOutcome: 'success'|'fail'|'partial'|null,
 *   lastVerifiedObservedAttempt: { outcome, task, event } | null
 * }> — only capabilities with at least one verified observed attempt
 * appear; absent means "no verified performance evidence". */
export function deriveVerifiedAttemptFacts({ learnerId, events, capabilities, taskByRev }) {
  const capById = new Map(capabilities.map((c) => [c.id, c]));
  const facts = new Map();
  const seenIds = new Set();
  const mine = (events ?? [])
    .filter((e) => e.learnerId === learnerId)
    .sort((a, b) => (a.occurredAt ?? 0) - (b.occurredAt ?? 0) || ((a.id ?? '') < (b.id ?? '') ? -1 : 1));
  for (const e of mine) {
    if (seenIds.has(e.id)) continue;
    seenIds.add(e.id);
    const t = taskByRev.get(`${e.taskId}@${e.taskRevision}`);
    const cap = t ? capById.get(t.capabilityId) : null;
    if (!t || !cap || !verifyEventTask(e, t, cap)) continue;
    if (!ATTEMPT_TYPES.has(e.eventType) || e.attempt?.outcome == null) continue;
    if (e.attempt.observed !== true) continue;
    const f = facts.get(t.capabilityId) ?? {
      verifiedConsecutiveFailures: 0,
      lastVerifiedObservedOutcome: null,
      lastVerifiedObservedAttempt: null
    };
    f.lastVerifiedObservedOutcome = e.attempt.outcome;
    f.lastVerifiedObservedAttempt = { outcome: e.attempt.outcome, task: t, event: e };
    f.verifiedConsecutiveFailures = e.attempt.outcome === 'success'
      ? 0
      : f.verifiedConsecutiveFailures + 1;
    facts.set(t.capabilityId, f);
  }
  return facts;
}
