/*
 * W2-02.5 — vocabulary spelling contract pilot.
 *
 * The smallest honest contract surface that lets ONE legacy action
 * (vocabulary:spelling) mint evidence through the semantic-commit seam:
 *
 *   capability  production.write.lexical_form_recall
 *   mission     mission.vocabulary_practice.v1   (carrier container — the
 *               pilot claims no baseline, retention or assessment package)
 *   task        task.vocab.spelling.v1           (practiced retrieval,
 *               typed text, deterministic exact-match scoring)
 *
 * The capability is deliberately narrow: one verified unaided exact-match
 * attempt is evidence of lexical-form retrieval under a meaning cue — NOT
 * general writing proficiency, spelling mastery, or vocabulary mastery.
 */
import { canonicalFamilyId, makeMission, makeTask } from './contracts.js';

const CAP_ID = 'production.write.lexical_form_recall';

export const CAP_VOCAB_LEXICAL_FORM_RECALL = {
  id: CAP_ID,
  version: 1,
  performance:
    'Produce the written form of a target learned lexical item when cued by its stored meaning.',
  modality: 'writing',
  prerequisites: [],
  conditions: {
    partnerCooperative: false,
    topicFamiliar: true,
    /* No support permitted: the reveal flow is post-response self-check,
     * never pre-response scaffolding. Any flagged support violates the
     * condition and demotes the attempt to SUPPORTED, never INDEPENDENT. */
    supportAllowed: [],
  },
  language: { chunks: [], constructions: [], vocabulary: [] },
  /* The pilot mints practiced INDEPENDENT evidence only — retention and
   * transfer are later contract coverage, not implied by this cap. */
  evidence: { independentRequired: true, delayedRequired: false, transferRequired: false },
  vietnameseRiskProbes: [],
  criteria: { meaningDelivered: false, intelligibleEnoughForPartner: false, requiredFunctions: [] },
};

const SIGNATURE = {
  /* A stored definition cues written recall of the target form — the
   * learner never sees the answer-bearing word before producing it. */
  cueTopology: 'definition_to_form',
  setting: 'self_paced_practice',
  register: 'neutral',
  channel: 'typed',
  lexicalDomain: 'learned_vocabulary',
  responseTopology: 'single_orthographic_form',
};

export const MISSION_VOCABULARY_PRACTICE = makeMission({
  id: 'mission.vocabulary_practice.v1',
  revision: 1,
  scenario: 'Review a learned wordbook item by writing its form from its definition.',
  learnerGoal: 'Recall the written form of a familiar vocabulary item.',
  /* Carrier, not target: the mission rehearse-carries the capability but
   * owes it no diagnostic baseline, delayed-retrieval, transfer or
   * assessment package — those are later contract coverage. */
  carrierCapabilities: [CAP_ID],
  language: {
    assumedKnown: { chunks: [], vocabulary: [], constructions: [] },
    introduced: { chunks: [], vocabulary: [], constructions: [] },
  },
  taskIds: ['task.vocab.spelling.v1'],
});

export const TASK_VOCAB_SPELLING = makeTask({
  id: 'task.vocab.spelling.v1',
  missionId: MISSION_VOCABULARY_PRACTICE.id,
  capabilityId: CAP_ID,
  modality: 'writing',
  purpose: 'retrieval',
  promptFamily: canonicalFamilyId(CAP_ID, SIGNATURE, 1),
  contextSignature: SIGNATURE,
  response: { type: 'text', requiredFunctions: [] },
  /* The deterministic exact-match evaluator scores response against the
   * authoritative target resolved inside the semantic-commit transaction —
   * never against caller-supplied context. */
  evaluation: { authority: 'deterministic', contractId: 'eval.exact_match.v1' },
  freshness: { required: false, familyClass: 'practiced' },
  supportPolicy: { allowed: [] },
});
