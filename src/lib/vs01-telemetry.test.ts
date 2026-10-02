import { describe, expect, it } from 'vitest';
import type { ContentItem, TypingSession } from '@/types/content';
import type { LearningAttempt } from '@/types/learning-activity';
import { deriveVs01Records, type Vs01TelemetryInput } from './vs01-telemetry';
import { VS01_TARGETS } from './vs01-targets';

const T0 = 1_800_000_000_000; // fixed epoch-ish anchor for deterministic tests
const HOUR = 3_600_000;
const DAY = 86_400_000;
const SOURCE_ID = 'article-random-install-id';
const LESSON = 'unit:category:daily:lesson:testlesson';
const SOURCE_TEXT =
  "Every morning, I wake up at seven o'clock. First, I brush my teeth and wash my face. Then I go to the kitchen to make breakfast. I usually have toast with butter and a glass of orange juice. After breakfast, I get dressed and check my bag for school. I like to leave the house early so I can walk slowly and enjoy the fresh air. On the way, I sometimes see my neighbors walking their dogs. When I arrive at school, I feel ready to start a new day of learning.";

const contents: ContentItem[] = [
  {
    id: SOURCE_ID, // deliberately random — must never be assumed
    title: 'My Morning Routine',
    text: SOURCE_TEXT,
    type: 'article',
    tags: [],
    source: 'builtin',
    createdAt: 1,
    updatedAt: 1,
  },
];

let counter = 0;
function attempt(overrides: Partial<LearningAttempt>): LearningAttempt {
  return {
    id: `att-${counter++}`,
    lessonId: LESSON,
    unitId: 'unit:category:daily',
    activity: 'comprehension',
    sourceContentIds: [SOURCE_ID],
    sourceText: SOURCE_TEXT,
    prompt: 'p',
    answer: 'a',
    feedback: { source: 'self', notes: 'n', checklist: [] },
    status: 'submitted',
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

let sessionCounter = 0;
function session(targetId: string, at: number, completed: boolean): TypingSession {
  return {
    id: `ses-${sessionCounter++}`,
    contentId: targetId,
    module: 'write',
    startTime: at - 10_000,
    endTime: at,
    totalChars: 10,
    correctChars: completed ? 10 : 0,
    wrongChars: 0,
    totalWords: 2,
    wpm: 0,
    accuracy: completed ? 100 : 0,
    completed,
  };
}

function comprehension(opts: { at?: number; translated?: boolean } = {}): LearningAttempt {
  return attempt({
    activity: 'comprehension',
    answer: 'The text describes a calm morning routine.',
    evidenceQuote: 'wake up at seven',
    usedTranslation: opts.translated,
    createdAt: opts.at ?? T0,
  });
}

function output(at: number, answer: string): LearningAttempt {
  return attempt({ id: `out-${at}`, activity: 'writing', answer, createdAt: at });
}

function cycleRecall(at: number, refId: string, rating: 'again' | 'hard' | 'good' | 'easy', assisted = false) {
  return attempt({
    id: `rec-${at}`,
    activity: 'writing',
    answer: 'I remembered the routine: waking, breakfast, leaving early.',
    cycle: { stage: 'recall', referenceAttemptId: refId, rating, assisted, sourceRevealed: assisted },
    createdAt: at,
  });
}

function applyAttempt(at: number, refId: string, expression: string, context: string, answer: string) {
  return attempt({
    id: `app-${at}`,
    activity: 'personal-example',
    answer,
    cycle: { stage: 'apply', referenceAttemptId: refId, expression, context },
    createdAt: at,
  });
}

function base(overrides: Partial<Vs01TelemetryInput> = {}): Vs01TelemetryInput {
  return { contents, attempts: [], sessions: [], now: T0 + 2 * DAY, ...overrides };
}

const T1 = VS01_TARGETS[0]; // "wake up at"

describe('vs01-telemetry', () => {
  it('reports not-attempted cleanly when nothing happened', () => {
    const [r] = deriveVs01Records(base());
    expect(r.targetId).toBe(T1.id);
    expect(r.sourceId).toBe(SOURCE_ID);
    expect(r.understanding).toBe('not-demonstrated');
    expect(r.immediateRecall).toBe('not-attempted');
    expect(r.failureReason).toBe('UNDERSTANDING_NOT_DEMONSTRATED');
  });

  it('scenario: understood but immediate recall failed', () => {
    const [r] = deriveVs01Records(
      base({ attempts: [comprehension()], sessions: [session(T1.id, T0 + HOUR, false)] }),
    );
    expect(r.understanding).toBe('independent');
    expect(r.immediateRecall).toBe('fail');
    expect(r.immediateAttemptCount).toBe(1);
    expect(r.immediateRecoveredAt).toBeUndefined();
    expect(r.failureReason).toBe('IMMEDIATE_RECALL_FAILED');
  });

  it('scenario: immediate fail then retry success — first attempt still counts', () => {
    const [r] = deriveVs01Records(
      base({
        attempts: [comprehension()],
        sessions: [session(T1.id, T0 + HOUR, false), session(T1.id, T0 + HOUR + 60_000, true)],
      }),
    );
    expect(r.immediateRecall).toBe('fail');
    expect(r.immediateRecoveredAt).toBe(T0 + HOUR + 60_000);
    expect(r.immediateAttemptCount).toBe(2);
    expect(r.delayedEligibleAt).toBe(T0 + HOUR + 60_000 + DAY); // anchored on first SUCCESS
  });

  it('scenario: practice before 24h is not delayed evidence and does not move the anchor', () => {
    const sessions = [
      session(T1.id, T0, true), // first success
      session(T1.id, T0 + HOUR, false), // pre-anchor practice — must not count
      session(T1.id, T0 + DAY + HOUR, true), // >= anchor+24h → delayed
    ];
    const [r] = deriveVs01Records(base({ sessions, now: T0 + DAY + HOUR + 1 }));
    expect(r.delayedEligibleAt).toBe(T0 + DAY);
    expect(r.delayedAttemptAt).toBe(T0 + DAY + HOUR);
    expect(r.delayedRecall).toBe('pass');
    // R1: mid-window practice is inert — immediate window closed at firstSuccess
    expect(r.immediateRecall).toBe('pass');
    expect(r.immediateAttemptCount).toBe(1);
  });

  it('R1 pin: fail, fail, success, +2h practice — immediateAttemptCount = 3', () => {
    const sessions = [
      session(T1.id, T0, false),
      session(T1.id, T0 + 60_000, false),
      session(T1.id, T0 + 120_000, true), // first success — window closes here
      session(T1.id, T0 + 2 * HOUR, true), // mid-window practice: inert
    ];
    const [r] = deriveVs01Records(base({ attempts: [comprehension()], sessions }));
    expect(r.immediateRecall).toBe('fail');
    expect(r.immediateAttemptCount).toBe(3);
    expect(r.immediateRecoveredAt).toBe(T0 + 120_000);
  });

  it('R1 pin: Day1 fail→success, Day2 delayed fail→success — the dogfood shape', () => {
    const sessions = [
      session(T1.id, T0, false), // Day1 miss
      session(T1.id, T0 + 60_000, true), // Day1 recovered → anchor
      session(T1.id, T0 + DAY + HOUR, false), // Day2 first delayed = fail
      session(T1.id, T0 + DAY + 2 * HOUR, true), // Day2 retry
    ];
    const [r] = deriveVs01Records(base({ attempts: [comprehension()], sessions, now: T0 + DAY + 3 * HOUR }));
    expect(r.immediateRecall).toBe('fail');
    expect(r.immediateAttemptCount).toBe(2);
    expect(r.immediateRecoveredAt).toBe(T0 + 60_000);
    expect(r.delayedEligibleAt).toBe(T0 + 60_000 + DAY);
    expect(r.delayedRecall).toBe('fail'); // first delayed attempt owns the outcome
    expect(r.delayedAttemptAt).toBe(T0 + DAY + HOUR);
  });

  it('pre-24h-only practice leaves delayed recall not-attempted once due', () => {
    const sessions = [session(T1.id, T0, true), session(T1.id, T0 + 2 * HOUR, true)];
    const [r] = deriveVs01Records(base({ sessions, now: T0 + DAY + HOUR }));
    expect(r.delayedRecall).toBe('not-attempted');
    expect(r.delayedAttemptAt).toBeUndefined();
  });

  it('before eligibility the delayed state is not-due', () => {
    const [r] = deriveVs01Records(base({ sessions: [session(T1.id, T0, true)], now: T0 + HOUR }));
    expect(r.delayedRecall).toBe('not-due');
    expect(r.delayedEligibleAt).toBe(T0 + DAY);
  });

  it('scenario: first delayed attempt wrong → FAIL even when a later retry passes', () => {
    const sessions = [
      session(T1.id, T0, true),
      session(T1.id, T0 + DAY + 1000, false), // first delayed = fail
      session(T1.id, T0 + DAY + 5_000, true), // retry cannot rewrite it
    ];
    const [r] = deriveVs01Records(base({ attempts: [comprehension()], sessions, now: T0 + DAY + 10_000 }));
    expect(r.delayedRecall).toBe('fail');
    expect(r.delayedAttemptAt).toBe(T0 + DAY + 1000);
    expect(r.immediateAttemptCount).toBe(1); // delayed retries never inflate the immediate count
    expect(r.failureReason).toBe('DELAYED_RECALL_FAILED');
  });

  it('scenario: recalled but did not produce the chunk in generic writing', () => {
    const [r] = deriveVs01Records(
      base({
        attempts: [comprehension(), output(T0 + 2 * HOUR, 'My mornings are quiet and slow.')],
        sessions: [session(T1.id, T0 + HOUR, true)],
        now: T0 + 2 * HOUR,
      }),
    );
    expect(r.production).toBe('absent');
    expect(r.failureReason).toBe('PRODUCTION_ABSENT');
  });

  it('scenario: produced the chunk unprompted but no valid transfer', () => {
    const [r] = deriveVs01Records(
      base({
        attempts: [comprehension(), output(T0 + 2 * HOUR, 'On Sundays I wake up at nine instead.')],
        sessions: [session(T1.id, T0 + HOUR, true)],
        now: T0 + 2 * HOUR,
      }),
    );
    expect(r.production).toBe('used-unprompted');
    expect(r.transferMechanicalOutcome).toBe('not-attempted');
    // nothing proven failed yet — the pipeline is pending, not failed
    expect(r.failureReason).toBeUndefined();
  });

  it('a proven recall stage followed by no transfer emits TRANSFER_NOT_COMPLETED', () => {
    const out = attempt({ id: 'o1', activity: 'writing', answer: 'I wake up at eight on weekends.', createdAt: T0 + HOUR });
    const corr = attempt({
      id: 'c1', activity: 'writing', answer: 'Calm slow mornings.', parentAttemptId: 'o1',
      status: 'revised', feedback: { source: 'self', notes: 'x', checklist: [] }, createdAt: T0 + 2 * HOUR,
    });
    const rec = cycleRecall(T0 + 2 * HOUR + DAY, 'c1', 'good');
    const [r] = deriveVs01Records(
      base({ attempts: [comprehension(), out, corr, rec], now: T0 + 2 * DAY + 3 * HOUR }),
    );
    expect(r.cycleRecall).toBe('pass');
    expect(r.transferMechanicalOutcome).toBe('not-attempted');
    expect(r.failureReason).toBe('TRANSFER_NOT_COMPLETED');
  });

  it('scenario: full chain — valid transfer passes', () => {
    const out = attempt({ id: 'out-A', activity: 'writing', answer: 'My mornings are calm.', createdAt: T0 + 2 * HOUR });
    const corr = attempt({
      id: 'cor-A',
      activity: 'writing',
      answer: 'I wake up at six on weekdays now.',
      parentAttemptId: 'out-A',
      status: 'revised',
      feedback: { source: 'self', notes: 'added time detail', checklist: [] },
      createdAt: T0 + 3 * HOUR,
    });
    const rec = cycleRecall(T0 + 3 * HOUR + DAY, 'cor-A', 'good');
    const app = applyAttempt(
      T0 + 3 * HOUR + DAY + HOUR,
      'cor-A',
      'wake up at',
      'on my last holiday in Da Lat',
      'On holiday I wake up at ten because nobody is waiting.',
    );
    const [r] = deriveVs01Records(
      base({
        attempts: [comprehension(), out, corr, rec, app],
        sessions: [session(T1.id, T0 + HOUR, true), session(T1.id, T0 + DAY + HOUR, true)],
        now: T0 + 3 * HOUR + DAY + 2 * HOUR,
      }),
    );
    expect(r.cycleRecall).toBe('pass');
    expect(r.transferMechanicalOutcome).toBe('pass');
    expect(r.transferAttemptId).toBe(app.id);
    expect(r.failureReason).toBeUndefined();
  });

  it('assisted lesson recall surfaces ASSISTED_RECALL, not a silent pass', () => {
    const out = attempt({ id: 'o1', activity: 'writing', answer: 'Quiet morning text.', createdAt: T0 + HOUR });
    const corr = attempt({
      id: 'c1', activity: 'writing', answer: 'Quieter morning text.', parentAttemptId: 'o1',
      status: 'revised', feedback: { source: 'self', notes: 'x', checklist: [] }, createdAt: T0 + 2 * HOUR,
    });
    const rec = cycleRecall(T0 + 2 * HOUR + DAY, 'c1', 'good', true); // assisted
    const [r] = deriveVs01Records(
      base({ attempts: [comprehension(), out, corr, rec], now: T0 + 2 * DAY + 3 * HOUR }),
    );
    expect(r.cycleRecall).toBe('assisted');
    expect(r.failureReason).toBe('ASSISTED_RECALL');
  });

  it('translation-supported comprehension is not independent', () => {
    const [r] = deriveVs01Records(base({ attempts: [comprehension({ translated: true })] }));
    expect(r.understanding).toBe('supported');
    expect(r.failureReason).toBeUndefined();
  });

  it('human-only failure reasons arrive only via humanNotes', () => {
    const input = base({ humanNotes: { [T1.id]: { failureReason: 'TRANSFER_CONTEXT_TOO_CLOSE', notes: 'same situation' } } });
    const [r] = deriveVs01Records(input);
    expect(r.failureReason).toBe('TRANSFER_CONTEXT_TOO_CLOSE');
    expect(r.notes).toBe('same situation');
    // never fabricated by the reader itself
    const [plain] = deriveVs01Records(base());
    expect(plain.failureReason).not.toBe('TRANSFER_CONTEXT_TOO_CLOSE');
    expect(plain.failureReason).not.toBe('EVALUATION_UNTRUSTWORTHY');
  });

  it('missing source article fails closed: sourceId null, targets still reported', () => {
    const [r] = deriveVs01Records(base({ contents: [] }));
    expect(r.sourceId).toBeNull();
    expect(r.targetId).toBe(T1.id);
  });
});
