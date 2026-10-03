/*
 * FD-VOA-CORPUS-01 §3–8/§32 — series manifest.
 *
 * One entry per discoverable family; rights defaults stay INSPECTABLE —
 * no blanket 'voa-all = reusable' (§32). `rightsPrior` seeds the audit;
 * the per-asset gate can only downgrade, never upgrade past detected
 * third-party evidence.
 */
import type { VoaResourceKind, VoaRightsStatus, VoaSeriesTier } from './types.ts';

export interface SeriesEntry {
  id: string;
  name: string;
  tier: VoaSeriesTier;
  kind: VoaResourceKind;
  discover:
    | { type: 'page'; url: string } // course/landing page with article links
    | { type: 'zone'; zoneId: number } // /z/<id>?p=N pagination
    | { type: 'rss-video'; zoneId: number } // /podcast/video.aspx?zoneId=N
    | { type: 'articles'; urls: string[] } // explicit article list (multilingual hubs)
    /* linear episode chain — Related-block lesson links (Anna courses
     * have no zone/index page; each lesson links the next). */
    | { type: 'chain'; seed: string; titleRe: RegExp; maxItems?: number };
  levelHint?: string; // VOA's own level label when known
  rightsPrior: VoaRightsStatus; // default prior — audit may downgrade
  expectedItems?: number;
  mapsTo: string[]; // FlashDay tracks/capability areas this feeds
}

export const VOA_ATTRIBUTION = 'Source: VOA Learning English — learningenglish.voanews.com';

export const SERIES: SeriesEntry[] = [
  /* ── Tier A — structured courses ─────────────────────────────── */
  {
    id: 'voa-lle-level1',
    name: "Let's Learn English - Level 1",
    tier: 'A',
    kind: 'course_lesson',
    discover: { type: 'page', url: 'https://learningenglish.voanews.com/p/5644.html' },
    levelHint: 'beginning',
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    expectedItems: 52,
    mapsTo: ['survival', 'everyday', 'listening', 'grammar-support'],
  },
  {
    id: 'voa-lle-level2',
    name: "Let's Learn English - Level 2",
    tier: 'A',
    kind: 'course_lesson',
    discover: { type: 'page', url: 'https://learningenglish.voanews.com/p/6765.html' },
    levelHint: 'intermediate',
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    expectedItems: 30,
    mapsTo: ['everyday', 'chunks', 'grammar-support', 'listening'],
  },
  {
    id: 'voa-anna',
    name: "Let's Learn English with Anna",
    tier: 'A',
    kind: 'course_lesson',
    discover: {
      type: 'chain',
      seed: 'https://learningenglish.voanews.com/a/6654462.html',
      titleRe: /Lesson\s*\d+|LLE-A/i,
      maxItems: 60,
    },
    levelHint: 'beginning',
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    expectedItems: 15, // published-to-date; chain walks to newest
    mapsTo: ['survival', 'everyday', 'listening'],
  },
  {
    id: 'voa-anna-vietnamese',
    name: "Let's Learn English with Anna in Vietnamese",
    tier: 'A',
    kind: 'course_lesson',
    discover: {
      type: 'chain',
      seed: 'https://learningenglish.voanews.com/a/6663990.html',
      titleRe: /Bài\s*\d+/i,
      maxItems: 60,
    },
    levelHint: 'beginning',
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    expectedItems: 5, // VN localization lags EN; published-to-date
    mapsTo: ['comparison-report'], // §35 — reference signal only, never auto-merged
  },
  {
    id: 'voa-anna-multilingual',
    name: "Let's Learn English with Anna — other languages",
    tier: 'A',
    kind: 'course_lesson',
    discover: {
      type: 'articles',
      urls: [
        'https://learningenglish.voanews.com/a/6659262.html', // Amharic
        'https://learningenglish.voanews.com/a/6660896.html',
        'https://learningenglish.voanews.com/a/6785583.html', // French
        'https://learningenglish.voanews.com/a/6787090.html',
        'https://learningenglish.voanews.com/a/6796864.html',
        'https://learningenglish.voanews.com/a/7025838.html', // Uzbek
      ],
    },
    levelHint: 'beginning',
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    mapsTo: ['comparison-report'], // §3 — inventory only
  },
  {
    id: 'voa-lets-teach',
    name: "Let's Teach English",
    tier: 'A',
    kind: 'teacher_resource',
    discover: { type: 'page', url: 'https://learningenglish.voanews.com/p/6764.html' },
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    mapsTo: ['authoring-reference'],
  },

  /* ── Tier B — language-teaching series ───────────────────────── */
  {
    id: 'voa-everyday-grammar',
    name: 'Everyday Grammar',
    tier: 'B',
    kind: 'grammar',
    discover: { type: 'zone', zoneId: 4456 },
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    mapsTo: ['grammar-support'],
  },
  {
    id: 'voa-everyday-grammar-tv',
    name: 'Everyday Grammar TV',
    tier: 'B',
    kind: 'grammar',
    discover: { type: 'rss-video', zoneId: 4716 },
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    mapsTo: ['grammar-support', 'listening'],
  },
  {
    id: 'voa-english-minute',
    name: 'English in a Minute',
    tier: 'B',
    kind: 'expression',
    discover: { type: 'rss-video', zoneId: 3619 },
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    mapsTo: ['chunks'],
  },
  {
    id: 'voa-news-words',
    name: 'News Words',
    tier: 'B',
    kind: 'expression',
    discover: { type: 'rss-video', zoneId: 3620 },
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    mapsTo: ['vocabulary'], // A2+ only — never forced into A0/A1 (§4)
  },
  {
    id: 'voa-words-stories',
    name: 'Words and Their Stories',
    tier: 'B',
    kind: 'expression',
    discover: { type: 'zone', zoneId: 987 },
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED', // idioms articles often carry wire credits
    mapsTo: ['chunks', 'extensive-input'],
  },
  {
    id: 'voa-ask-teacher',
    name: 'Ask a Teacher',
    tier: 'B',
    kind: 'grammar',
    discover: { type: 'zone', zoneId: 5535 },
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    mapsTo: ['grammar-support', 'authoring-reference'],
  },
  {
    id: 'voa-pronunciation',
    name: 'How to Pronounce',
    tier: 'B',
    kind: 'pronunciation',
    discover: { type: 'rss-video', zoneId: 6042 },
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    mapsTo: ['pronunciation'],
  },
  {
    id: 'voa-english-movies',
    name: 'English @ the Movies',
    tier: 'B',
    kind: 'expression',
    discover: { type: 'rss-video', zoneId: 4691 },
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED', // film excerpts = third-party footage
    mapsTo: ['chunks'],
  },
  /* voa-english-job (zone 6020) retired upstream — feed and zone both
   * return zero items as of 2026-10; removed from manifest, kept note. */
  {
    id: 'voa-talk2us',
    name: 'Talk2Us',
    tier: 'B',
    kind: 'expression',
    discover: { type: 'rss-video', zoneId: 6024 },
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    mapsTo: ['everyday', 'chunks'],
  },

  /* ── Tier C — extensive listening/reading ────────────────────── */
  {
    id: 'voa-learning-podcast',
    name: 'VOA Learning English Podcast',
    tier: 'C',
    kind: 'podcast',
    discover: { type: 'zone', zoneId: 1689 },
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    mapsTo: ['extensive-listening'],
  },
  {
    id: 'voa-as-it-is',
    name: 'As It Is',
    tier: 'C',
    kind: 'article',
    discover: { type: 'zone', zoneId: 3521 },
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED', // wire-service adaptations common
    mapsTo: ['extensive-reading', 'extensive-listening'],
  },
  {
    id: 'voa-arts-culture',
    name: 'Arts & Culture',
    tier: 'C',
    kind: 'article',
    discover: { type: 'zone', zoneId: 986 },
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED',
    mapsTo: ['extensive-reading', 'extensive-listening'],
  },
  {
    id: 'voa-education',
    name: 'Education Tips',
    tier: 'C',
    kind: 'article',
    discover: { type: 'zone', zoneId: 7468 },
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED',
    mapsTo: ['extensive-reading'],
  },
  {
    id: 'voa-science-tech',
    name: 'Science & Technology',
    tier: 'C',
    kind: 'article',
    discover: { type: 'zone', zoneId: 1579 },
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED',
    mapsTo: ['extensive-reading', 'extensive-listening'],
  },
  {
    id: 'voa-health',
    name: 'Health & Lifestyle',
    tier: 'C',
    kind: 'article',
    discover: { type: 'zone', zoneId: 955 },
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED',
    mapsTo: ['extensive-reading', 'extensive-listening'],
  },
  {
    id: 'voa-trending',
    name: "What's Trending Today",
    tier: 'C',
    kind: 'article',
    discover: { type: 'zone', zoneId: 4652 },
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED',
    mapsTo: ['extensive-input'], // §37 — never curriculum spine
  },
  {
    id: 'voa-what-it-takes',
    name: 'What It Takes',
    tier: 'C',
    kind: 'podcast',
    discover: { type: 'zone', zoneId: 5254 },
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED',
    mapsTo: ['extensive-listening'],
  },
  {
    id: 'voa-early-literacy',
    name: 'Early Literacy',
    tier: 'C',
    kind: 'article',
    discover: { type: 'zone', zoneId: 7467 },
    /* news-style zone archive; AP-adapted stories known to occur (e.g.
     * "Home Visiting Programs Aim to Support Early Education" — AP copy
     * + AP photo). Prior must not promote on detection misses. */
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED',
    mapsTo: ['extensive-reading'],
  },

  /* ── Tier D — stories, history, culture ──────────────────────── */
  {
    id: 'voa-american-stories',
    name: 'American Stories',
    tier: 'D',
    kind: 'story',
    discover: { type: 'zone', zoneId: 1581 },
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED', // underlying literary rights vary (§6)
    mapsTo: ['extensive-reading', 'extensive-listening'],
  },
  {
    id: 'voa-presidents',
    name: "America's Presidents",
    tier: 'D',
    kind: 'article',
    discover: { type: 'zone', zoneId: 5091 },
    /* zone article archive — feature format can carry wire adaptations */
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED',
    mapsTo: ['extensive-input'],
  },
  {
    id: 'voa-national-parks',
    name: "America's National Parks",
    tier: 'D',
    kind: 'article',
    discover: { type: 'zone', zoneId: 4791 },
    /* zone article archive — wire-derived items detected in corpus */
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED',
    mapsTo: ['extensive-input'],
  },
  {
    id: 'voa-us-history',
    name: 'U.S. History',
    tier: 'D',
    kind: 'article',
    discover: { type: 'page', url: 'https://learningenglish.voanews.com/p/6353.html' },
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    mapsTo: ['extensive-input'],
  },
  {
    id: 'voa-voa60',
    name: 'VOA60: Watch & Learn',
    tier: 'D',
    kind: 'podcast',
    discover: { type: 'zone', zoneId: 3613 },
    rightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED', // news montage — wire footage likely
    mapsTo: ['extensive-listening'],
  },
  {
    id: 'voa-news-literacy',
    name: 'News Literacy',
    tier: 'D',
    kind: 'teacher_resource',
    discover: { type: 'page', url: 'https://learningenglish.voanews.com/p/6840.html' },
    rightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    mapsTo: ['authoring-reference', 'extensive-input'],
  },
];

export const SERIES_BY_ID = new Map(SERIES.map((s) => [s.id, s]));
