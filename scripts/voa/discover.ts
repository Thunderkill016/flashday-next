/*
 * FD-VOA-CORPUS-01 §9/§10/§45 — discovery.
 *
 * Per-series adapters, never one fragile crawler:
 *   page       → course/landing page article links
 *   zone       → /z/<id>?p=N pagination until empty
 *   rss-video  → official podcast feed items + MP4 enclosures
 *   articles   → explicit URL list (Anna multilingual hubs)
 *   chain      → linear episode walk via Related-block lesson links
 *                (Anna courses have no zone/index page)
 *
 * Output: content-corpus/voa/manifest.ndjson — one row per discovered
 * canonical URL (deduped), tagged with series + discovery source.
 */
import { existsSync } from 'node:fs';
import { SERIES } from '../../src/lib/voa-corpus/series.ts';
import { fetchPage } from './http.ts';
import { readNdjson, writeJson, writeNdjson } from './ndjson.ts';

const MANIFEST = 'content-corpus/voa/manifest.ndjson';

export interface ManifestRow {
  canonicalUrl: string;
  contentId: string;
  series: string;
  discoveredFrom: string;
  pubDate?: string;
  enclosureUrl?: string;
}

const ARTICLE_RE = /href="(\/a\/(?:[^"?]+\/)?(\d+)\.html)"/g;
/* Related-block lesson links: `<a href="/a/NNN.html"><h4 title="Lesson 2…">`.
 * VOA zone pagination tops out around page ~100 regardless of archive
 * depth — deep zones report ~1212 items, a site-side ceiling, not a
 * crawler bug. */
const RELATED_LINK_RE = /href="(\/a\/(\d+)\.html)"[^>]*>\s*<h4[^>]*title="([^"]+)"/g;

function articleLinks(html: string): { path: string; id: string }[] {
  const out = new Map<string, { path: string; id: string }>();
  for (const m of html.matchAll(ARTICLE_RE)) out.set(m[2], { path: m[1], id: m[2] });
  return [...out.values()];
}

async function discoverPage(url: string, seriesId: string): Promise<ManifestRow[]> {
  const html = await fetchPage(url);
  if (!html) return [];
  return articleLinks(html).map((l) => ({
    canonicalUrl: `https://learningenglish.voanews.com${l.path}`,
    contentId: l.id,
    series: seriesId,
    discoveredFrom: `page:${url}`,
  }));
}

async function discoverZone(zoneId: number, seriesId: string, maxPages = 120): Promise<ManifestRow[]> {
  const rows: ManifestRow[] = [];
  const seen = new Set<string>();
  for (let p = 0; p <= maxPages; p++) {
    const url =
      p === 0
        ? `https://learningenglish.voanews.com/z/${zoneId}`
        : `https://learningenglish.voanews.com/z/${zoneId}?p=${p}`;
    const html = await fetchPage(url);
    if (!html) break;
    const links = articleLinks(html).filter((l) => !seen.has(l.id));
    if (!links.length) break;
    for (const l of links) {
      seen.add(l.id);
      rows.push({
        canonicalUrl: `https://learningenglish.voanews.com${l.path}`,
        contentId: l.id,
        series: seriesId,
        discoveredFrom: `zone:${zoneId}?p=${p}`,
      });
    }
  }
  return rows;
}

async function discoverRssVideo(zoneId: number, seriesId: string): Promise<ManifestRow[]> {
  const url = `https://learningenglish.voanews.com/podcast/video.aspx?zoneId=${zoneId}`;
  const xml = await fetchPage(url);
  if (!xml) return [];
  const rows: ManifestRow[] = [];
  for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const link = item[1].match(/<link>([^<]+)<\/link>/)?.[1].trim();
    const pub = item[1].match(/<pubDate>([^<]+)<\/pubDate>/)?.[1].trim();
    const enc = item[1].match(/<enclosure url="([^"]+)"/)?.[1];
    if (!link) continue;
    const id = link.match(/\/a\/(?:[^/]+\/)?(\d+)\.html/)?.[1] ?? link;
    rows.push({
      canonicalUrl: link,
      contentId: id,
      series: seriesId,
      discoveredFrom: `rss-video:${zoneId}`,
      pubDate: pub,
      enclosureUrl: enc,
    });
  }
  return rows;
}

async function discoverArticles(urls: string[], seriesId: string): Promise<ManifestRow[]> {
  return urls.map((u) => ({
    canonicalUrl: u,
    contentId: u.match(/\/a\/(?:[^/]+\/)?(\d+)\.html/)?.[1] ?? u,
    series: seriesId,
    discoveredFrom: 'explicit-articles',
  }));
}

/* Linear episode chains (Anna): each lesson's Related block links the
 * next lesson; walk until no unseen title-matching link or maxItems. */
async function discoverChain(seed: string, seriesId: string, titleRe: RegExp, maxItems = 60): Promise<ManifestRow[]> {
  const rows: ManifestRow[] = [];
  const seen = new Set<string>();
  const queue = [seed];
  while (queue.length && rows.length < maxItems) {
    const url = queue.shift();
    if (!url) break;
    const id = url.match(/\/a\/(\d+)\.html/)?.[1] ?? url;
    if (seen.has(id)) continue;
    seen.add(id);
    const html = await fetchPage(url);
    if (!html) continue;
    rows.push({ canonicalUrl: url, contentId: id, series: seriesId, discoveredFrom: `chain:${seed}` });
    for (const m of html.matchAll(RELATED_LINK_RE)) {
      const [, path, linkId, title] = m;
      if (!seen.has(linkId) && titleRe.test(title)) queue.push(`https://learningenglish.voanews.com${path}`);
    }
  }
  return rows;
}

export async function discoverAll(filterSeries?: Set<string>): Promise<ManifestRow[]> {
  const all: ManifestRow[] = [];
  for (const s of SERIES) {
    if (filterSeries && !filterSeries.has(s.id)) continue;
    const d = s.discover;
    const rows =
      d.type === 'page'
        ? await discoverPage(d.url, s.id)
        : d.type === 'zone'
          ? await discoverZone(d.zoneId, s.id)
          : d.type === 'rss-video'
            ? await discoverRssVideo(d.zoneId, s.id)
            : d.type === 'chain'
              ? await discoverChain(d.seed, s.id, d.titleRe, d.maxItems)
              : await discoverArticles(d.urls, s.id);
    console.log(`discover ${s.id}: ${rows.length} items`);
    all.push(...rows);
  }
  /* dedupe by canonical URL — same article under two series keeps the
   * FIRST series (ordered manifest: tier A before B/C/D). */
  const seen = new Map<string, ManifestRow>();
  for (const r of all) if (!seen.has(r.canonicalUrl)) seen.set(r.canonicalUrl, r);
  return [...seen.values()];
}

/* Anna multilingual hub expansion — the language-variant article
 * (/a/6663990 etc.) links to per-language episode hubs; expand one
 * level so episodes inside the VN course are discovered too. */
export async function expandHubs(rows: ManifestRow[]): Promise<ManifestRow[]> {
  const out = [...rows];
  for (const r of rows) {
    if (r.discoveredFrom !== 'explicit-articles') continue;
    const html = await fetchPage(r.canonicalUrl);
    if (!html) continue;
    const links = articleLinks(html).filter((l) => l.id !== r.contentId);
    for (const l of links)
      out.push({
        canonicalUrl: `https://learningenglish.voanews.com${l.path}`,
        contentId: l.id,
        series: r.series,
        discoveredFrom: `hub:${r.canonicalUrl}`,
      });
  }
  return out;
}

if (process.argv[1]?.endsWith('discover.ts')) {
  const only = process.argv[2] ? new Set(process.argv[2].split(',')) : undefined;
  const rows = await expandHubs(await discoverAll(only));
  /* §10 incremental: a filtered run replaces only its own series rows
   * in the existing manifest instead of clobbering the whole file. */
  let base: ManifestRow[] = [];
  if (only && existsSync(MANIFEST)) {
    base = readNdjson<ManifestRow>(MANIFEST).filter((r) => !only.has(r.series));
  }
  const seen = new Map<string, ManifestRow>();
  for (const r of [...base, ...rows]) if (!seen.has(r.canonicalUrl)) seen.set(r.canonicalUrl, r);
  const dedup = [...seen.values()];
  writeNdjson(MANIFEST, dedup);
  writeJson('content-corpus/voa/reports/inventory.discovery.json', {
    total: dedup.length,
    bySeries: Object.fromEntries(SERIES.map((s) => [s.id, dedup.filter((r) => r.series === s.id).length])),
  });
  console.log(`TOTAL ${dedup.length} discovered`);
}
