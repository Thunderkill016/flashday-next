import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
const bulkAddMock = vi.fn();
const contentsGetMock = vi.fn();
const contentsBulkGetMock = vi.fn();
const contentsBulkPutMock = vi.fn();
const collectionsBulkGetMock = vi.fn();
const collectionsBulkPutMock = vi.fn();
const countMock = vi.fn();
const sourceToArrayMock = vi.fn();
const categoryCountMock = vi.fn();
const loadWordBookItemsMock = vi.fn();

vi.stubGlobal('window', globalThis);
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => storage.clear(),
});

vi.mock('@/lib/db', () => ({
  db: {
    contents: {
      count: countMock,
      bulkAdd: bulkAddMock,
      get: contentsGetMock,
      bulkGet: contentsBulkGetMock,
      bulkPut: contentsBulkPutMock,
      where: (field: string) => ({
        equals: (value: string) => {
          if (field === 'source') {
            return { toArray: sourceToArrayMock };
          }
          if (field === 'category') {
            return { count: () => categoryCountMock(value) };
          }
          throw new Error(`Unexpected where().equals() field: ${field}`);
        },
      }),
    },
    favoriteFolders: {
      count: vi.fn().mockResolvedValue(0),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
    },
    collections: {
      bulkGet: collectionsBulkGetMock,
      bulkPut: collectionsBulkPutMock,
    },
  },
}));

vi.mock('@/lib/seed-data/articles', () => ({ builtinArticles: [] }));
vi.mock('@/lib/seed-data/phrases', () => ({ builtinPhrases: [] }));
vi.mock('@/lib/seed-data/sentences', () => ({ builtinSentences: [] }));
vi.mock('@/lib/seed-data/words', () => ({ builtinWords: [] }));
vi.mock('@/lib/wordbooks', () => ({
  loadWordBookItems: loadWordBookItemsMock,
}));

const { seedDatabase } = await import('@/lib/seed');

describe('seedDatabase starter packs', () => {
  beforeEach(() => {
    storage.clear();
    bulkAddMock.mockReset();
    contentsGetMock.mockReset();
    contentsBulkGetMock.mockReset();
    contentsBulkPutMock.mockReset();
    collectionsBulkGetMock.mockReset();
    collectionsBulkPutMock.mockReset();
    contentsGetMock.mockResolvedValue(undefined);
    /* Empty DB: every deterministic pack key resolves to undefined. */
    contentsBulkGetMock.mockImplementation(async (ids: string[]) => ids.map(() => undefined));
    collectionsBulkGetMock.mockImplementation(async (ids: string[]) => ids.map(() => undefined));
    countMock.mockReset();
    sourceToArrayMock.mockReset();
    categoryCountMock.mockReset();
    loadWordBookItemsMock.mockReset();

    countMock.mockResolvedValue(0);
    sourceToArrayMock.mockResolvedValue([]);
    categoryCountMock.mockResolvedValue(0);
    loadWordBookItemsMock.mockImplementation(async (bookId: string) => [
      {
        title: `${bookId}-item`,
        text: `${bookId} sample`,
        type: bookId.includes('office') || bookId.includes('coffee') || bookId.includes('restaurant') ? 'phrase' : 'word',
        category: bookId,
        tags: [bookId],
        source: 'builtin',
        difficulty: bookId === 'cet4' ? 'intermediate' : 'beginner',
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('imports the default starter books and scenarios on first run', async () => {
    await seedDatabase();

    expect(loadWordBookItemsMock).toHaveBeenCalledWith('daily-vocab');
    expect(loadWordBookItemsMock).toHaveBeenCalledWith('cet4');
    expect(loadWordBookItemsMock).toHaveBeenCalledWith('coffee-shop');
    expect(loadWordBookItemsMock).toHaveBeenCalledWith('restaurant');
    expect(loadWordBookItemsMock).toHaveBeenCalledWith('office-meeting');
    expect(storage.get('echotype_starter_packs_v1')).toBe('true');

    const seededCategories = bulkAddMock.mock.calls.flatMap(([items]) =>
      (items as Array<{ category?: string }>).map((item) => item.category),
    );

    expect(seededCategories).toEqual(
      expect.arrayContaining(['daily-vocab', 'cet4', 'coffee-shop', 'restaurant', 'office-meeting']),
    );
  });

  it('skips starter categories that already have content', async () => {
    categoryCountMock.mockImplementation(async (bookId: string) => (bookId === 'daily-vocab' ? 5 : 0));

    await seedDatabase();

    expect(loadWordBookItemsMock).not.toHaveBeenCalledWith('daily-vocab');
    expect(loadWordBookItemsMock).toHaveBeenCalledWith('cet4');
  });

  it('adds new community scenarios for an installation seeded before this resource expansion', async () => {
    storage.set('echotype_seeded_v6', 'true');

    await seedDatabase();

    const seededTitles = bulkAddMock.mock.calls.flatMap(([items]) =>
      (items as Array<{ title?: string }>).map((item) => item.title),
    );
    expect(seededTitles).toContain('Airport: reporting lost luggage');
  });

  it('R1: seedDatabase never seeds VS01 targets outside development', async () => {
    // vitest runs with NODE_ENV=test — the dev-only VS01 gate must not fire.
    await seedDatabase();

    /* contents.get is exclusive to seedVs01Dogfood; the fd01 pack seeds via
     * bulkGet/bulkPut, so the pin narrows to "no vs01 ids written". */
    expect(contentsGetMock).not.toHaveBeenCalled();
    const putIds = contentsBulkPutMock.mock.calls.flatMap(([items]) =>
      (items as Array<{ id?: string }>).map((item) => item.id),
    );
    expect(putIds.filter((id) => id?.startsWith('vs01.'))).toEqual([]);
    const seededIds = bulkAddMock.mock.calls.flatMap(([items]) =>
      (items as Array<{ id?: string }>).map((item) => item.id),
    );
    expect(seededIds.filter((id) => id?.startsWith('vs01.'))).toEqual([]);
  });

  it('NEXT_PUBLIC_VS01_DOGFOOD=1 opts a deployment into the pilot seed', async () => {
    vi.stubEnv('NEXT_PUBLIC_VS01_DOGFOOD', '1');

    await seedDatabase();

    const putIds = contentsBulkPutMock.mock.calls.flatMap(([items]) =>
      (items as Array<{ id?: string }>).map((item) => item.id),
    );
    expect(putIds.filter((id) => id?.startsWith('vs01.'))).toHaveLength(5);

    vi.unstubAllEnvs();
  });
});
