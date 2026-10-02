/*
 * Semantic Commit Adapter (W2-02 / W2-G02 + W2-AT1) — the ONLY seam where a
 * legacy learner action may produce an EvidenceEvent.
 *
 *   legacy action
 *     → mapLegacyAttempt()        — audit-gated legacy→contract mapping;
 *                                   non-null ⇒ db.evidenceEvents joins the
 *                                   caller's transaction table list
 *     → commitMappedAttempt()     — bridge submitAttempt inside the caller's
 *                                   Dexie transaction (atomic with history)
 *
 * The audit is honest about coverage: every inventoried legacy action is
 * HISTORY_ONLY or BLOCKED_PENDING_W2_03 today — no registered TaskContract in
 * the vendored kernel covers vocabulary recall, orthography, dictation,
 * application, morphology construction, text-cycle stages, or pronunciation
 * attempts. mapLegacyAttempt therefore returns null for all of them and the
 * adapter mints nothing. When W2-03 registers real contracts, entries flip to
 * MAPPED_SAFE and events flow atomically through the same transaction that
 * writes the legacy history row.
 */
import type { Table } from 'dexie';
import { submitAttempt } from './bridge';
import { fixtureRegistry } from './registry';
import { createDexieEventStore } from './store';
import type { AttemptSubmission, ContractRegistry, EvidenceEvent } from './types';

/** Discriminator for the audit key: which legacy producer + which mode. */
export interface LegacyAction {
  /** Immutable submission/attempt id — the deterministic event-id basis. */
  id: string;
  kind: 'vocabulary' | 'learning-attempt' | 'text-cycle';
  /** Mode/activity/stage discriminator — combined with kind into the audit key. */
  mode: string;
  occurredAt: number;
  /** Observed learner production — passed through verbatim, never interpreted. */
  response?: unknown;
  /** Support actually exposed to the learner (revealed answer, hints...). */
  support?: Record<string, unknown>;
  /** Legacy feedback rows stay observational context — never evaluator authority. */
  feedback?: unknown;
}

export type MappingStatus = 'MAPPED_SAFE' | 'HISTORY_ONLY' | 'BLOCKED_PENDING_W2_03';

/**
 * One audit row per live legacy action shape. MAPPED_SAFE additionally names
 * the registered taskId it binds to; BLOCKED_PENDING_W2_03 names the contract
 * gap W2-03 must close. Nothing here may invent semantics to force a mapping.
 */
export interface LegacyAuditEntry {
  action: string;
  status: MappingStatus;
  taskId?: string;
  reason: string;
}

export const LEGACY_CONTRACT_AUDIT: readonly LegacyAuditEntry[] = [
  {
    action: 'vocabulary:meaning',
    status: 'BLOCKED_PENDING_W2_03',
    reason:
      'self-rated meaning recall; no registered vocabulary-retrieval contract — kernel retrieval tasks are mission listening items',
  },
  {
    action: 'vocabulary:spelling',
    status: 'BLOCKED_PENDING_W2_03',
    reason: 'typed orthographic production; no typed response shape exists in any registered contract',
  },
  {
    action: 'vocabulary:dictation',
    status: 'BLOCKED_PENDING_W2_03',
    reason: 'listen+type; no dictation response shape or orthographic evaluator is registered',
  },
  {
    action: 'vocabulary:application',
    status: 'BLOCKED_PENDING_W2_03',
    reason:
      'free production looks transfer-like but no fresh-context transfer contract exists for vocabulary; validateVocabularyApplication is a heuristic, not an evaluator',
  },
  {
    action: 'vocabulary:construction',
    status: 'BLOCKED_PENDING_W2_03',
    reason: 'morphology assembly; no registered contract covers word-construction evidence',
  },
  {
    action: 'learning-attempt:comprehension',
    status: 'BLOCKED_PENDING_W2_03',
    reason: 'open-text comprehension; no registered contract for text comprehension evidence',
  },
  {
    action: 'learning-attempt:writing',
    status: 'BLOCKED_PENDING_W2_03',
    reason: 'free writing attempt; no registered free-production contract outside mission tasks',
  },
  {
    action: 'learning-attempt:retelling',
    status: 'BLOCKED_PENDING_W2_03',
    reason: 'audio retelling; no registered retelling contract or evaluator',
  },
  {
    action: 'learning-attempt:personal-example',
    status: 'BLOCKED_PENDING_W2_03',
    reason: 'personal-example production; no registered contract; vocabulary application also lands here',
  },
  {
    action: 'learning-attempt:sentence-pronunciation',
    status: 'BLOCKED_PENDING_W2_03',
    reason: 'pronunciation scoring is not a communicative-function evaluator; no pronunciation contract registered',
  },
  {
    action: 'text-cycle:understand',
    status: 'BLOCKED_PENDING_W2_03',
    reason: 'comprehension phase — needs an exposure/comprehension observation contract',
  },
  {
    action: 'text-cycle:output',
    status: 'BLOCKED_PENDING_W2_03',
    reason: 'supported production phase — support provenance needs an honest contract first',
  },
  {
    action: 'text-cycle:correct',
    status: 'BLOCKED_PENDING_W2_03',
    reason: 'self-correction phase — needs a correction-episode contract binding',
  },
  {
    action: 'text-cycle:recall',
    status: 'BLOCKED_PENDING_W2_03',
    reason: 'delayed recall — needs a registered delayed_retrieval contract; cycle rating is not kernel authority',
  },
  {
    action: 'text-cycle:apply',
    status: 'BLOCKED_PENDING_W2_03',
    reason: 'application stage looks like transfer — needs a fresh-context transfer contract, not a heuristic',
  },
];

/**
 * What a mapped action hands to the bridge: observed reality only. The
 * submission may never carry capabilityId, purpose, modality, transfer, or
 * evaluation authority — those stay contract-derived inside the bridge.
 */
export type MappedAttempt = Omit<AttemptSubmission, 'learnerId'>;

const auditKey = (action: LegacyAction) => `${action.kind}:${action.mode}`;

/**
 * Resolve a legacy action to a contract-bound submission, or null when no
 * honest registered contract exists (history-only / W2-03 coverage gap).
 * Deterministic event identity: `evt.<immutable action id>` — a retried
 * submission redelivers the same event (dedupe), a mutated one conflicts.
 */
export function mapLegacyAttempt(action: LegacyAction): MappedAttempt | null {
  // Only a MAPPED_SAFE entry mints; duplicate keys resolve to the safe one.
  const entry = LEGACY_CONTRACT_AUDIT.find(
    (e) => e.action === auditKey(action) && e.status === 'MAPPED_SAFE' && e.taskId,
  );
  if (!entry?.taskId) return null;
  return {
    taskId: entry.taskId,
    occurredAt: action.occurredAt,
    id: `evt.${action.id}`,
    attemptId: action.id,
    response: action.response,
    support: action.support,
    feedback: action.feedback,
  };
}

let cachedRegistry: ContractRegistry | null = null;
const registry = () => (cachedRegistry ??= fixtureRegistry());

/**
 * Append a mapped event through the canonical bridge inside the caller's
 * ambient transaction — the same Dexie transaction that writes the legacy
 * history row. Design A (W2-02 §5): the Dexie table op joins the ambient
 * transaction, so an event failure rolls back history and vice versa.
 */
export async function commitMappedAttempt(
  database: { evidenceEvents?: Table<EvidenceEvent, string> },
  mapped: MappedAttempt,
  learnerId: string,
): Promise<void> {
  if (!database.evidenceEvents) {
    throw new Error('mapped semantic commit requires the evidenceEvents table in scope');
  }
  await submitAttempt(createDexieEventStore(database.evidenceEvents), registry(), {
    ...mapped,
    learnerId,
  });
}
