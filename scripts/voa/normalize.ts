/*
 * FD-VOA-CORPUS-01 §15/§43/§44 — normalize + media registry.
 *
 * source.ndjson → resources.ndjson (VoaLearningResource, RIGHTS_VERIFIED
 * only) + media.ndjson (LearningMediaAsset with HEAD-resolvability).
 */
import { existsSync } from 'node:fs';
import { buildMediaAsset, dedupeAssets, resolveAudioAssets } from '../../src/lib/voa-corpus/media.ts';
import { normalizeResource } from '../../src/lib/voa-corpus/normalize.ts';
import type { LearningMediaAsset, VoaLearningResource, VoaSourceRecord } from '../../src/lib/voa-corpus/types.ts';
import { headOk } from './http.ts';
import { readNdjson, writeNdjson } from './ndjson.ts';

if (process.argv[1]?.endsWith('normalize.ts')) {
  const sources = readNdjson<VoaSourceRecord>('content-corpus/voa/source.ndjson');
  /* carry forward prior resolvability so incremental runs advance the
   * verification frontier instead of rechecking the same assets */
  const priorResolved = new Map(
    (existsSync('content-corpus/voa/media.ndjson')
      ? readNdjson<LearningMediaAsset>('content-corpus/voa/media.ndjson')
      : []
    ).map((m) => [m.id, m.resolvable]),
  );
  const resources: VoaLearningResource[] = [];
  const media: LearningMediaAsset[] = [];
  let skipped = 0;

  for (const src of sources) {
    const res = normalizeResource(src);
    if (!res) {
      skipped++;
      continue;
    }
    res.pipelineState = 'ENRICHED';
    resources.push(res);
    for (const a of [...src.audio, ...src.video])
      media.push(buildMediaAsset({ asset: a, sourceResourceId: src.id, rightsStatus: src.rightsStatus }));
  }

  const assets = dedupeAssets(media);
  for (const a of assets) if (priorResolved.get(a.id)) a.resolvable = true;
  /* resolvability check — real-audio claim requires resolvable URL (§43).
   * Bounded per run; unresolved stays fail-closed until a later run. */
  const audioAssets = assets.filter((a) => a.type === 'audio');
  console.log(`media: ${assets.length} unique assets, ${audioAssets.length} audio — HEAD checking audio…`);
  const ok = await resolveAudioAssets(assets, headOk);
  console.log(`resolvable audio: ${ok} newly verified`);

  writeNdjson('content-corpus/voa/resources.ndjson', resources);
  writeNdjson('content-corpus/voa/media.ndjson', assets);
  console.log(`DONE ${resources.length} normalized (${skipped} skipped), ${assets.length} media assets`);
}
