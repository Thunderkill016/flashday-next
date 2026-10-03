/* FD-VOA-CORPUS-01 — pipeline-script invariants (caps, merges, artifact format). */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LearningMediaAsset, VoaLearningResource, VoaSourceRecord } from '../../src/lib/voa-corpus/types.ts';
import { buildMediaAsset, mediaAssetId } from '../../src/lib/voa-corpus/media.ts';
import type { ManifestRow } from './discover.ts';
import { fetchRecords, SERIES_CAP } from './fetch.ts';
import { linkAndIndex } from './links.ts';
import { readNdjson, writeJson, writeNdjson } from './ndjson.ts';

const TMP = mkdtempSync(join(tmpdir(), 'voa-pipeline-'));

function row(series: string, contentId: string): ManifestRow {
  return { canonicalUrl: `https://learningenglish.voanews.com/a/${contentId}.html`, contentId, series, discoveredFrom: 'test' };
}

function record(series: string, contentId: string): VoaSourceRecord {
  return {
    id: `voa:${contentId}`,
    canonicalUrl: `https://learningenglish.voanews.com/a/${contentId}.html`,
    series,
    title: `t${contentId}`,
    audio: [],
    video: [],
    images: [],
    documents: [],
    sourceCredits: [],
    externalCredits: [],
    rightsStatus: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
    rightsReasons: [],
    discoveredFrom: 'test',
    fetchedAt: '2026-01-01T00:00:00Z',
    contentHash: 'x',
  };
}

describe('generated artifact format (repo lint contract)', () => {
  it('writeJson emits pretty JSON terminated by exactly one newline', () => {
    const p = join(TMP, 'out.json');
    writeJson(p, { a: 1 });
    const raw = readFileSync(p, 'utf8');
    expect(raw).toBe('{\n  "a": 1\n}\n');
  });

  it('writeNdjson round-trips rows and ends with a newline', () => {
    const p = join(TMP, 'out.ndjson');
    writeNdjson(p, [{ x: 1 }, { x: 2 }]);
    const raw = readFileSync(p, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw.endsWith('\n\n')).toBe(false);
    expect(readNdjson(p)).toEqual([{ x: 1 }, { x: 2 }]);
  });
});

describe('fetchRecords (§10 incremental, §28 caps)', () => {
  const build = async (r: ManifestRow) => record(r.series, r.contentId);

  it('bounds a capped series at SERIES_CAP while uncapped series run to completion', async () => {
    const capped = Array.from({ length: SERIES_CAP['voa-voa60'] + 20 }, (_, i) => row('voa-voa60', `z${i}`));
    const uncapped = Array.from({ length: 5 }, (_, i) => row('voa-lle-level1', `l${i}`));
    const { records, fetched } = await fetchRecords([...capped, ...uncapped], { build });
    expect(records.filter((r) => r.series === 'voa-voa60')).toHaveLength(SERIES_CAP['voa-voa60']);
    expect(records.filter((r) => r.series === 'voa-lle-level1')).toHaveLength(5);
    expect(fetched).toBe(SERIES_CAP['voa-voa60'] + 5);
  });

  it('merges into prior records by id — a second run composes instead of clobbering', async () => {
    const prior = [record('voa-lle-level1', 'old1'), record('voa-anna', 'keep1')];
    const { records } = await fetchRecords([row('voa-lle-level1', 'new1')], { build, prior });
    const ids = records.map((r) => r.id).sort();
    expect(ids).toEqual(['voa:keep1', 'voa:new1', 'voa:old1']);
  });

  it('a re-fetched id replaces its prior row rather than duplicating', async () => {
    const prior = [record('voa-anna', 'dup1')];
    const { records } = await fetchRecords([row('voa-anna', 'dup1')], { build, prior });
    expect(records).toHaveLength(1);
  });

  it('honours the `only` series filter and counts null builds as failures', async () => {
    const manifest = [row('voa-anna', 'a1'), row('voa-lle-level1', 'b1'), row('voa-anna', 'a2')];
    const { records, failures } = await fetchRecords(manifest, {
      only: new Set(['voa-anna']),
      build: async (r) => (r.contentId === 'a2' ? null : record(r.series, r.contentId)),
    });
    expect(records.map((r) => r.id)).toEqual(['voa:a1']);
    expect(failures).toEqual([manifest[2].canonicalUrl]);
  });
});

/* FD-VOA-CORPUS-01 R2 — the offline search index must not bypass the
 * verified-audio gate: raw ref counts are "discovered", never usable. */
describe('linkAndIndex search projection (external-review blocker 1)', () => {
  const AUDIO_URL = 'https://voa-audio.voanews.eu/t/x.mp3';
  const res = (audioRefs: string[], verified: boolean): VoaLearningResource => ({
    id: `voa:idx-${audioRefs.length}-${verified}`,
    kind: 'course_lesson',
    series: 'voa-lle-level1',
    title: 't',
    text: 'hello where are you from',
    audioRefs,
    videoRefs: [],
    documentRefs: [],
    level: { inferred: 'a1', confidence: 0.8 },
    enrichment: {
      knownHeadwords: 0,
      outOfBandWords: [],
      oxfordCoverage: {},
      lexicalDensity: 0.5,
      targetCandidates: [],
      knownChunks: [],
      newChunks: [],
      domainChunks: [],
      communicativeFunctions: [],
      capabilities: [],
      grammarFeatures: [],
      listeningFeatures: [],
      pronunciationFeatures: [],
      topicTags: [],
    },
    source: {
      publisher: 'Voice of America',
      canonicalUrl: 'https://learningenglish.voanews.com/a/x/1.html',
      publicDomainVerified: verified,
      attribution: 'a',
      contentHash: 'h',
      sourceRevision: 1,
    },
    pipelineState: 'ENRICHED',
  });
  const asset = (rights: LearningMediaAsset['rightsStatus'], resolvable: boolean): LearningMediaAsset => {
    const a = buildMediaAsset({ asset: { url: AUDIO_URL, kind: 'audio' }, sourceResourceId: 'voa:src', rightsStatus: rights });
    a.resolvable = resolvable;
    return a;
  };
  const ref = mediaAssetId(AUDIO_URL);

  it('unresolved PD audio => discovered > 0, verified = 0, hasUsableAudio = false', () => {
    const { index } = linkAndIndex([res([ref], true)], [asset('VOA_ORIGINAL_PUBLIC_DOMAIN', false)]);
    expect(index[0].discoveredAudioCount).toBe(1);
    expect(index[0].verifiedAudioCount).toBe(0);
    expect(index[0].verifiedAudioAssetIds).toEqual([]);
    expect(index[0].hasUsableAudio).toBe(false);
  });

  it('MIXED audio => verified = 0 even when resolvable', () => {
    const { index } = linkAndIndex([res([ref], false)], [asset('MIXED_RIGHTS_REVIEW_REQUIRED', true)]);
    expect(index[0].verifiedAudioCount).toBe(0);
    expect(index[0].hasUsableAudio).toBe(false);
  });

  it('resolvable PD audio => verified > 0 with the exact media ids', () => {
    const { index } = linkAndIndex([res([ref], true)], [asset('VOA_ORIGINAL_PUBLIC_DOMAIN', true)]);
    expect(index[0].verifiedAudioCount).toBe(1);
    expect(index[0].verifiedAudioAssetIds).toEqual([ref]);
    expect(index[0].hasUsableAudio).toBe(true);
    /* source-level rights state stays labelled separately — a PD source
     * with unresolved audio is discoverable but not "usable audio" */
    expect(index[0].publicDomain).toBe(true);
    expect(index[0].discoveredAudioCount).toBe(1);
  });

  it('no audio => zero across both projections, never a phantom usable claim', () => {
    const { index } = linkAndIndex([res([], true)], []);
    expect(index[0].discoveredAudioCount).toBe(0);
    expect(index[0].verifiedAudioCount).toBe(0);
    expect(index[0].hasUsableAudio).toBe(false);
  });
});
