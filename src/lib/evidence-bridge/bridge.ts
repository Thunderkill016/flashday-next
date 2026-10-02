/*
 * Evidence Bridge — the seam between EchoType and the FlashDay kernel.
 *
 * EchoType submits OBSERVED REALITY (a registered taskId + what the
 * learner actually did); everything semantic is derived from the
 * registered contract: capabilityId, purpose, context, freshness,
 * transfer, evaluation authority. For deterministic contracts the
 * outcome is scored by the kernel evaluator — a UI "correct=true"
 * claim is never trusted (§6/§15).
 *
 *   submitAttempt / submitObservation
 *     → registry resolve → evaluateAttempt → bindAttempt → store.append
 *   projectState → projectLearnerState (replay-derived, never mutable)
 *   nextAction   → selectNextTask in the shipped reference mode
 */
import { bindAttempt, bindObservation } from '@/vnext/bind';
import { emittedEventType } from '@/vnext/contracts';
import { evaluateAttempt } from '@/vnext/evaluators';
import { SELECTION_MODES, selectNextTask } from '@/vnext/next-for-you/selector';
import { projectLearnerState } from '@/vnext/projection';
import type {
  AttemptSubmission,
  ContractRegistry,
  EventStore,
  EvidenceEvent,
  LearnerProjection,
  NextTaskDecision,
  ObservationSubmission,
} from './types';

/* Fields a submission may never author — they are contract-derived.
 * taskId is deliberately absent: naming the contract is the caller's
 * one legitimate handle on it. */
const FORGED_SUBMISSION_KEYS = [
  'capabilityId',
  'taskRevision',
  'modality',
  'missionId',
  'promptFamily',
  'practicedOrTransfer',
  'purpose',
  'context',
  'binding',
  'freshness',
  'transfer',
];

const checkForgery = (sub: object) => {
  const rec = sub as Record<string, unknown>;
  for (const key of FORGED_SUBMISSION_KEYS) {
    if (rec[key] != null) {
      throw new Error(`submission may not author '${key}' — it is derived from the TaskContract`);
    }
  }
  // The scoring channel is trusted seam input (W2-02.5) — it may only
  // arrive through submitAttempt's `trusted` parameter. A caller who
  // could set evaluationCtx.target would score answer===answer.
  const ctx = rec.evaluationCtx as Record<string, unknown> | undefined;
  for (const key of ['target', 'scoring']) {
    if (ctx?.[key] != null) {
      throw new Error(
        `evaluationCtx may not author '${key}' — the scoring target is trusted seam input, never caller data`,
      );
    }
  }
  const evaluation = rec.evaluation as Record<string, unknown> | undefined;
  if (evaluation?.scoredAgainst != null) {
    throw new Error('submission may not author evaluation.scoredAgainst — evaluator-derived provenance');
  }
};

const genEventId = (sub: { id?: string; attemptId?: string }) =>
  sub.id ?? (sub.attemptId ? `evt.${sub.attemptId}` : `evt.${crypto.randomUUID()}`);

const resolveTask = (registry: ContractRegistry, taskId: string) => {
  const task = registry.taskById(taskId);
  if (!task) {
    throw new Error(`unregistered task '${taskId}' — evidence may only bind to a registered contract`);
  }
  const capability = registry.capabilityById(task.capabilityId);
  if (!capability) {
    throw new Error(`registered task '${taskId}' references unknown capability '${task.capabilityId}'`);
  }
  return { task, capability };
};

/** What the declared evaluator actually scored — the function-level
 * detail a feedback surface renders. Null when the task declares no
 * deterministic contract (then the caller's `outcome` report stands,
 * stamped with the task's declared authority). */
export interface AttemptEvalResult {
  outcome: 'success' | 'partial' | 'fail';
  functions?: { fn: string; met: boolean; known: boolean }[];
  missed?: string[];
  missingFunctions?: string[];
  /** Canonical form of the target the evaluator actually scored against
   * (exact-match family) — replay provenance, never caller-supplied. */
  scoredTarget?: string;
}

export interface AttemptResult {
  event: EvidenceEvent;
  evalResult: AttemptEvalResult | null;
}

/** Trusted evaluator input only the seam may supply — resolved from
 * authoritative storage inside the commit transaction (e.g. the
 * ContentItem title a spelling task scores against). Never part of the
 * caller-visible submission: checkForgery rejects target/scoring keys on
 * evaluationCtx so this channel cannot be impersonated. */
export interface TrustedEvaluationInput {
  scoring?: { target?: string; contentId?: string };
}

export async function submitAttempt(
  store: EventStore,
  registry: ContractRegistry,
  sub: AttemptSubmission,
  trusted?: TrustedEvaluationInput,
): Promise<AttemptResult> {
  checkForgery(sub);
  const { task, capability } = resolveTask(registry, sub.taskId);

  /* Outcome ownership: a declared evaluation contract re-scores the
   * response (caller's outcome is ignored — the UI cannot claim
   * success). Without a contract, the caller's report is honored but
   * stamped with the task's declared authority — self_report/asr/
   * ai_llm evidence can never mint independent credit either.
   *
   * A declared contract whose evaluator abstains (returns null —
   * unregistered contract, or a missing trusted target) fails CLOSED:
   * falling back to the caller's claimed outcome would let an
   * unscorable attempt mint evidence anyway. */
  const evalResult = task.evaluation?.contractId
    ? ((evaluateAttempt(task as never, sub.response, {
        ...(sub.evaluationCtx ?? {}),
        scoring: trusted?.scoring,
      } as never) ?? null) as AttemptEvalResult | null)
    : null;
  if (task.evaluation?.contractId && !evalResult) {
    throw new Error(
      `evaluator '${task.evaluation.contractId}' produced no report — refusing to mint outcome-less evidence`,
    );
  }
  const outcome = evalResult ? evalResult.outcome : (sub.outcome ?? null);
  // What 'correct' meant at commit time: which authoritative artifact
  // supplied the target plus its canonical form. Stamped into
  // evaluation so replay audits provenance, not today's table contents.
  const scoredAgainst =
    evalResult?.scoredTarget != null
      ? { contentId: trusted?.scoring?.contentId ?? null, scoredTarget: evalResult.scoredTarget }
      : undefined;

  const event = bindAttempt(
    task as never,
    capability as never,
    {
      id: genEventId(sub),
      learnerId: sub.learnerId,
      occurredAt: sub.occurredAt,
      // The contract's purpose×response matrix picks the emitted type —
      // e.g. retrieval+choice → recognition_attempt, diagnostic+text →
      // recall_attempt. Callers never name it.
      eventType:
        sub.eventType ?? emittedEventType(task.purpose as never, task.response?.type === 'choice' ? 'choice' : 'text'),
      attempt: {
        observed: true,
        outcome,
        response: sub.response,
        latencyMs: sub.latencyMs,
        attemptId: sub.attemptId,
      },
      support: sub.support,
      feedback: sub.feedback,
      partnerType: sub.partnerType,
      evaluation: {
        evaluator: sub.evaluation?.evaluator,
        version: sub.evaluation?.version,
        // Demand routing reads evaluator-attributed misses — the binder
        // still validates they stay ⊆ requiredFunctions.
        missingFunctions: evalResult?.missingFunctions ?? sub.evaluation?.missingFunctions ?? [],
      },
    },
    scoredAgainst ? { scoredAgainst } : undefined,
  ) as EvidenceEvent;
  await store.append([event]);
  return { event, evalResult };
}

export async function submitObservation(
  store: EventStore,
  registry: ContractRegistry,
  sub: ObservationSubmission,
): Promise<EvidenceEvent> {
  checkForgery(sub);
  const { task, capability } = resolveTask(registry, sub.taskId);
  const event = bindObservation(task as never, capability as never, {
    id: genEventId(sub),
    learnerId: sub.learnerId,
    occurredAt: sub.occurredAt,
    eventType: sub.eventType,
    attempt: sub.attempt,
    support: sub.support,
    feedback: sub.feedback,
    partnerType: sub.partnerType,
    evaluation: {
      evaluator: sub.evaluation?.evaluator,
      version: sub.evaluation?.version,
    },
  }) as EvidenceEvent;
  await store.append([event]);
  return event;
}

/** Replay-derived learner state — never mutated, always recomputed. */
export async function projectState(
  learnerId: string,
  store: EventStore,
  registry: ContractRegistry,
): Promise<LearnerProjection> {
  const events = await store.list();
  return projectLearnerState(
    learnerId,
    events,
    registry.capabilities as never,
    registry.tasks as never,
  ) as LearnerProjection;
}

/** "Next For You": the shipped deterministic policy over live evidence. */
export async function nextAction(
  registry: ContractRegistry,
  input: {
    learnerId: string;
    missionId: string;
    events: EvidenceEvent[];
    now: number;
    riskPriors?: unknown[];
    policy?: unknown;
  },
): Promise<NextTaskDecision> {
  const mission = registry.missionById(input.missionId);
  if (!mission) {
    throw new Error(`unregistered mission '${input.missionId}'`);
  }
  return selectNextTask({
    // The shipped deterministic runner. B0/B1 are experiment surfaces —
    // production never selects them today.
    mode: SELECTION_MODES.REFERENCE,
    learnerId: input.learnerId,
    mission,
    tasks: registry.tasks,
    capabilities: registry.capabilities,
    events: input.events,
    riskPriors: input.riskPriors ?? [],
    now: input.now,
    policy: input.policy,
  }) as NextTaskDecision;
}
