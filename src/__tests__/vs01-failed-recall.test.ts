import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toLocalDateKey } from '@/lib/date-key';
import type { ContentItem, LearningRecord, TypingSession } from '@/types/content';

let mockContents: ContentItem[] = [];
let mockRecords: LearningRecord[] = [];
let mockSessions: TypingSession[] = [];

vi.mock('@/lib/db', () => {
  const createWhereChain = (items: () => any[], field: string) => ({
    equals: (value: string | number) => ({
      toArray: async () => items().filter((item) => item[field] === value),
      first: async () => items().find((item) => item[field] === value),
    }),
  });

  return {
    db: {
      transaction: async (_mode: string, _tables: unknown[], run: () => Promise<void>) => run(),
      contents: {
        toArray: async () => mockContents,
        where: (field: string) => createWhereChain(() => mockContents, field),
        get: async (id: string) => mockContents.find((item) => item.id === id),
        put: async (content: ContentItem) => {
          const index = mockContents.findIndex((item) => item.id === content.id);
          if (index >= 0) mockContents[index] = content;
          else mockContents.push(content);
        },
        bulkAdd: async (items: ContentItem[]) => {
          for (const item of items) {
            if (mockContents.some((c) => c.id === item.id)) throw new Error('ConstraintError');
            mockContents.push(item);
          }
        },
        bulkPut: async (items: ContentItem[]) => {
          for (const item of items) {
            const index = mockContents.findIndex((c) => c.id === item.id);
            if (index >= 0) mockContents[index] = item;
            else mockContents.push(item);
          }
        },
      },
      records: {
        toArray: async () => mockRecords,
        where: (field: string) => createWhereChain(() => mockRecords, field),
        put: async (record: LearningRecord) => {
          const index = mockRecords.findIndex((item) => item.id === record.id);
          if (index >= 0) mockRecords[index] = record;
          else mockRecords.push(record);
        },
      },
      sessions: {
        toArray: async () => mockSessions,
        add: async (session: TypingSession) => {
          mockSessions.push(session);
        },
      },
    },
  };
});

const { recordFailedPracticeSession, syncPlanTasks } = await import('@/lib/daily-plan-progress');
const { seedVs01Dogfood } = await import('@/lib/seed');
const { VS01_TARGETS, VS01_CATEGORY } = await import('@/lib/vs01-targets');

const NOW = new Date('2026-03-12T09:00:00+08:00').getTime();

function failedSession(overrides: Partial<TypingSession> = {}): TypingSession {
  return {
    id: 'miss-1',
    contentId: 'vs01.wake-up-at',
    module: 'write',
    startTime: NOW - 5000,
    endTime: NOW,
    totalChars: 10,
    correctChars: 0,
    wrongChars: 0,
    totalWords: 3,
    wpm: 0,
    accuracy: 0,
    completed: false,
    ...overrides,
  };
}

function completedSession(overrides: Partial<TypingSession> = {}): TypingSession {
  return { ...failedSession(), id: 'hit-1', accuracy: 100, correctChars: 10, completed: true, ...overrides };
}

describe('recordFailedPracticeSession (VS01 correction #1)', () => {
  beforeEach(() => {
    mockContents = [];
    mockRecords = [];
    mockSessions = [];
  });

  it('appends the miss as a completed:false session', async () => {
    await recordFailedPracticeSession(failedSession());
    expect(mockSessions).toHaveLength(1);
    expect(mockSessions[0].completed).toBe(false);
    expect(mockSessions[0].accuracy).toBe(0);
    expect(mockSessions[0].contentId).toBe('vs01.wake-up-at');
  });

  it('never creates or mutates a LearningRecord — no FSRS grade, no nextReview', async () => {
    mockRecords = [
      {
        id: 'r1',
        contentId: 'vs01.wake-up-at',
        module: 'write',
        attempts: 3,
        correctCount: 3,
        accuracy: 100,
        lastPracticed: NOW - 86_400_000,
        nextReview: NOW + 86_400_000,
        fsrsCard: { due: 1, stability: 1, difficulty: 1, elapsed_days: 0, scheduled_days: 1, reps: 1, lapses: 0, state: 2, last_review: NOW - 10_000 },
        mistakes: [],
      },
    ];
    const before = structuredClone(mockRecords[0]);
    await recordFailedPracticeSession(failedSession());
    expect(mockRecords).toHaveLength(1);
    expect(mockRecords[0]).toEqual(before);
  });

  it('a retry after a miss can still succeed on the normal path', async () => {
    const { savePracticeSession } = await import('@/lib/daily-plan-progress');
    await recordFailedPracticeSession(failedSession());
    await savePracticeSession(completedSession());
    expect(mockSessions).toHaveLength(2);
    expect(mockSessions[0].completed).toBe(false);
    expect(mockSessions[1].completed).toBe(true);
    expect(mockRecords).toHaveLength(1); // only the success created a record
  });
});

describe('syncPlanTasks — failed sessions are not completion evidence (correction #2)', () => {
  beforeEach(() => {
    mockContents = [];
    mockRecords = [];
    mockSessions = [];
  });

  const contentTask = () => [
    {
      id: 'task-1',
      type: 'article' as const,
      title: 'Practice item',
      description: '',
      module: 'write' as const,
      contentId: 'vs01.wake-up-at',
      completed: false,
      skipped: false,
    },
  ];

  it('failed session alone leaves a content task pending', () => {
    mockSessions = [failedSession()];
    const synced = syncPlanTasks(contentTask(), {
      contents: mockContents,
      records: mockRecords,
      sessions: mockSessions,
      dayKey: toLocalDateKey(NOW),
    });
    expect(synced[0].completed).toBe(false);
  });

  it('failed + completed session completes the content task', () => {
    mockSessions = [failedSession(), completedSession()];
    const synced = syncPlanTasks(contentTask(), {
      contents: mockContents,
      records: mockRecords,
      sessions: mockSessions,
      dayKey: toLocalDateKey(NOW),
    });
    expect(synced[0].completed).toBe(true);
  });

  it('failed sessions do not count toward book/category unique-item goals', () => {
    mockContents = [
      { id: 'vs01.a', title: 'a', text: 'a', type: 'word', category: VS01_CATEGORY, tags: [], source: 'builtin', createdAt: 1, updatedAt: 1 },
      { id: 'vs01.b', title: 'b', text: 'b', type: 'word', category: VS01_CATEGORY, tags: [], source: 'builtin', createdAt: 1, updatedAt: 1 },
    ];
    mockSessions = [
      failedSession({ id: 'm1', contentId: 'vs01.a' }),
      failedSession({ id: 'm2', contentId: 'vs01.b' }),
      completedSession({ id: 'c1', contentId: 'vs01.a' }),
    ];
    const synced = syncPlanTasks(
      [
        {
          id: 'task-book',
          type: 'new-words' as const,
          title: 'Learn 2 chunks',
          description: '',
          module: 'write' as const,
          bookId: VS01_CATEGORY,
          limit: 2,
          completed: false,
          skipped: false,
        },
      ],
      { contents: mockContents, records: mockRecords, sessions: mockSessions, dayKey: toLocalDateKey(NOW) },
    );
    // only one unique item has a COMPLETED session — goal of 2 not met
    expect(synced[0].completed).toBe(false);
  });
});

describe('seedVs01Dogfood — deterministic idempotent seed', () => {
  beforeEach(() => {
    mockContents = [];
  });

  it('seeds exactly five items with stable vs01.* ids', async () => {
    await seedVs01Dogfood(NOW);
    expect(mockContents).toHaveLength(5);
    expect(mockContents.map((c) => c.id)).toEqual(VS01_TARGETS.map((t) => t.id));
    for (const item of mockContents) {
      expect(item.type).toBe('word');
      expect(item.category).toBe(VS01_CATEGORY);
      expect(item.tags).toContain('vs01');
    }
  });

  it('is idempotent — a second run adds nothing and never overwrites', async () => {
    await seedVs01Dogfood(NOW);
    mockContents[0] = { ...mockContents[0], text: 'learner-edited cue' };
    await seedVs01Dogfood(NOW + 1000);
    expect(mockContents).toHaveLength(5);
    expect(mockContents[0].text).toBe('learner-edited cue');
  });

  it('existing installs receive only the missing items', async () => {
    await seedVs01Dogfood(NOW);
    mockContents = mockContents.slice(0, 3); // simulate a partial prior state
    await seedVs01Dogfood(NOW + 1000);
    expect(mockContents).toHaveLength(5);
    expect(new Set(mockContents.map((c) => c.id)).size).toBe(5);
  });

  it('resurrects an item the learner deleted (bulkPut, no duplicate key)', async () => {
    await seedVs01Dogfood(NOW);
    mockContents[2] = { ...mockContents[2], deletedAt: NOW + 1 };
    await seedVs01Dogfood(NOW + 2000);
    expect(mockContents).toHaveLength(5);
    const resurrected = mockContents.find((c) => c.id === VS01_TARGETS[2].id);
    expect(resurrected?.deletedAt).toBeUndefined();
    expect(resurrected?.createdAt).toBe(NOW + 2000);
  });
});
