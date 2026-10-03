/*
 * FD-VOA-CORPUS-01 §48 — report writer (shared by report.ts CLI + build.ts).
 */

import { writeFileSync } from 'node:fs';
import { SERIES } from '../../src/lib/voa-corpus/series.ts';
import type { LearningMediaAsset, VoaLearningResource, VoaSourceRecord } from '../../src/lib/voa-corpus/types.ts';
import { readNdjson, writeJson } from './ndjson.ts';

const R = 'content-corpus/voa/reports';
const write = (name: string, data: unknown, md?: string) => {
  writeJson(`${R}/${name}.json`, data);
  if (md) writeFileSync(`${R}/${name}.md`, md);
};

export function writeReports(): void {
  const sources = readNdjson<VoaSourceRecord>('content-corpus/voa/source.ndjson');
  const resources = readNdjson<VoaLearningResource>('content-corpus/voa/resources.ndjson');
  const media = readNdjson<LearningMediaAsset>('content-corpus/voa/media.ndjson');

  /* inventory */
  const inv = {
    series: SERIES.map((s) => ({
      id: s.id,
      name: s.name,
      tier: s.tier,
      discovered: sources.filter((r) => r.series === s.id).length,
      normalized: resources.filter((r) => r.series === s.id).length,
      withAudio: resources.filter((r) => r.series === s.id && r.audioRefs.length).length,
      withVideo: resources.filter((r) => r.series === s.id && r.videoRefs.length).length,
    })),
    totals: {
      discovered: sources.length,
      normalized: resources.length,
      audio: media.filter((m) => m.type === 'audio').length,
      audioResolvable: media.filter((m) => m.type === 'audio' && m.resolvable).length,
      video: media.filter((m) => m.type === 'video').length,
      transcripts: resources.filter((r) => r.transcript).length,
    },
  };
  write(
    'inventory',
    inv,
    [
      '# VOA Corpus Inventory',
      '',
      '| series | tier | discovered | normalized | audio | video |',
      '|---|---|---|---|---|---|',
      ...inv.series.map(
        (s) => `| ${s.name} | ${s.tier} | ${s.discovered} | ${s.normalized} | ${s.withAudio} | ${s.withVideo} |`,
      ),
      '',
      `Totals: ${inv.totals.discovered} discovered → ${inv.totals.normalized} normalized; ${inv.totals.audio} audio (${inv.totals.audioResolvable} resolvable), ${inv.totals.video} video, ${inv.totals.transcripts} transcripts.`,
    ].join('\n'),
  );

  /* rights */
  const rights = {
    voaOriginal: sources.filter((s) => s.rightsStatus === 'VOA_ORIGINAL_PUBLIC_DOMAIN').length,
    mixed: sources.filter((s) => s.rightsStatus === 'MIXED_RIGHTS_REVIEW_REQUIRED').length,
    restricted: sources.filter((s) => s.rightsStatus === 'THIRD_PARTY_RESTRICTED').length,
    unknown: sources.filter((s) => s.rightsStatus === 'UNKNOWN').length,
    bySeries: Object.fromEntries(
      SERIES.map((s) => [
        s.id,
        {
          original: sources.filter((r) => r.series === s.id && r.rightsStatus === 'VOA_ORIGINAL_PUBLIC_DOMAIN').length,
          mixed: sources.filter((r) => r.series === s.id && r.rightsStatus === 'MIXED_RIGHTS_REVIEW_REQUIRED').length,
          other: sources.filter(
            (r) => r.series === s.id && (r.rightsStatus === 'UNKNOWN' || r.rightsStatus === 'THIRD_PARTY_RESTRICTED'),
          ).length,
        },
      ]),
    ),
    externalCreditExamples: sources
      .filter((s) => s.externalCredits.length)
      .slice(0, 25)
      .map((s) => ({ id: s.id, credits: s.externalCredits })),
  };
  write(
    'rights',
    rights,
    [
      '# VOA Rights Audit',
      '',
      `- VOA original (public domain): **${rights.voaOriginal}**`,
      `- Mixed rights — review required: **${rights.mixed}**`,
      `- Third-party restricted: **${rights.restricted}**`,
      `- Unknown (quarantined): **${rights.unknown}**`,
      '',
      '## External credits (sample)',
      ...rights.externalCreditExamples.map((e) => `- ${e.id}: ${e.credits[0]}`),
    ].join('\n'),
  );

  /* levels */
  const levels = {
    byLevel: Object.fromEntries(
      ['a0', 'a1', 'a2', 'b1', 'b2'].map((l) => [l, resources.filter((r) => r.level.inferred === l).length]),
    ),
    sourceVsInferred: SERIES.map((s) => ({
      series: s.id,
      sourceLevel: s.levelHint ?? 'unlabeled',
      a0a1: resources.filter((r) => r.series === s.id && (r.level.inferred === 'a0' || r.level.inferred === 'a1'))
        .length,
      a2b1: resources.filter((r) => r.series === s.id && (r.level.inferred === 'a2' || r.level.inferred === 'b1'))
        .length,
      b2: resources.filter((r) => r.series === s.id && r.level.inferred === 'b2').length,
    })),
  };
  write('levels', levels);

  /* series */
  const seriesReport = Object.fromEntries(
    SERIES.map((s) => [
      s.id,
      {
        name: s.name,
        kind: s.kind,
        resources: resources.filter((r) => r.series === s.id).length,
        avgConfidence: resources.filter((r) => r.series === s.id).length
          ? Math.round(
              (resources.filter((r) => r.series === s.id).reduce((a, r) => a + r.level.confidence, 0) /
                resources.filter((r) => r.series === s.id).length) *
                100,
            ) / 100
          : 0,
      },
    ]),
  );
  write('series', seriesReport);
}
