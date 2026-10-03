/*
 * FD-VOA-CORPUS-01 §20/§33/§35/§40 — curriculum links + search index.
 *
 * resources.ndjson → curriculum-links.json + recycling.json + a local
 * search index (search-index.json) so "find authentic A1 audio
 * containing X" is answerable offline (§39).
 */
import { curriculumGaps, linkResource, matchGaps } from '../../src/lib/voa-corpus/curriculum-links.ts';
import { SERIES_BY_ID } from '../../src/lib/voa-corpus/series.ts';
import type { LearningMediaAsset, RecyclingMatch, VoaLearningResource } from '../../src/lib/voa-corpus/types.ts';
import { readNdjson, writeJson, writeNdjson } from './ndjson.ts';

/* ~130 wpm silent-reading estimate; used for estimatedMinutes when no
 * audio duration metadata exists (VOA pages rarely expose it). */
const READING_WPM = 130;

export function linkAndIndex(resources: VoaLearningResource[], media: LearningMediaAsset[] = []) {
  const mediaById = new Map(media.map((m) => [m.id, m]));
  const links = resources.flatMap((r) => linkResource(r, mediaById));
  const gaps = matchGaps(resources);

  /* search index: per-resource searchable projection (§39) */
  const index = resources.map((r) => ({
    id: r.id,
    series: r.series,
    seriesName: SERIES_BY_ID.get(r.series)?.name,
    kind: r.kind,
    title: r.title,
    level: r.level.inferred,
    levelConfidence: r.level.confidence,
    canonicalUrl: r.source.canonicalUrl,
    publicDomain: r.source.publicDomainVerified,
    audioCount: r.audioRefs.length,
    videoCount: r.videoRefs.length,
    capabilities: r.enrichment.capabilities,
    functions: r.enrichment.communicativeFunctions,
    grammar: r.enrichment.grammarFeatures,
    listening: r.enrichment.listeningFeatures,
    pronunciation: r.enrichment.pronunciationFeatures,
    topics: r.enrichment.topicTags,
    knownChunks: r.enrichment.knownChunks,
    lexicalDensity: r.enrichment.lexicalDensity,
    estimatedMinutes: r.text ? Math.round((r.text.split(/\s+/).length / READING_WPM) * 10) / 10 : undefined,
  }));

  /* §33 — LLE Level-1 mapping: each course lesson vs the FlashDay
   * lessons/capabilities it authentically reencounters. */
  const lle1 = resources
    .filter((r) => r.series === 'voa-lle-level1')
    .map((r) => ({
      resourceId: r.id,
      title: r.title,
      level: r.level,
      audioRefs: r.audioRefs.length,
      videoRefs: r.videoRefs.length,
      capabilities: r.enrichment.capabilities,
      grammar: r.enrichment.grammarFeatures,
      knownChunks: r.enrichment.knownChunks,
      flashdayLessons: [...new Set(links.filter((l) => l.voaResourceId === r.id).map((l) => l.lessonId))],
    }));

  /* §35 — Anna VN comparison: pair EN/VI lessons by episode number.
   * VN text is a reference signal only — never auto-merged. */
  const lessonNum = (t: string) => t.match(/(?:Lesson|Bài)\s*(\d+)/i)?.[1];
  const annaEn = new Map(resources.filter((r) => r.series === 'voa-anna').map((r) => [lessonNum(r.title), r]));
  const annaVi = new Map(
    resources.filter((r) => r.series === 'voa-anna-vietnamese').map((r) => [lessonNum(r.title), r]),
  );
  const annaPairs = [...annaEn.keys()]
    .filter((n): n is string => Boolean(n) && annaVi.has(n))
    .sort((a, b) => Number(a) - Number(b))
    .map((n) => {
      const en = annaEn.get(n);
      const vi = annaVi.get(n);
      return {
        episode: Number(n),
        enTitle: en?.title,
        viTitle: vi?.title,
        enChunks: en?.enrichment.knownChunks ?? [],
        enTextPreview: en?.text.slice(0, 200),
        viTextPreview: vi?.text.slice(0, 200),
        viCanonicalUrl: vi?.source.canonicalUrl,
      };
    });

  /* §48 gap report — every uncovered curriculum chunk vs its first
   * authentic VOA occurrence (or null). */
  const gapStatus = curriculumGaps().map((g) => {
    const hit = gaps.find((m) => m.gapChunk === g.chunk);
    return {
      chunk: g.chunk,
      homeLesson: g.homeLesson,
      matched: Boolean(hit),
      voaResourceId: hit?.voaResourceId,
      usable: hit?.usable ?? false,
    };
  });

  return { links, gaps, index, lle1, annaPairs, gapStatus };
}

if (process.argv[1]?.endsWith('links.ts')) {
  const resources = readNdjson<VoaLearningResource>('content-corpus/voa/resources.ndjson');
  const media = readNdjson<LearningMediaAsset>('content-corpus/voa/media.ndjson');
  const { links, gaps, index, lle1, annaPairs, gapStatus } = linkAndIndex(resources, media);

  writeNdjson('content-corpus/voa/links.ndjson', links);
  writeJson('content-corpus/voa/reports/curriculum-links.json', { links });
  writeJson('content-corpus/voa/reports/recycling.json', {
    gaps,
    matchedGaps: new Set(gaps.map((g: RecyclingMatch) => g.gapChunk)).size,
  });
  writeJson('content-corpus/voa/reports/gaps.json', gapStatus);
  writeJson('content-corpus/voa/reports/lle1-mapping.json', lle1);
  writeJson('content-corpus/voa/reports/anna-vi-comparison.json', annaPairs);
  writeJson('content-corpus/voa/search-index.json', index);
  console.log(
    `DONE ${links.length} links, ${gaps.length} gap matches (${new Set(gaps.map((g) => g.gapChunk)).size} gaps covered), ${index.length} indexed, ${annaPairs.length} anna pairs`,
  );
}
