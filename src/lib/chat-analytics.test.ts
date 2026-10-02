import { afterEach, expect, it, vi } from 'vitest';

const tables = vi.hoisted(() => ({ contents: vi.fn(), sessions: vi.fn(), records: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: Object.fromEntries(Object.entries(tables).map(([key, toArray]) => [key, { toArray }])) }));
import { collectLearningSnapshot } from './chat-analytics';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('derives AI streak from completed sessions, independent of stale legacy plan storage', async () => {
  vi.useFakeTimers();
  const now = new Date(2026, 8, 8, 12).getTime();
  vi.setSystemTime(now);
  vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'echotype_daily_plan' ? JSON.stringify({ streak: 99 }) : null });
  tables.contents.mockResolvedValue([]);
  tables.records.mockResolvedValue([]);
  tables.sessions.mockResolvedValue([
    { completed: true, startTime: now, module: 'listen' },
    { completed: true, startTime: now - 86400000, module: 'listen' },
    { completed: false, startTime: now - 172800000, module: 'listen' },
  ]);
  expect((await collectLearningSnapshot()).overview.streak).toBe(2);
});

it('never puts the placement estimate into the machine-consumed snapshot (W2-G03)', async () => {
  const getItem = vi.fn((key: string) =>
    key === 'echotype_assessment'
      ? JSON.stringify({
          placement: { levelEstimate: 'C2', source: 'chat_tool', method: 'chat_tool', score: null, completedAt: 1, version: 1 },
          currentLevel: 'C2',
        })
      : null,
  );
  vi.stubGlobal('localStorage', { getItem });
  tables.contents.mockResolvedValue([]);
  tables.records.mockResolvedValue([]);
  tables.sessions.mockResolvedValue([]);

  const snapshot = await collectLearningSnapshot();
  const serialized = JSON.stringify(snapshot);

  expect(serialized).not.toContain('C2');
  expect(serialized).not.toMatch(/cefr|levelEstimate|placement/i);
  expect(getItem).not.toHaveBeenCalledWith('echotype_assessment');
});
