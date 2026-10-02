import { describe, expect, it } from 'vitest';
import type { ContentItem } from '@/types/content';
import { builtinArticles } from './seed-data/articles';
import {
  resolveVs01Source,
  VS01_CATEGORY,
  VS01_SOURCE_TITLE,
  VS01_TAG,
  VS01_TARGETS,
  vs01ContentItem,
  vs01CueText,
} from './vs01-targets';

const SOURCE_TEXT =
  "Every morning, I wake up at seven o'clock. First, I brush my teeth and wash my face. Then I go to the kitchen to make breakfast. I usually have toast with butter and a glass of orange juice. After breakfast, I get dressed and check my bag for school. I like to leave the house early so I can walk slowly and enjoy the fresh air. On the way, I sometimes see my neighbors walking their dogs. When I arrive at school, I feel ready to start a new day of learning.";

function fakeArticle(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: `random-${Math.random().toString(36).slice(2)}`,
    title: VS01_SOURCE_TITLE,
    text: SOURCE_TEXT,
    type: 'article',
    tags: [],
    source: 'builtin',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('vs01-targets fixture', () => {
  it('defines exactly five targets with deterministic vs01.* ids', () => {
    expect(VS01_TARGETS).toHaveLength(5);
    expect(VS01_TARGETS.map((t) => t.id)).toEqual([
      'vs01.wake-up-at',
      'vs01.a-glass-of',
      'vs01.leave-the-house',
      'vs01.on-the-way',
      'vs01.feel-ready-to',
    ]);
  });

  it('every recallTarget is a literal substring of its source sentence', () => {
    for (const target of VS01_TARGETS) {
      expect(target.sourceSentence.toLowerCase()).toContain(target.recallTarget.toLowerCase());
    }
  });

  it('every recallTarget is a literal substring of the real builtin article', () => {
    const article = builtinArticles.find((a) => a.title === VS01_SOURCE_TITLE);
    expect(article).toBeDefined();
    for (const target of VS01_TARGETS) {
      expect(article!.text.toLowerCase()).toContain(target.recallTarget.toLowerCase());
      expect(article!.text.toLowerCase()).toContain(target.sourceSentence.toLowerCase());
    }
  });

  it('no recallTarget uses <...> placeholder notation — exact-match must be literal', () => {
    for (const target of VS01_TARGETS) {
      expect(target.recallTarget).not.toMatch(/[<>]/);
    }
  });

  it('production patterns carry the open slot separately from the literal target', () => {
    for (const target of VS01_TARGETS) {
      expect(target.productionPattern.toLowerCase()).toContain(target.recallTarget.toLowerCase());
      expect(target.productionPattern).toMatch(/</);
    }
  });

  it('the seeded item is a word-type entry: title = literal target, cue never leaks the answer', () => {
    for (const target of VS01_TARGETS) {
      const item = vs01ContentItem(target, 1000);
      expect(item.id).toBe(target.id);
      expect(item.type).toBe('word');
      expect(item.title).toBe(target.recallTarget);
      expect(item.category).toBe(VS01_CATEGORY);
      expect(item.source).toBe('builtin');
      expect(item.tags).toContain(VS01_TAG);
      const cue = vs01CueText(target);
      expect(cue).toContain(target.cueVi);
      expect(cue).toContain('___');
      expect(cue.toLowerCase()).not.toContain(target.recallTarget.toLowerCase());
    }
  });
});

describe('resolveVs01Source', () => {
  it('resolves the source by title + verbatim sentences despite a random contentId', () => {
    const article = fakeArticle();
    expect(resolveVs01Source([article])).toBe(article);
  });

  it('returns null when no article carries all five source sentences verbatim', () => {
    const broken = fakeArticle({ text: SOURCE_TEXT.replace('wake up at', 'get up at') });
    expect(resolveVs01Source([broken])).toBeNull();
    expect(resolveVs01Source([fakeArticle({ title: 'Different Title' })])).toBeNull();
    expect(resolveVs01Source([fakeArticle({ type: 'sentence' })])).toBeNull();
    expect(resolveVs01Source([])).toBeNull();
  });

  it('skips deleted articles', () => {
    expect(resolveVs01Source([fakeArticle({ deletedAt: 5 })])).toBeNull();
  });
});
