import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const savePhrase = vi.fn();
const state = {
  journals: [],
  loading: false,
  savePhrase,
  updatePhrase: vi.fn(),
  deletePhrase: vi.fn(),
  toggleHighlight: vi.fn(),
  materializePhraseForPractice: vi.fn(),
};

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/stores/journal-store', () => ({
  flattenJournalPhrases: () => [
    {
      journalId: 'legacy-journal',
      turnId: 'turn-1',
      text: "It's taken.",
      translation: '有人了。',
      context: 'At a cafe',
      sourceTitle: 'Coffee lesson',
      tags: ['cafe'],
      updatedAt: 1,
    },
  ],
  useJournalStore: (selector: (value: typeof state) => unknown) => selector(state),
}));

import { JournalList } from './journal-list';

describe('Useful Phrases page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders legacy turns as flat phrase rows and removes notebook controls', () => {
    const markup = renderToStaticMarkup(<JournalList />);
    expect(markup).toContain('Cụm từ hay');
    expect(markup).toContain('It&#x27;s taken.');
    expect(markup).toContain('有人了。');
    expect(markup).toContain('#cafe');
    expect(markup).not.toContain('Create notebook');
    expect(markup).not.toContain('Import');
  });

  it('keeps the composer compact while exposing searchable phrase controls', () => {
    const markup = renderToStaticMarkup(<JournalList />);
    expect(markup).toContain('aria-label="Cụm từ tiếng Anh"');
    expect(markup).toContain('Thêm chi tiết');
    expect(markup).toContain('aria-label="Tìm cụm từ"');
    expect(markup).toContain('aria-label="Lọc theo thẻ"');
    expect(markup).not.toContain('aria-label="Translation"');
  });

  it('provides accessible phrase and practice actions', () => {
    const markup = renderToStaticMarkup(<JournalList />);
    expect(markup).toContain('aria-label="Phát It&#x27;s taken."');
    expect(markup).toContain('aria-label="Thêm It&#x27;s taken. vào đã lưu"');
    expect(markup).toContain('aria-label="Sửa It&#x27;s taken."');
    expect(markup).toContain('aria-label="Xoá It&#x27;s taken."');
    for (const module of ['Nghe', 'Nói', 'Đọc', 'Viết']) expect(markup).toContain(`>${module}</button>`);
  });
});
