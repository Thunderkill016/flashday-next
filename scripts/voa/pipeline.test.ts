/* FD-VOA-CORPUS-01 — pipeline-script invariants (caps, merges, artifact format). */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { VoaSourceRecord } from '../../src/lib/voa-corpus/types.ts';
import type { ManifestRow } from './discover.ts';
import { fetchRecords, SERIES_CAP } from './fetch.ts';
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
