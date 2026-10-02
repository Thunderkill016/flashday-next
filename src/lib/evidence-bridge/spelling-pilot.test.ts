import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { canonicalExactText } from '@/vnext/normalize';
import { EVALUATORS } from '@/vnext/evaluators';
import { checkCurriculum } from '@/vnext/curriculum-checks';
import { currentLearnerId, db } from '../db';
import { normalizeSpelling, spellingMatches } from '../vocabulary';
import { importVocabulary, saveVocabularySubmission } from '../vocabulary-repository';
import { LEGACY_CONTRACT_AUDIT, mapLegacyAttempt, type LegacyAction } from './adapter';
import { projectState, submitAttempt } from './bridge';
import { fixtureRegistry } from './registry';
import { createDexieEventStore } from './store';
import type { EvidenceEvent } from './types';

/*
 * W2-02.5 — vocabulary:spelling contract pilot.
 *
 * One real legacy action crosses the seam onto a real registered contract:
 * typed response → deterministic exact-match evaluator → narrow capability
 * (production.write.lexical_form_recall) → atomic history + EvidenceEvent.
 *
 * The scoring TARGET is never caller-supplied — the seam resolves it from
 * the authoritative ContentItem inside the same transaction, and the event
 * stamps what was scored (scoredAgainst) so replay can audit it forever.
 */

const registry = fixtureRegistry();
const LEARNER = currentLearnerId();
const SPELLING_TASK = 'task.vocab.spelling.v1';
const SPELLING_CAP = 'production.write.lexical_form_recall';
const EXACT_MATCH = 'eval.exact_match.v1';

const spellingAction = (over: Partial<LegacyAction> = {}): LegacyAction => ({
  id: 'sp-1',
  kind: 'vocabulary',
  mode: 'spelling',
  occurredAt: 1000,
  response: 'helpful',
  contentId: 'content-1',
  ...over,
});

const events = () => db.evidenceEvents.toArray();

/** Register a word through the real producer path. */
const seedWord = async (word = 'helpful', meaning = '有帮助的') => {
  await importVocabulary('Words', `word,meaning\n${word},${meaning}`);
  return (await db.contents.toArray())[0];
};

const submitSpelling = (
  id: string,
  contentId: string,
  answer: string,
  over: Record<string, unknown> = {},
) =>
  saveVocabularySubmission(
    { id, contentId, mode: 'spelling', answer, revealed: true, rating: 3, ...over },
    db,
    1000,
  );

beforeEach(async () => {
  await Promise.all([
    db.contents.clear(),
    db.books.clear(),
    db.importJobs.clear(),
    db.records.clear(),
    db.sessions.clear(),
    db.learningAttempts.clear(),
    db.dailyTasks.clear(),
    db.evidenceEvents.clear(),
  ]);
});

/* ── §6/§7 — evaluator contract + canonical normalization ── */

describe('eval.exact_match.v1 — deterministic exact-match scorer', () => {
  const score = (response: unknown, scoring?: { target?: string }) =>
    EVALUATORS[EXACT_MATCH]?.score({} as never, response, { scoring } as never);

  it('is registered and declares no function attribution', () => {
    expect(EVALUATORS[EXACT_MATCH]).toBeTruthy();
    expect(EVALUATORS[EXACT_MATCH].contractId).toBe(EXACT_MATCH);
    expect(EVALUATORS[EXACT_MATCH].attributesFunctions).toBe(false);
  });

  it('scores normalized equality — success only on exact match, no partial', () => {
    expect(score('helpful', { target: 'helpful' })?.outcome).toBe('success');
    expect(score(' helpful ', { target: 'helpful' })?.outcome).toBe('success');
    expect(score('Helpful', { target: 'helpful' })?.outcome).toBe('success');
    expect(score('helpfull', { target: 'helpful' })?.outcome).toBe('fail');
    expect(score('[not recalled]', { target: 'helpful' })?.outcome).toBe('fail');
    expect(score('', { target: 'helpful' })?.outcome).toBe('fail');
    // { text } envelope — the pilot mapper's response shape.
    expect(score({ text: 'helpful' }, { target: 'helpful' })?.outcome).toBe('success');
  });

  it('is unscorable (null) without a trusted target — never guesses', () => {
    expect(score('helpful')).toBeNull();
    expect(score('helpful', {})).toBeNull();
    expect(score('helpful', { target: '' })).toBeNull();
    expect(score('helpful', { target: 42 as unknown as string })).toBeNull();
  });

  it('echoes the canonical target it scored — replay provenance', () => {
    const res = score('HELPFUL', { target: '  Helpful  ' });
    expect(res?.outcome).toBe('success');
    expect(res?.scoredTarget).toBe('helpful');
  });
});

describe('canonical normalization parity with legacy spelling (§7, §20)', () => {
  const cases: [string, string, boolean][] = [
    ['hello', 'Hello', true],
    ['  hello  ', 'hello', true],
    ['rock ’ n', "rock ' n", true],
    ['well–known', 'well-known', true],
    ['well—known', 'well-known', true],
    ['a   b', 'a b', true],
    ['naïve', 'naïve', true],
    ['', 'hello', false],
    ['helpfull', 'helpful', false],
    ['[not recalled]', 'helpful', false],
  ];
  it.each(cases)('canonicalExactText(%j) vs %j === legacy spellingMatches', (a, b, expected) => {
    expect(canonicalExactText(a) === canonicalExactText(b)).toBe(expected);
    // Single implementation: the legacy helper delegates, so parity is
    // structural — this corpus pins that it stays true.
    expect(spellingMatches(a, b)).toBe(expected || (!a.trim() ? false : expected));
  });
  it('normalizeSpelling delegates to the same canonical definition', () => {
    for (const v of ['  Well–Known  ', 'rock ’n’ roll', 'A  B', 'HELLO']) {
      expect(normalizeSpelling(v)).toBe(canonicalExactText(v));
    }
  });
});

/* ── §4/§12 — contract registration through the real authoring gate ── */

describe('pilot contracts pass the normal authoring gate (§11, §12)', () => {
  it('capability + task + mission register inside the canonical registry', () => {
    const task = registry.taskById(SPELLING_TASK);
    expect(task).toBeTruthy();
    expect(task?.capabilityId).toBe(SPELLING_CAP);
    expect(task?.modality).toBe('writing');
    expect(task?.purpose).toBe('retrieval');
    expect(task?.response?.type).toBe('text');
    expect(task?.evaluation?.authority).toBe('deterministic');
    expect(task?.evaluation?.contractId).toBe(EXACT_MATCH);
    expect(task?.freshness?.familyClass).toBe('practiced');
    const cap = registry.capabilityById(SPELLING_CAP);
    expect(cap).toBeTruthy();
    expect(cap?.modality).toBe('writing');
    const mission = registry.missionById('mission.vocabulary_practice.v1');
    expect(mission?.taskIds).toContain(SPELLING_TASK);
  });

  it('registry construction is the real checkCurriculum gate — no bypass', () => {
    const problems = checkCurriculum({
      capabilities: registry.capabilities as never,
      missions: registry.missions as never,
      tasks: registry.tasks as never,
    });
    expect(problems).toEqual([]);
  });
});

/* ── §8–§10 — trust boundary + scoring-target provenance ── */

describe('trusted scoring target — never UI-authored (§8, §9)', () => {
  const submission = (evaluationCtx?: Record<string, unknown>) => ({
    learnerId: LEARNER,
    taskId: SPELLING_TASK,
    occurredAt: 1000,
    attemptId: 'forge-1',
    response: { text: 'wrong' },
    evaluationCtx,
  });

  it('rejects a caller-supplied scoring target on the public surface', async () => {
    await expect(
      submitAttempt(createDexieEventStore(db.evidenceEvents), registry, {
        ...submission({ target: 'wrong' }),
      }),
    ).rejects.toThrow(/target|evaluationCtx|forge/i);
    expect(await db.evidenceEvents.count()).toBe(0);
  });

  it('rejects a caller-supplied scoring channel outright', async () => {
    await expect(
      submitAttempt(createDexieEventStore(db.evidenceEvents), registry, {
        ...submission({ scoring: { target: 'wrong' } }),
      }),
    ).rejects.toThrow();
    expect(await db.evidenceEvents.count()).toBe(0);
  });

  it('a deterministic contract with no trusted target refuses to mint', async () => {
    await expect(
      submitAttempt(createDexieEventStore(db.evidenceEvents), registry, submission()),
    ).rejects.toThrow();
    expect(await db.evidenceEvents.count()).toBe(0);
  });
});

/* ── §13/§14 — audit flip + action-specific mapper ── */

describe('vocabulary:spelling audit flip (§13, §14)', () => {
  it('exactly one action is MAPPED_SAFE; 14 remain blocked', () => {
    const safe = LEGACY_CONTRACT_AUDIT.filter((e) => e.status === 'MAPPED_SAFE');
    expect(safe.map((e) => e.action)).toEqual(['vocabulary:spelling']);
    expect(LEGACY_CONTRACT_AUDIT).toHaveLength(15);
  });

  it('mapper authors observed reality only — response, empty support, occurredAt', () => {
    const mapped = mapLegacyAttempt(spellingAction({ support: { context: 'ctx' } }));
    expect(mapped).toMatchObject({
      taskId: SPELLING_TASK,
      id: 'evt.sp-1',
      attemptId: 'sp-1',
      occurredAt: 1000,
      response: { text: 'helpful' },
    });
    // No answer-bearing or post-response support facts are authored.
    const support = (mapped?.support ?? {}) as Record<string, unknown>;
    expect(support.revealed).toBeUndefined();
    expect(support.modelAnswer).toBeUndefined();
    expect(support.context).toBeUndefined();
  });
});

/* ── §15/§16 — immutable attempt timestamp + canonical event id ── */

describe('immutable attempt boundary (§15, §16)', () => {
  it('the producer uses the submission-bound attempt timestamp for occurredAt', async () => {
    const word = await seedWord();
    await saveVocabularySubmission(
      { id: 'sp-ts', contentId: word.id, mode: 'spelling', answer: 'helpful', revealed: true, rating: 3, attemptedAt: 555 },
      db,
      999999, // wall-clock at persist time must NOT leak into the event
    );
    const [event] = await events();
    expect(event.occurredAt).toBe(555);
    expect(event.id).toBe('evt.sp-ts');
  });

  it('a retry with a fresh wall-clock but the same attempt timestamp dedupes', async () => {
    const word = await seedWord();
    const sub = { id: 'sp-re', contentId: word.id, mode: 'spelling' as const, answer: 'helpful', revealed: true, rating: 3, attemptedAt: 555 };
    await saveVocabularySubmission(sub, db, 1000);
    await saveVocabularySubmission(sub, db, 2000); // later wall-clock, same attempt
    expect(await db.learningAttempts.count()).toBe(1);
    expect(await db.evidenceEvents.count()).toBe(1);
    // A changed attempt timestamp on the same id is a divergent redelivery.
    await expect(
      saveVocabularySubmission({ ...sub, attemptedAt: 556 }, db, 3000),
    ).rejects.toThrow(/conflict/);
  });
});

/* ── §21–§23 — atomic live path + projection ── */

describe('live spelling path through the seam (§21)', () => {
  it('a real spelling submission commits history + one bound event atomically', async () => {
    const word = await seedWord();
    await submitSpelling('sp-live', word.id, 'helpful');
    expect(await db.learningAttempts.get('sp-live')).toBeTruthy();
    const [event] = await events();
    expect(event).toMatchObject({
      id: 'evt.sp-live',
      taskId: SPELLING_TASK,
      capabilityId: SPELLING_CAP,
      modality: 'writing',
      learnerId: LEARNER,
    });
    expect(event.attempt?.attemptId).toBe('sp-live');
    expect(event.attempt?.outcome).toBe('success');
    expect(event.evaluation?.authority).toBe('deterministic');
    expect(event.evaluation?.contractId).toBe(EXACT_MATCH);
  });

  it('the event stamps scoring provenance — contentId + scored target (§10)', async () => {
    const word = await seedWord();
    await submitSpelling('sp-prov', word.id, 'helpful');
    const [event] = (await events()) as (EvidenceEvent & {
      evaluation?: { scoredAgainst?: { contentId?: string; scoredTarget?: string } };
    })[];
    expect(event.evaluation?.scoredAgainst).toMatchObject({
      contentId: word.id,
      scoredTarget: 'helpful',
    });
  });

  it('wrong answer mints a fail event — never SUPPORTED, never laundered by rating', async () => {
    const word = await seedWord();
    await submitSpelling('sp-fail', word.id, 'helpfull', { rating: 4 });
    const [event] = await events();
    expect(event.attempt?.outcome).toBe('fail');
    const projection = await projectState(LEARNER, createDexieEventStore(db.evidenceEvents), registry);
    const slot = projection.byCapability.get(SPELLING_CAP);
    expect(slot?.milestones.independent).toBe(false);
    expect(slot?.lastAttemptOutcome).toBe('fail');
    expect(slot?.milestones.exposed).toBe(true);
  });

  it("'[not recalled]' scores fail through the evaluator — no special-casing (§19)", async () => {
    const word = await seedWord();
    await submitSpelling('sp-none', word.id, '[not recalled]', { rating: 1 });
    const [event] = await events();
    expect(event.attempt?.outcome).toBe('fail');
  });

  it('unaided success promotes only the narrow capability (§5, §23)', async () => {
    const word = await seedWord();
    await submitSpelling('sp-proj', word.id, 'helpful');
    const projection = await projectState(LEARNER, createDexieEventStore(db.evidenceEvents), registry);
    const touched = [...projection.byCapability.entries()].filter(([, s]) => s.lastEventAt != null);
    expect(touched.map(([id]) => id)).toEqual([SPELLING_CAP]);
    const slot = touched[0][1];
    expect(slot.milestones.independent).toBe(true);
    expect(slot.milestones.retained).toBe(false);
    expect(slot.milestones.transferred).toBe(false);
    expect(slot.milestones.fluent).toBe(false);
    // The overclaim guard: INDEPENDENT here must never touch unrelated caps.
    expect(projection.byCapability.get('production.write.personal_info_short')?.lastEventAt).toBeNull();
  });
});

/* ── §25 — adversarial ── */

describe('adversarial pilot paths (§25)', () => {
  it('rating cannot override deterministic truth (§17)', async () => {
    await importVocabulary('Words', 'word,meaning\nhelpful,有帮助的\nportable,便携的');
    const [w1, w2] = await db.contents.toArray();
    await submitSpelling('sp-r1', w1.id, 'helpful', { rating: 2 });
    let [event] = await events();
    expect(event.attempt?.outcome).toBe('success');
    // A confident self-rating on a wrong spelling still scores fail —
    // the deterministic evaluator owns the outcome, not the rating.
    await submitSpelling('sp-r2', w2.id, 'portible', { rating: 4 });
    [, event] = await events();
    expect(event.attempt?.outcome).toBe('fail');
  });

  it('post-response reveal does not land in event.support (§3, §18)', async () => {
    const word = await seedWord();
    await submitSpelling('sp-rev', word.id, 'helpful');
    const [event] = await events();
    const support = (event.support ?? {}) as Record<string, unknown>;
    expect(support.revealed).toBeUndefined();
    expect(support.modelAnswer).toBe(false);
    expect(support.hint).toBe(false);
  });

  it('a target mutation between retries is divergent — conflict, not silent dedupe', async () => {
    const word = await seedWord();
    const sub = {
      id: 'sp-mut',
      contentId: word.id,
      mode: 'spelling' as const,
      answer: 'helpful',
      revealed: true,
      rating: 3,
      attemptedAt: 555,
    };
    await saveVocabularySubmission(sub, db, 1000);
    // The word's title changed after the first commit — the resolver now
    // reads a different authoritative target, so the re-delivered event
    // cannot claim the old scoredTarget. Canonical conflict, not dedupe.
    await db.contents.update(word.id, { title: 'helpfull' });
    await expect(saveVocabularySubmission(sub, db, 2000)).rejects.toThrow(/conflict/);
    expect(await db.evidenceEvents.count()).toBe(1);
    expect((await events())[0].attempt?.response).toEqual({ text: 'helpful' });
  });

  it('content deleted before commit fails closed — nothing mints (§22)', async () => {
    const word = await seedWord();
    const sub = {
      id: 'sp-del',
      contentId: word.id,
      mode: 'spelling' as const,
      answer: 'helpful',
      revealed: true,
      rating: 3,
      attemptedAt: 555,
    };
    // The UI snapshot is the submission; deletion before persistence must
    // roll the whole semantic commit back — no orphan event.
    await db.contents.delete(word.id);
    await expect(saveVocabularySubmission(sub, db, 1000)).rejects.toThrow();
    expect(await db.evidenceEvents.count()).toBe(0);
    expect(await db.learningAttempts.count()).toBe(0);
  });
});
