/*
 * FD-VS01 telemetry — pure derived read model over existing persistence.
 * No writes, no new table, no scheduling side effects. Replays
 * contents/learningAttempts/sessions into one inspectable record per
 * pilot target so the dogfooder can see what actually failed.
 *
 * Honesty rules baked in:
 *  - understanding is a tri-state; "independent" requires a valid
 *    comprehension attempt with no recorded translation support. Lookup
 *    support is never inferred — unknown stays unknown.
 *  - the FIRST typed submission is the retrieval outcome; later retries
 *    populate immediateRecoveredAt, never rewrite the first result.
 *  - delayed recall is timestamp-anchored: first successful retrieval
 *    + TEXT_CYCLE_INITIAL_DELAY. FSRS nextReview is not evidence that
 *    24h elapsed, and pre-anchor practice is not delayed evidence.
 *  - human-judgment failure reasons (context-too-close, untrustworthy
 *    evaluation) are never fabricated; they arrive only via humanNotes.
 */
import { deriveTextCycle } from '@/lib/text-learning-cycle';
import type { ContentItem, TypingSession } from '@/types/content';
import type { LearningAttempt } from '@/types/learning-activity';
import { TEXT_CYCLE_INITIAL_DELAY } from './text-learning-cycle';
import { resolveVs01Source, VS01_TARGETS, type Vs01Target } from './vs01-targets';

export type Vs01Understanding = 'independent' | 'supported' | 'not-demonstrated';
export type Vs01Outcome = 'pass' | 'fail' | 'not-attempted';
export type Vs01DelayedRecall = 'pass' | 'fail' | 'not-due' | 'not-attempted';
export type Vs01Production = 'used-unprompted' | 'absent' | 'not-attempted';
export type Vs01CycleRecall = 'pass' | 'assisted' | 'failed' | 'not-due' | 'not-attempted';

export type Vs01FailureReason =
  | 'UNDERSTANDING_NOT_DEMONSTRATED'
  | 'IMMEDIATE_RECALL_FAILED'
  | 'DELAYED_RECALL_FAILED'
  | 'PRODUCTION_ABSENT'
  | 'TRANSFER_NOT_COMPLETED'
  | 'TRANSFER_CONTEXT_TOO_CLOSE'
  | 'ASSISTED_RECALL'
  | 'EVALUATION_UNTRUSTWORTHY';

export interface Vs01TargetRecord {
  targetId: string;
  recallTarget: string;
  sourceId: string | null;
  sourceSentence: string;
  understanding: Vs01Understanding;
  immediateRecall: Vs01Outcome;
  immediateAttemptAt?: number;
  immediateRecoveredAt?: number;
  immediateAttemptCount: number;
  production: Vs01Production;
  delayedEligibleAt?: number;
  delayedAttemptAt?: number;
  delayedRecall: Vs01DelayedRecall;
  /** Lesson-level cycle recall state — assists here mark ASSISTED_RECALL. */
  cycleRecall: Vs01CycleRecall;
  transferMechanicalOutcome: Vs01Outcome;
  transferAttemptId?: string;
  failureReason?: Vs01FailureReason;
  notes?: string;
}

export interface Vs01HumanNote {
  failureReason?: Vs01FailureReason;
  notes?: string;
}

export interface Vs01TelemetryInput {
  contents: ContentItem[];
  attempts: LearningAttempt[];
  sessions: TypingSession[];
  now: number;
  /** Per-target human observations — only source of judgmental reasons. */
  humanNotes?: Record<string, Vs01HumanNote>;
}

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();
const sessionTime = (s: TypingSession) => s.endTime ?? s.startTime;

function validComprehension(attempt: LearningAttempt): boolean {
  return (
    attempt.activity === 'comprehension' &&
    !!attempt.answer.trim() &&
    !!attempt.evidenceQuote?.trim() &&
    attempt.sourceText.includes(attempt.evidenceQuote.trim())
  );
}

function isUnpromptedProduction(attempt: LearningAttempt, sourceText: string): boolean {
  return (
    attempt.activity === 'writing' &&
    !attempt.cycle &&
    !!attempt.answer.trim() &&
    !normalize(sourceText).includes(normalize(attempt.answer))
  );
}

function deriveCycleRecall(sourceId: string, attempts: LearningAttempt[], now: number): Vs01CycleRecall {
  const groups = new Map<string, LearningAttempt[]>();
  for (const attempt of attempts) {
    if (!attempt.sourceContentIds.includes(sourceId)) continue;
    const group = groups.get(attempt.lessonId);
    if (group) group.push(attempt);
    else groups.set(attempt.lessonId, [attempt]);
  }
  let best: Vs01CycleRecall = 'not-attempted';
  let bestSteps = -1;
  for (const group of groups.values()) {
    const cycle = deriveTextCycle(group[0].lessonId, group[0].sourceText, group, now);
    if (cycle.completedSteps <= bestSteps) continue;
    bestSteps = cycle.completedSteps;
    if (cycle.lastRecallAttemptId) {
      best = cycle.lastRecallAssisted ? 'assisted' : cycle.lastRecallRating === 'again' ? 'failed' : 'pass';
    } else {
      best = cycle.reviewStatus === 'scheduled' ? 'not-due' : 'not-attempted';
    }
  }
  return best;
}

function deriveTargetRecord(target: Vs01Target, input: Vs01TelemetryInput, sourceId: string | null): Vs01TargetRecord {
  const sourceAttempts = sourceId
    ? input.attempts.filter((a) => a.sourceContentIds.includes(sourceId))
    : input.attempts.filter((a) => a.sourceText.includes(target.sourceSentence));

  const comprehension = sourceAttempts.filter(validComprehension).sort((a, b) => a.createdAt - b.createdAt)[0];
  const understanding: Vs01Understanding = !comprehension
    ? 'not-demonstrated'
    : comprehension.usedTranslation
      ? 'supported'
      : 'independent';

  const targetSessions = input.sessions
    .filter((s) => s.contentId === target.id && s.module === 'write')
    .sort((a, b) => sessionTime(a) - sessionTime(b));
  const first = targetSessions[0];
  const firstSuccess = targetSessions.find((s) => s.completed);
  const immediateRecall: Vs01Outcome = !first ? 'not-attempted' : first.completed ? 'pass' : 'fail';
  const immediateRecoveredAt =
    first && !first.completed ? (firstSuccess?.endTime ?? firstSuccess?.startTime) : undefined;

  const anchor = firstSuccess ? sessionTime(firstSuccess) : undefined;
  const delayedEligibleAt = anchor !== undefined ? anchor + TEXT_CYCLE_INITIAL_DELAY : undefined;
  const delayedFirst =
    delayedEligibleAt !== undefined ? targetSessions.find((s) => sessionTime(s) >= delayedEligibleAt) : undefined;
  const delayedRecall: Vs01DelayedRecall =
    delayedEligibleAt === undefined
      ? 'not-attempted'
      : delayedFirst
        ? delayedFirst.completed
          ? 'pass'
          : 'fail'
        : input.now < delayedEligibleAt
          ? 'not-due'
          : 'not-attempted';

  /* Production measurement is post-comprehension: only unprompted writing
   * after understanding was demonstrated counts (spec §13). */
  const productionAttempts = sourceAttempts.filter(
    (a) => isUnpromptedProduction(a, a.sourceText) && (!comprehension || a.createdAt >= comprehension.createdAt),
  );
  const production: Vs01Production = !productionAttempts.length
    ? 'not-attempted'
    : productionAttempts.some((a) => normalize(a.answer).includes(normalize(target.recallTarget)))
      ? 'used-unprompted'
      : 'absent';

  const transferAttempts = sourceAttempts.filter(
    (a) => a.activity === 'personal-example' && a.cycle?.stage === 'apply',
  );
  const bound = transferAttempts.find((a) => normalize(a.cycle?.expression ?? '') === normalize(target.recallTarget));
  const transferMechanicalOutcome: Vs01Outcome = !bound
    ? 'not-attempted'
    : bound.cycle?.assisted || bound.cycle?.sourceRevealed || bound.usedTranslation
      ? 'fail'
      : 'pass';

  const cycleRecall = sourceId ? deriveCycleRecall(sourceId, input.attempts, input.now) : 'not-attempted';

  const record: Vs01TargetRecord = {
    targetId: target.id,
    recallTarget: target.recallTarget,
    sourceId,
    sourceSentence: target.sourceSentence,
    understanding,
    immediateRecall,
    immediateAttemptAt: first ? sessionTime(first) : undefined,
    immediateRecoveredAt,
    immediateAttemptCount: targetSessions.length,
    production,
    delayedEligibleAt,
    delayedAttemptAt: delayedFirst ? sessionTime(delayedFirst) : undefined,
    delayedRecall,
    cycleRecall,
    transferMechanicalOutcome,
    transferAttemptId: bound?.id,
  };

  record.failureReason = deriveFailureReason(record);
  const human = input.humanNotes?.[target.id];
  if (human?.failureReason) record.failureReason = human.failureReason;
  if (human?.notes) record.notes = human.notes;
  return record;
}

/**
 * Deepest proven failure in pipeline order — a stage only emits a reason
 * when persisted data proves a negative outcome (fail/absent), or when a
 * later stage's prerequisite held but the stage was still not completed.
 * Missing stages never fabricate failure.
 */
function deriveFailureReason(record: Vs01TargetRecord): Vs01FailureReason | undefined {
  if (record.understanding === 'not-demonstrated') return 'UNDERSTANDING_NOT_DEMONSTRATED';
  if (record.immediateRecall === 'fail') return 'IMMEDIATE_RECALL_FAILED';
  if (record.cycleRecall === 'assisted' || record.cycleRecall === 'failed') return 'ASSISTED_RECALL';
  if (record.delayedRecall === 'fail') return 'DELAYED_RECALL_FAILED';
  if (record.production === 'absent') return 'PRODUCTION_ABSENT';
  if (record.transferMechanicalOutcome === 'fail') return 'TRANSFER_NOT_COMPLETED';
  if (
    record.transferMechanicalOutcome === 'not-attempted' &&
    (record.delayedRecall === 'pass' || record.cycleRecall === 'pass')
  )
    return 'TRANSFER_NOT_COMPLETED';
  return undefined;
}

/** One record per pilot target, in fixture order. */
export function deriveVs01Records(input: Vs01TelemetryInput): Vs01TargetRecord[] {
  const source = resolveVs01Source(input.contents);
  return VS01_TARGETS.map((target) => deriveTargetRecord(target, input, source?.id ?? null));
}

/** JSON export — the dev-only inspection path documented in the runbook. */
export function vs01ReportJson(input: Vs01TelemetryInput): string {
  return JSON.stringify(deriveVs01Records(input), null, 2);
}
