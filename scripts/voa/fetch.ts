/*
 * FD-VOA-CORPUS-01 §11 — fetch + parse → VoaSourceRecord rows.
 *
 * Reads manifest.ndjson, fetches each canonical page (cached),
 * extracts the article via the shared parser, runs the rights gate,
 * and writes source.ndjson + rights.ndjson.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { parseArticle } from '../../src/lib/voa-corpus/parse.ts';
import { auditResource } from '../../src/lib/voa-corpus/rights.ts';
import { SERIES_BY_ID } from '../../src/lib/voa-corpus/series.ts';
import type { VoaSourceRecord } from '../../src/lib/voa-corpus/types.ts';
import type { ManifestRow } from './discover.ts';
import { fetchPage } from './http.ts';
import { readNdjson, writeNdjson } from './ndjson.ts';

/* Bounded initial backfill per §10 — the manifest keeps the FULL URL
 * inventory for every series; these caps bound the first fetch pass so
 * the pipeline proves out across all 24 series in reasonable time.
 * Deeper backfill is incremental: re-run `fetch` after raising a cap.
 * Tier A courses + teacher resources stay uncapped (small, load-bearing).
 * Deep news zones additionally hit VOA's own ~100-page listing ceiling. */
export const SERIES_CAP: Record<string, number> = {
  'voa-everyday-grammar': 80,
  'voa-everyday-grammar-tv': 60,
  'voa-english-minute': 80,
  'voa-news-words': 80,
  'voa-words-stories': 80,
  'voa-ask-teacher': 60,
  'voa-pronunciation': 80,
  'voa-english-movies': 60,
  'voa-talk2us': 60,
  'voa-learning-podcast': 60,
  'voa-as-it-is': 60,
  'voa-arts-culture': 60,
  'voa-education': 60,
  'voa-science-tech': 60,
  'voa-health': 60,
  'voa-trending': 60,
  'voa-what-it-takes': 60,
  'voa-voa60': 60,
  'voa-american-stories': 100,
  'voa-presidents': 60,
  'voa-national-parks': 60,
};

/* Shared fetch+audit pass used by both the `fetch` CLI and `build`.
 * Merges into `prior` by record id so incremental runs compose (§10/§28).
 * `build` is injectable for tests (same seam as resolveAudioAssets). */
export async function fetchRecords(
  manifest: ManifestRow[],
  opts: {
    only?: Set<string>;
    prior?: VoaSourceRecord[];
    build?: (row: ManifestRow) => Promise<VoaSourceRecord | null>;
  } = {},
) {
  const build = opts.build ?? buildSourceRecord;
  const byId = new Map((opts.prior ?? []).map((r) => [r.id, r]));
  const failures: string[] = [];
  const perSeries = new Map<string, number>();
  let n = 0;
  for (const row of manifest) {
    if (opts.only && !opts.only.has(row.series)) continue;
    const done = perSeries.get(row.series) ?? 0;
    if (done >= (SERIES_CAP[row.series] ?? Infinity)) continue;
    const rec = await build(row);
    if (rec) byId.set(rec.id, rec);
    else failures.push(row.canonicalUrl);
    perSeries.set(row.series, done + 1);
    if (++n % 50 === 0) console.log(`fetched ${n}`);
  }
  return { records: [...byId.values()], failures, fetched: n };
}

export async function buildSourceRecord(row: ManifestRow): Promise<VoaSourceRecord | null> {
  const html = await fetchPage(row.canonicalUrl);
  if (!html) return null;
  const p = parseArticle(html);
  const series = SERIES_BY_ID.get(row.series);

  const assets = [...p.audio, ...p.video, ...p.images, ...p.documents];
  const audit = auditResource({
    seriesRightsPrior: series?.rightsPrior ?? 'UNKNOWN',
    creditLines: p.creditLines,
    assets,
    canonicalUrl: p.canonicalUrl ?? row.canonicalUrl,
  });

  return {
    id: `voa:${row.contentId}`,
    canonicalUrl: p.canonicalUrl ?? row.canonicalUrl,
    series: row.series,
    title: p.title,
    publishedAt: p.publishedAt ?? row.pubDate,
    updatedAt: p.updatedAt,
    levelHint: series?.levelHint,
    articleText: p.bodyText,
    transcript: p.transcript,
    audio: p.audio,
    video: p.video,
    images: p.images,
    documents: p.documents,
    sourceCredits: p.creditLines,
    externalCredits: audit.externalCredits,
    rightsStatus: audit.status,
    rightsReasons: audit.reasons,
    discoveredFrom: row.discoveredFrom,
    fetchedAt: new Date().toISOString(),
    contentHash: createHash('sha256').update(`${p.title}${p.bodyText}`).digest('hex'),
  };
}

if (process.argv[1]?.endsWith('fetch.ts')) {
  const SOURCE = 'content-corpus/voa/source.ndjson';
  const manifest = readNdjson<ManifestRow>('content-corpus/voa/manifest.ndjson');
  const only = process.argv[2] ? new Set(process.argv[2].split(',')) : undefined;
  const prior = existsSync(SOURCE) ? readNdjson<VoaSourceRecord>(SOURCE) : [];
  const { records, failures, fetched } = await fetchRecords(manifest, { only, prior });
  writeNdjson(SOURCE, records);
  writeNdjson(
    'content-corpus/voa/rights.ndjson',
    records.map((r) => ({
      id: r.id,
      series: r.series,
      status: r.rightsStatus,
      externalCredits: r.externalCredits,
      reasons: r.rightsReasons,
    })),
  );
  console.log(`DONE ${records.length} records (${fetched} fetched this run), ${failures.length} fetch failures`);
  if (failures.length) console.log(failures.slice(0, 10).join('\n'));
}
