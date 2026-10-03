/* FD-VOA-CORPUS-01 — orchestrator: discover → fetch → normalize → links → report.
 * Uses the same exported passes as the per-stage CLIs so `build` can never
 * diverge from `fetch`/`normalize` semantics (caps, merges, resolvability). */
import { existsSync } from 'node:fs';
import { buildMediaAsset, dedupeAssets, resolveAudioAssets } from '../../src/lib/voa-corpus/media.ts';
import { normalizeResource } from '../../src/lib/voa-corpus/normalize.ts';
import { SERIES } from '../../src/lib/voa-corpus/series.ts';
import type { LearningMediaAsset, VoaLearningResource, VoaSourceRecord } from '../../src/lib/voa-corpus/types.ts';
import { discoverAll, expandHubs, type ManifestRow } from './discover.ts';
import { fetchRecords } from './fetch.ts';
import { headOk } from './http.ts';
import { linkAndIndex } from './links.ts';
import { readNdjson, writeJson, writeNdjson } from './ndjson.ts';
import { writeReports } from './report-runner.ts';

async function main() {
  /* 1 — discover */
  const raw = await expandHubs(await discoverAll());
  const seen = new Map<string, ManifestRow>();
  for (const r of raw) if (!seen.has(r.canonicalUrl)) seen.set(r.canonicalUrl, r);
  const manifest = [...seen.values()];
  writeNdjson('content-corpus/voa/manifest.ndjson', manifest);
  writeJson('content-corpus/voa/reports/inventory.discovery.json', {
    total: manifest.length,
    bySeries: Object.fromEntries(SERIES.map((s) => [s.id, manifest.filter((r) => r.series === s.id).length])),
  });
  console.log(`discover: ${manifest.length}`);

  /* 2 — fetch + rights (same cap/merge semantics as `voa fetch`) */
  const priorSources = existsSync('content-corpus/voa/source.ndjson')
    ? readNdjson<VoaSourceRecord>('content-corpus/voa/source.ndjson')
    : [];
  const { records: sources, failures } = await fetchRecords(manifest, { prior: priorSources });
  writeNdjson('content-corpus/voa/source.ndjson', sources);
  writeNdjson(
    'content-corpus/voa/rights.ndjson',
    sources.map((r) => ({
      id: r.id,
      series: r.series,
      status: r.rightsStatus,
      externalCredits: r.externalCredits,
      reasons: r.rightsReasons,
    })),
  );
  console.log(`fetch: ${sources.length} records (${failures.length} failures)`);

  /* 3 — normalize + media (bounded resolvability, prior carry-forward) */
  const priorResolved = new Map(
    (existsSync('content-corpus/voa/media.ndjson')
      ? readNdjson<LearningMediaAsset>('content-corpus/voa/media.ndjson')
      : []
    ).map((m) => [m.id, m.resolvable]),
  );
  const resources: VoaLearningResource[] = [];
  const media: LearningMediaAsset[] = [];
  for (const src of sources) {
    const res = normalizeResource(src);
    if (!res) continue;
    resources.push(res);
    for (const a of [...src.audio, ...src.video])
      media.push(buildMediaAsset({ asset: a, sourceResourceId: src.id, rightsStatus: src.rightsStatus }));
  }
  const assets = dedupeAssets(media);
  for (const a of assets) if (priorResolved.get(a.id)) a.resolvable = true;
  const audioOk = await resolveAudioAssets(assets, headOk);
  writeNdjson('content-corpus/voa/resources.ndjson', resources);
  writeNdjson('content-corpus/voa/media.ndjson', assets);
  console.log(`normalize: ${resources.length} resources, ${assets.length} media (${audioOk} newly verified audio)`);

  /* 4 — links + search index + §33/§35 reports */
  const { links, gaps, index, lle1, annaPairs, gapStatus } = linkAndIndex(resources);
  writeNdjson('content-corpus/voa/links.ndjson', links);
  writeJson('content-corpus/voa/reports/curriculum-links.json', { links });
  writeJson('content-corpus/voa/reports/recycling.json', {
    gaps,
    matchedGaps: new Set(gaps.map((g) => g.gapChunk)).size,
  });
  writeJson('content-corpus/voa/reports/gaps.json', gapStatus);
  writeJson('content-corpus/voa/reports/lle1-mapping.json', lle1);
  writeJson('content-corpus/voa/reports/anna-vi-comparison.json', annaPairs);
  writeJson('content-corpus/voa/search-index.json', index);
  console.log(`links: ${links.length} links, ${gaps.length} gap matches, ${index.length} indexed`);

  /* 5 — reports */
  writeReports();
  console.log('reports written');
}

await main();
