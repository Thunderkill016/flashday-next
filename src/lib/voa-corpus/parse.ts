/*
 * FD-VOA-CORPUS-01 — shared HTML extraction.
 *
 * VOA article pages are Pangea-CMS rendered; the stable anchors are:
 *   - <script type="application/ld+json"> → headline, dates, section, image
 *   - div.wsw → body; h2.wsw__h2 → section titles; div.wsw__embed → media
 *   - direct asset URLs on voa-audio.voanews.eu / *.akamaized.net / docs.voanews.eu
 *   - <em> credit lines → third-party reporting evidence (rights gate)
 */
import type { VoaAsset } from './types.ts';

export interface ParsedArticle {
  title: string;
  description?: string;
  articleSection?: string;
  publishedAt?: string;
  updatedAt?: string;
  bodyText: string;
  transcript?: string;
  sections: { title: string; text: string }[];
  audio: VoaAsset[];
  video: VoaAsset[];
  images: VoaAsset[];
  documents: VoaAsset[];
  creditLines: string[];
  canonicalUrl?: string;
}

const decode = (s: string): string =>
  s
    .replace(/\\u0026/g, '&')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0027/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2019;/g, '’')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

const stripTags = (html: string): string =>
  decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  ).trim();

const uniq = <T>(arr: T[], key: (t: T) => string): T[] => {
  const seen = new Set<string>();
  return arr.filter((t) => {
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export function parseJsonLd(html: string): Record<string, unknown> | null {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(decode(m[1]));
  } catch {
    return null;
  }
}

export function extractWsw(html: string): string {
  const start = html.indexOf('<div class="wsw">');
  if (start < 0) return '';
  /* Cut at the first non-content landmark AFTER the wsw block. asides
   * legitimately appear inside wsw__embed players, so only document-level
   * landmarks count. */
  const TAIL_MARKERS = [
    '<div class="article-tools',
    '<section class="comments',
    '<div class="related',
    '<footer',
    'wsw__end',
  ];
  let end = html.length;
  for (const marker of TAIL_MARKERS) {
    const i = html.indexOf(marker, start);
    if (i > start && i < end) end = i;
  }
  return html.slice(start, end);
}

/* Remove a <div class="X">…</div> subtree with balanced-depth scanning —
 * VOA embeds contain nested divs so a lazy regex cannot find their close. */
export function stripSubtrees(html: string, marker: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const s = html.indexOf(marker, i);
    if (s < 0) return out + html.slice(i);
    out += html.slice(i, s);
    let depth = 0;
    let j = s;
    for (;;) {
      const open = html.indexOf('<div', j);
      const close = html.indexOf('</div>', j);
      if (close < 0) {
        i = html.length;
        break;
      }
      if (open >= 0 && open < close) {
        depth++;
        j = open + 4;
      } else {
        depth--;
        j = close + 6;
        if (depth === 0) {
          i = j;
          break;
        }
      }
    }
    if (i >= html.length) return out;
  }
}

export function extractMedia(wsw: string): {
  audio: VoaAsset[];
  video: VoaAsset[];
  images: VoaAsset[];
  documents: VoaAsset[];
} {
  const audio: VoaAsset[] = [];
  const video: VoaAsset[] = [];
  const images: VoaAsset[] = [];
  const documents: VoaAsset[] = [];

  for (const m of wsw.matchAll(/href="(https?:\/\/voa-audio\.voanews\.eu\/[^"?]+)(\?[^"]*)?"/g)) {
    const label = /_hq\.mp3$/.test(m[1]) ? 'hq' : 'default';
    audio.push({ url: m[1], kind: 'audio', mimeType: 'audio/mpeg', label });
  }
  for (const m of wsw.matchAll(/href="(https?:\/\/[^" ]*akamaized\.net\/[^"?]+\.mp4)(\?[^"]*)?"/g)) {
    const label = m[1].match(/_(fullhd|1080p|720p|480p|360p|240p|hq|mobile)\.mp4$/)?.[1] ?? 'default';
    video.push({ url: m[1], kind: 'video', mimeType: 'video/mp4', label });
  }
  for (const m of wsw.matchAll(/src="(https?:\/\/gdb\.voanews\.com\/[^"?]+)(\?[^"]*)?"/g)) {
    images.push({ url: m[1], kind: 'image', label: 'gdb' });
  }
  for (const m of wsw.matchAll(/href="(https?:\/\/docs\.voanews\.eu\/[^"?]+\.pdf)(\?[^"]*)?"/g)) {
    documents.push({ url: m[1], kind: 'pdf', mimeType: 'application/pdf' });
  }
  /* audio tags sometimes carry src directly */
  for (const m of wsw.matchAll(/(?:src|href)="(https?:\/\/[^" ]+\.mp3)(\?[^"]*)?"/g)) {
    if (!audio.some((a) => a.url === m[1])) audio.push({ url: m[1], kind: 'audio', mimeType: 'audio/mpeg' });
  }
  return {
    audio: uniq(audio, (a) => a.url),
    video: uniq(video, (v) => v.url),
    images: uniq(images, (i) => i.url),
    documents: uniq(documents, (d) => d.url),
  };
}

export function extractSections(wsw: string): { title: string; text: string }[] {
  const parts: { title: string; text: string }[] = [];
  const re = /<h2 class="wsw__h2">([\s\S]*?)<\/h2>/g;
  const marks: { title: string; end: number }[] = [];
  for (const m of wsw.matchAll(re)) marks.push({ title: stripTags(m[1]), end: (m.index ?? 0) + m[0].length });
  for (let i = 0; i < marks.length; i++) {
    const from = marks[i].end;
    const to = i + 1 < marks.length ? wsw.indexOf('<h2 class="wsw__h2">', from) : wsw.length;
    parts.push({ title: marks[i].title, text: stripTags(wsw.slice(from, to)) });
  }
  return parts;
}

export function extractCreditLines(wsw: string): string[] {
  const lines: string[] = [];
  for (const m of wsw.matchAll(/<em>([\s\S]*?)<\/em>/g)) {
    const t = stripTags(m[1]);
    if (t.length > 8) lines.push(t);
  }
  /* byline patterns outside <em> */
  for (const m of wsw.matchAll(/<p[^>]*class="[^"]*(?:byline|credit|caption)[^"]*"[^>]*>([\s\S]*?)<\/p>/g)) {
    const t = stripTags(m[1]);
    if (t.length > 4) lines.push(t);
  }
  return uniq(lines, (l) => l);
}

export function parseArticle(html: string): ParsedArticle {
  const ld = parseJsonLd(html) ?? {};
  const wsw = extractWsw(html);
  const media = extractMedia(html); // media links can live outside .wsw too
  /* body/sections: drop player embeds + share asides so chrome text
   * ('Embed share', 'The code has been copied') never enters the corpus. */
  const clean = stripSubtrees(stripSubtrees(wsw, '<div class="wsw__embed">'), '<aside');
  const sections = extractSections(clean);
  const creditLines = extractCreditLines(wsw);

  /* transcript = the Conversation/text body blocks; section titled
   * 'Conversation' or 'Transcript' wins when present */
  const convo = sections.find((s) => /conversation|transcript/i.test(s.title));
  const bodyText = stripTags(clean);

  return {
    title:
      stripTags(String(ld.headline ?? '')) ||
      (html
        .match(/<title>([^<]*)/)?.[1]
        .split('|')[0]
        .trim() ??
        ''),
    description: ld.description ? stripTags(String(ld.description)) : undefined,
    articleSection: ld.articleSection ? String(ld.articleSection) : undefined,
    publishedAt: typeof ld.datePublished === 'string' ? ld.datePublished : undefined,
    updatedAt: typeof ld.dateModified === 'string' ? ld.dateModified : undefined,
    bodyText,
    transcript: convo?.text,
    sections,
    ...media,
    creditLines,
    canonicalUrl:
      typeof ld.mainEntityOfPage === 'string' ? ld.mainEntityOfPage : typeof ld.url === 'string' ? ld.url : undefined,
  };
}
