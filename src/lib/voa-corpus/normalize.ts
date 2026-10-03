/*
 * FD-VOA-CORPUS-01 §15/§30/§50/§51 — normalization.
 *
 * VoaSourceRecord → VoaLearningResource. Only RIGHTS_VERIFIED sources
 * reach NORMALIZED; the raw payload stays in the source record —
 * normalization never destroys provenance (§51).
 */
import { enrichText } from './enrich.ts';
import { inferLevel } from './level.ts';
import { mediaAssetId } from './media.ts';
import { SERIES_BY_ID, VOA_ATTRIBUTION } from './series.ts';
import type { VoaLearningResource, VoaSourceRecord } from './types.ts';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export function normalizeResource(src: VoaSourceRecord): VoaLearningResource | null {
  if (src.rightsStatus === 'UNKNOWN' || src.rightsStatus === 'THIRD_PARTY_RESTRICTED') return null;
  const series = SERIES_BY_ID.get(src.series);
  const text = norm(src.articleText ?? '');
  if (text.length < 40 && !src.transcript) return null; // empty/truncated — §52 gate

  const combined = src.transcript ? `${text} ${norm(src.transcript)}` : text;
  const enrichment = enrichText(combined);

  return {
    id: src.id,
    kind: series?.kind ?? 'article',
    title: src.title,
    text,
    transcript: src.transcript ? norm(src.transcript) : undefined,
    /* refs must equal LearningMediaAsset.id (voa-media:<sha256-16>) —
     * a raw-URL ref looks valid but resolves to nothing in media.ndjson */
    audioRefs: src.audio.map((a) => mediaAssetId(a.url)),
    videoRefs: src.video.map((v) => mediaAssetId(v.url)),
    documentRefs: src.documents.map((d) => mediaAssetId(d.url)),
    series: src.series,
    level: inferLevel(combined, src.levelHint),
    enrichment,
    source: {
      publisher: 'Voice of America',
      canonicalUrl: src.canonicalUrl,
      publicDomainVerified: src.rightsStatus === 'VOA_ORIGINAL_PUBLIC_DOMAIN',
      attribution: VOA_ATTRIBUTION,
      contentHash: src.contentHash,
      sourceRevision: 1,
    },
    pipelineState: 'ENRICHED',
  };
}
