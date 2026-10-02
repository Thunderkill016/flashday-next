/*
 * Semantic Commit Adapter (W2-02 / W2-G02 + W2-AT1) — the ONLY seam where a
 * legacy learner action may produce an EvidenceEvent.
 *
 *   legacy action
 *     → mapLegacyAttempt()        — audit-gated legacy→contract mapping;
 *                                   non-null ⇒ a semantic commit is possible
 *     → runSemanticCommit()       — the seam OWNS the transaction: legacy
 *                                   history write + bridge event append
 *                                   inside one Dexie transaction
 *
 * The audit is honest about coverage: every inventoried legacy action is
 * HISTORY_ONLY or BLOCKED_PENDING_W2_03 today — no registered TaskContract in
 * the vendored kernel covers vocabulary recall, orthography, dictation,
 * application, morphology construction, text-cycle stages, or pronunciation
 * attempts. mapLegacyAttempt therefore returns null for all of them and the
 * adapter mints nothing.
 *
 * W2-03 activation is NOT a status flip. An entry becomes MAPPED_SAFE only
 * with all of: a registered TaskContract whose capability/modality/purpose
 * honestly matches the action, an honest evaluator, a complete
 * action-specific provenance `map`, and mapping regression tests.
 */
import Dexie, { type Table } from 'dexie';
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
 * The observed-reality subset an action-specific mapper may author. The
 * mapper reports what actually happened — response, support genuinely
 * used, feedback rows, evaluationCtx when the contract legitimately needs
 * observed context. It may NEVER author capabilityId, purpose, modality,
 * transfer status, freshness class, evaluation authority, or mastery
 * state — those remain registered-contract derived inside the bridge.
 * Event identity (id/attemptId) and taskId stay adapter-owned.
 */
export type ObservedAttempt = Pick<MappedAttempt, 'response' | 'support' | 'feedback' | 'occurredAt' | 'evaluationCtx'>;

/**
 * One audit row per live legacy action shape. MAPPED_SAFE requires BOTH a
 * registered taskId AND an action-specific provenance `map` — a bare
 * {status, taskId} flip is not activatable because each legacy shape
 * carries different support provenance that must survive into the
 * submission. BLOCKED_PENDING_W2_03 names the contract gap W2-03 must
 * close. Nothing here may invent semantics to force a mapping.
 */
export interface LegacyAuditEntry {
  action: string;
  status: MappingStatus;
  taskId?: string;
  map?: (action: LegacyAction) => ObservedAttempt;
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
  // A MAPPED_SAFE status without an action-specific provenance mapper is a
  // misconfiguration — refuse closed rather than mint with bare defaults.
  if (!entry.map) throw new Error(`MAPPED_SAFE audit entry ${entry.action} has no provenance mapper`);
  const observed = entry.map(action);
  // Support-provenance guard: every support fact the caller declared true
  // on the action (revealed answer, translation used, assisted recall,
  // sourceRevealed...) must survive into the submission verbatim. A mapper
  // that drops `assisted` turns assisted recall into apparent independent
  // evidence — the laundering this seam exists to prevent.
  const mappedSupport = (observed.support ?? {}) as Record<string, unknown>;
  const dropped = Object.entries(action.support ?? {})
    .filter(([, v]) => v === true)
    .map(([k]) => k)
    .filter((k) => mappedSupport[k] !== true);
  if (dropped.length > 0)
    throw new Error(`mapped submission for ${entry.action} dropped support provenance: ${dropped.join(', ')}`);
  return {
    taskId: entry.taskId,
    id: `evt.${action.id}`,
    attemptId: action.id,
    ...observed,
    occurredAt: observed.occurredAt ?? action.occurredAt,
  };
}

let cachedRegistry: ContractRegistry | null = null;
const registry = () => (cachedRegistry ??= fixtureRegistry());

/**
 * Internal primitive — NOT exported. W2-02R2: a legacy EvidenceEvent must be
 * structurally impossible to mint independently of its history write, so the
 * event append exists only inside runSemanticCommit's transaction. The
 * ambient-transaction assertions are kept as defense-in-depth invariants.
 */
async function appendMappedEvent(
  evidenceEvents: Table<EvidenceEvent, string>,
  mapped: MappedAttempt,
  learnerId: string,
): Promise<void> {
  const tx = Dexie.currentTransaction;
  if (!tx) throw new Error('legacy semantic event append requires the ambient semantic transaction');
  if (!tx.storeNames.includes(evidenceEvents.name))
    throw new Error('ambient transaction does not include evidenceEvents');
  await submitAttempt(createDexieEventStore(evidenceEvents), registry(), {
    ...mapped,
    learnerId,
  });
}

/**
 * The canonical history artifact the seam verifies: a row readable by id.
 * Both producers persist `learningAttempts` keyed by the submission /
 * attempt id — which is `mapped.attemptId`. The seam derives the id itself
 * so a caller cannot name a different row than the event's attempt.
 * Typed as plain `Table` (any) — a narrower structural interface triggers
 * TS2589 against Dexie's overloaded Table surface on generic call sites.
 */
export type SemanticHistoryTable = Table;

/**
 * W2-02R3 — the ONLY legacy semantic-commit operation. The seam owns the
 * transaction: one Dexie transaction covers every history table plus
 * evidenceEvents; `writeHistory` performs the real legacy writes inside it.
 *
 * The seam does NOT trust writeHistory's return value — a callback's
 * `return true` is a claim, not evidence. Inside the transaction the seam
 * reads the canonical history row BEFORE `writeHistory()` and branches
 * three ways (W2-02R4):
 *
 *   history absent           → writeHistory() must materialize the
 *     matching row (absent after → throw; full rollback), then append
 *   history exists + event   → canonical re-delivery: identical content
 *     dedupes, divergent content throws the store conflict — a mutated
 *     retry is refused, not silently accepted. writeHistory never runs,
 *     so .add()-based producers cannot ConstraintError on retry
 *   history exists, no event → pre-cutover row: never mint, never
 *     repair, writeHistory never runs — a no-op
 *
 * The verified history id is `mapped.attemptId` — seam-derived, not
 * caller-chosen; the event id is `mapped.id ?? evt.<attemptId>`, matching
 * the bridge's own derivation. Either side throwing aborts everything, and
 * because the append primitive is module-private, no caller can mint an
 * event without a materialized history row.
 *
 * Contract semantics stay in the bridge (taskId → evaluator/binder); this
 * coordinator owns ordering and atomicity only, never semantic fields.
 *
 * `writeHistory`'s return value is control-flow only (e.g. 'created' vs
 * 'noop') — it is never used as proof of history.
 */
export async function runSemanticCommit(args: {
  /** The live Dexie instance the seam opens its transaction on. Must expose
   *  an `evidenceEvents` object store — a database without it is refused. */
  database: Dexie;
  /** Every table the history write touches. evidenceEvents + historyTable are added by the seam. */
  tables: Table[];
  /** Canonical history table — the seam reads row `mapped.attemptId` before/after the write. */
  historyTable: SemanticHistoryTable;
  mapped: MappedAttempt;
  learnerId: string;
  /** Performs the real legacy writes. Its return value is control-flow
   *  only ('created'/'noop') — never used as proof that history exists. */
  writeHistory: () => Promise<unknown>;
  /** Post-append check inside the transaction (e.g. account-switch guard). */
  verify?: () => void;
}): Promise<void> {
  const { database, tables, historyTable, mapped, learnerId, writeHistory, verify } = args;
  // evidenceEvents is a dynamic Dexie member declared on db subclasses —
  // narrowing here keeps callers from comparing their full concrete type
  // against an intersection (TS2589 on Dexie's overloaded surface).
  const evidenceEvents = (database as { evidenceEvents?: Table<EvidenceEvent, string> }).evidenceEvents;
  if (!evidenceEvents) throw new Error('mapped semantic commit requires the evidenceEvents table in scope');
  if (!mapped.attemptId) throw new Error('semantic commit refused: mapped attempt has no attemptId to verify history');
  const historyId = mapped.attemptId;
  const storeNames = [...new Set([...tables.map((t) => t.name), historyTable.name, evidenceEvents.name])];
  await database.transaction('rw', storeNames, async () => {
    const before = await historyTable.get(historyId);
    if (before) {
      // History already committed — never re-run writeHistory (producers
      // using .add would ConstraintError on duplicate). If this attempt's
      // event exists, re-deliver through the canonical store: identical
      // content dedupes, divergent content throws the conflict — a mutated
      // retry is refused. Event absent ⇒ pre-cutover row: no mint, no repair.
      const existing = await evidenceEvents.get(mapped.id ?? `evt.${historyId}`);
      if (existing) await appendMappedEvent(evidenceEvents, mapped, learnerId);
    } else {
      await writeHistory();
      const after = await historyTable.get(historyId);
      if (!after) throw new Error(`semantic commit refused: writeHistory materialized no history row ${historyId}`);
      await appendMappedEvent(evidenceEvents, mapped, learnerId);
    }
    verify?.();
  });
}
