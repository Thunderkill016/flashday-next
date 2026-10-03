import { describe, expect, it } from 'vitest';
import { detectExternalCredits, auditAsset, auditResource } from './rights';
import { parseArticle } from './parse';
import { headword, properNouns, inferLevel } from './level';
import { normalizeResource } from './normalize';
import { mediaAssetId, buildMediaAsset, dedupeAssets, resolveAudioAssets } from './media';
import type { LearningMediaAsset, VoaAsset, VoaSourceRecord } from './types';

const mp3: VoaAsset = { url: 'https://voa-audio.voanews.eu/2024/01/01/test.mp3', kind: 'audio' };
const mp4: VoaAsset = { url: 'https://voa-video-ns.akamaized.net/2024/test.mp4', kind: 'video' };
const VOA_URL = 'https://learningenglish.voanews.com/a/test-lesson/3355999.html';

/* ── §47 fail-closed rights gate ────────────────────────────────── */
describe('rights gate (§47 fail-closed)', () => {
  it('promotes VOA-original text + VOA-hosted MP3 when nothing contradicts', () => {
    const r = auditResource({
      seriesRightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
      creditLines: [],
      assets: [mp3, mp4],
      canonicalUrl: VOA_URL,
    });
    expect(r.status).toBe('VOA_ORIGINAL_PUBLIC_DOMAIN');
    expect(r.assetAudit.every((a) => a.status === 'VOA_ORIGINAL_PUBLIC_DOMAIN')).toBe(true);
  });

  it('demotes to MIXED when an AP credit line is present', () => {
    const r = auditResource({
      seriesRightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
      creditLines: ['The Associated Press reported this story.'],
      assets: [mp3],
      canonicalUrl: VOA_URL,
    });
    expect(r.status).toBe('MIXED_RIGHTS_REVIEW_REQUIRED');
    expect(r.externalCredits.length).toBeGreaterThan(0);
  });

  it('detects wire-adapted copy: "AP reported … Weaver adapted it for VOA" → MIXED', () => {
    const hits = detectExternalCredits([
      'The Associated Press reported this story. Caty Weaver adapted it for VOA Learning English.',
    ]);
    expect(hits.some((h) => /associated press|wire source/i.test(h.label))).toBe(true);
  });

  it('detects Reuters credit → MIXED', () => {
    const hits = detectExternalCredits(['Reuters reported this story.']);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('rejects an asset hosted outside VOA domains at asset level', () => {
    const apImage: VoaAsset = { url: 'https://cloudfront.apimages.com/x.jpg', kind: 'image' };
    const a = auditAsset(apImage, ['Associated Press']);
    expect(a.status).toBe('THIRD_PARTY_RESTRICTED');
  });

  it('downgrades the page when any asset lives on a non-VOA host', () => {
    const r = auditResource({
      seriesRightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
      creditLines: [],
      assets: [mp3, { url: 'https://getty.example.com/img.jpg', kind: 'image' }],
      canonicalUrl: VOA_URL,
    });
    expect(r.status).toBe('MIXED_RIGHTS_REVIEW_REQUIRED');
  });

  it('never promotes on keyword absence alone — UNKNOWN prior stays UNKNOWN', () => {
    const r = auditResource({
      seriesRightsPrior: 'UNKNOWN',
      creditLines: [],
      assets: [mp3],
      canonicalUrl: VOA_URL,
    });
    expect(r.status).toBe('UNKNOWN');
  });

  it('rejects learner-facing use when canonical URL is missing', () => {
    const r = auditResource({
      seriesRightsPrior: 'VOA_ORIGINAL_PUBLIC_DOMAIN',
      creditLines: [],
      assets: [mp3],
      canonicalUrl: undefined,
    });
    expect(r.status).toBe('UNKNOWN');
  });

  it('keeps MIXED prior conservative even with clean credits', () => {
    const r = auditResource({
      seriesRightsPrior: 'MIXED_RIGHTS_REVIEW_REQUIRED',
      creditLines: [],
      assets: [mp3],
      canonicalUrl: VOA_URL,
    });
    expect(r.status).toBe('MIXED_RIGHTS_REVIEW_REQUIRED');
  });
});

/* ── parser ─────────────────────────────────────────────────────── */
const FIXTURE = `<html><head>
<script type="application/ld+json">{"@type":"NewsArticle","headline":"Lesson 99: Test","url":"${VOA_URL}","datePublished":"2024-01-01","dateModified":"2024-01-02","description":"d","articleSection":"Let's Learn English"}</script>
<title>Lesson 99: Test</title></head><body>
<div class="wsw">
<div class="wsw__embed"><div class="media-block"><a href="/a/999.html">video</a><aside>Embed share</aside></div></div>
<h2 class="wsw__h2">Speaking</h2>
<p>Practice the conversation.</p>
<h2 class="wsw__h2">Conversation</h2>
<p>Anna: Hello! Where are you from?</p>
<p>Maria: I am from Italy.</p>
<h2 class="wsw__h2">Quiz</h2>
<p>Where is Maria from?</p>
<em>The Associated Press reported this story. Caty Weaver adapted it for VOA Learning English.</em>
<a href="https://voa-audio.voanews.eu/x/test.mp3">download audio</a>
<a href="https://voa-video-ns.akamaized.net/x/test.mp4">720p</a>
<a href="https://docs.voanews.eu/x/ws.pdf">worksheet</a>
</div>
<aside class="share">share this</aside>
<div class="footer">copyright footer</div>
</body></html>`;

describe('parseArticle', () => {
  const p = parseArticle(FIXTURE);

  it('reads JSON-LD metadata and canonical URL', () => {
    expect(p.title).toBe('Lesson 99: Test');
    expect(p.publishedAt).toBe('2024-01-01');
    expect(p.canonicalUrl).toBe(VOA_URL);
  });

  it('extracts all wsw__h2 sections in order', () => {
    expect(p.sections.map((s) => s.title)).toEqual(['Speaking', 'Conversation', 'Quiz']);
  });

  it('does not cut the body at a nested embed aside', () => {
    expect(p.bodyText).toContain('Where are you from');
    expect(p.bodyText).toContain('Where is Maria from');
  });

  it('strips embed/player chrome and share tail from body text', () => {
    expect(p.bodyText).not.toContain('Embed share');
    expect(p.bodyText).not.toContain('share this');
  });

  it('uses the Conversation section as transcript', () => {
    expect(p.transcript).toContain('Anna: Hello!');
    expect(p.transcript).toContain('Maria: I am from Italy');
  });

  it('collects media assets by kind', () => {
    expect(p.audio.map((a) => a.url)).toContain('https://voa-audio.voanews.eu/x/test.mp3');
    expect(p.video.map((v) => v.url)).toContain('https://voa-video-ns.akamaized.net/x/test.mp4');
    expect(p.documents.map((d) => d.url)).toContain('https://docs.voanews.eu/x/ws.pdf');
  });

  it('extracts <em> credit lines', () => {
    expect(p.creditLines.some((l) => l.includes('Associated Press'))).toBe(true);
  });
});

/* ── level inference ────────────────────────────────────────────── */
describe('level inference', () => {
  it('reduces common inflections to Oxford headwords', () => {
    expect(headword('tourists')).toBe('tourist');
    expect(headword('countries')).toBe('country');
    expect(headword('carried')).toBe('carry');
  });

  it('flags mid-sentence capitals as proper nouns, not vocabulary load', () => {
    const p = properNouns('She visited Bangladesh and met Anna. The dog ran.');
    expect(p.has('bangladesh')).toBe(true);
    expect(p.has('anna')).toBe(true);
    expect(p.has('the')).toBe(false); // sentence-initial, not proper
  });

  it('infers a1 for beginner dialogue vocabulary', () => {
    const l = inferLevel(
      'Hello. Where are you from? I am from Italy. What is your name? ' +
      'My name is Anna. Nice to meet you. Do you like the city? Yes, I like it very much. ' +
      'Where do you work? I work in an office near the park. It is a good job.',
      'beginning',
    );
    expect(['a0', 'a1']).toContain(l.inferred);
    expect(l.source).toBe('beginning');
  });

  it('keeps low confidence on very short texts', () => {
    const l = inferLevel('Just a few words here.');
    expect(l.confidence).toBeLessThanOrEqual(0.25);
  });
});

/* ── normalization gate ─────────────────────────────────────────── */
function src(over: Partial<VoaSourceRecord>): VoaSourceRecord {
  return {
    id: 'voa:1', canonicalUrl: VOA_URL, series: 'voa-lle-level1', title: 'T',
    audio: [mp3], video: [], images: [], documents: [],
    sourceCredits: [], externalCredits: [],
    rightsStatus: 'VOA_ORIGINAL_PUBLIC_DOMAIN', rightsReasons: [],
    discoveredFrom: 'test', fetchedAt: '2024-01-01', contentHash: 'h',
    articleText: 'Hello. Where are you from? I am from Italy. Nice to meet you here today.',
    ...over,
  };
}

describe('normalizeResource (§50 state machine)', () => {
  it('fails closed on UNKNOWN', () => {
    expect(normalizeResource(src({ rightsStatus: 'UNKNOWN' }))).toBeNull();
  });

  it('fails closed on THIRD_PARTY_RESTRICTED', () => {
    expect(normalizeResource(src({ rightsStatus: 'THIRD_PARTY_RESTRICTED' }))).toBeNull();
  });

  it('rejects empty/truncated payloads', () => {
    expect(normalizeResource(src({ articleText: 'hi' }))).toBeNull();
  });

  it('marks MIXED resources as not public-domain verified but still normalizes', () => {
    const r = normalizeResource(src({ rightsStatus: 'MIXED_RIGHTS_REVIEW_REQUIRED' }));
    expect(r).not.toBeNull();
    expect(r?.source.publicDomainVerified).toBe(false);
  });

  it('produces ENRICHED resources with provenance for verified sources', () => {
    const r = normalizeResource(src({}));
    expect(r?.pipelineState).toBe('ENRICHED');
    expect(r?.source.publicDomainVerified).toBe(true);
    expect(r?.source.canonicalUrl).toBe(VOA_URL);
    expect(r?.audioRefs.length).toBe(1);
  });
});

/* ── enrichment probes stay inside the ontology (§21) ──────────── */
import { mapCapabilities } from './enrich';
import { CAPABILITIES } from '../fd-content-v2/capabilities';

describe('capability probes (§21 — never invented ids)', () => {
  it('every emitted capability id exists in CAPABILITIES', () => {
    const probeText = 'where are you from thank you see you tomorrow how much is this';
    const { capabilities } = mapCapabilities(probeText);
    for (const c of capabilities) expect(CAPABILITIES[c], `phantom capability ${c}`).toBeDefined();
  });

  it('single-word probes respect word boundaries', () => {
    /* 'gate' must not fire inside 'navigate'; 'bug' not inside 'debug' */
    const { capabilities } = mapCapabilities('we navigate the debug console daily');
    expect(capabilities).not.toContain('book-travel');
    expect(capabilities).not.toContain('report-bug');
  });
});

/* ── gap recycling integrity (§20) ─────────────────────────────── */
import { curriculumGaps, matchGaps } from './curriculum-links';
import type { VoaLearningResource } from './types';

describe('matchGaps (§20 — only real occurrences)', () => {
  const res = (text: string, verified: boolean): VoaLearningResource => ({
    id: `voa:t-${verified}`, kind: 'article', title: 'T', text,
    audioRefs: [], videoRefs: [], documentRefs: [], series: 'voa-as-it-is',
    level: { inferred: 'a2', confidence: 0.7 },
    enrichment: {
      knownHeadwords: 0, outOfBandWords: [], oxfordCoverage: {}, lexicalDensity: 0.5,
      targetCandidates: [], knownChunks: [], newChunks: [], domainChunks: [],
      communicativeFunctions: [], capabilities: [], grammarFeatures: [],
      listeningFeatures: [], pronunciationFeatures: [], topicTags: [],
    },
    source: {
      publisher: 'Voice of America', canonicalUrl: VOA_URL,
      publicDomainVerified: verified, attribution: 'a', contentHash: 'h', sourceRevision: 1,
    },
    pipelineState: 'ENRICHED',
  });

  it('only matches chunks that literally occur in resource text', () => {
    const out = matchGaps([res('the weather is nice today and birds sing', true)]);
    for (const m of out) expect('the weather is nice today and birds sing'.includes(m.gapChunk.toLowerCase())).toBe(true);
  });

  it('flags usable only when public-domain verified AND level-appropriate', () => {
    const gap = curriculumGaps()[0];
    expect(gap).toBeDefined();
    const verified = matchGaps([res(`we said "${gap.chunk}" yesterday`, true)]);
    const hit = verified.find((m) => m.gapChunk === gap.chunk);
    expect(hit?.usable).toBe(true);
    const unverified = matchGaps([res(`we said "${gap.chunk}" yesterday`, false)]);
    expect(unverified.find((m) => m.gapChunk === gap.chunk)?.usable).toBe(false);
  });
});

/* ── media registry ─────────────────────────────────────────────── */
describe('media registry (§43/§44)', () => {
  it('derives deterministic ids from asset URL', () => {
    expect(mediaAssetId(mp3.url)).toBe(mediaAssetId(mp3.url));
    expect(mediaAssetId(mp3.url)).not.toBe(mediaAssetId(mp4.url));
  });

  it('requires resolvable proof, defaults unverified', () => {
    const a = buildMediaAsset({ asset: mp3, sourceResourceId: 'voa:1', rightsStatus: 'VOA_ORIGINAL_PUBLIC_DOMAIN' });
    expect(a.resolvable).toBe(false);
    expect(a.provider).toBe('voa');
  });

  it('dedupes assets shared across pages', () => {
    const a = buildMediaAsset({ asset: mp3, sourceResourceId: 'voa:1', rightsStatus: 'VOA_ORIGINAL_PUBLIC_DOMAIN' });
    const b = buildMediaAsset({ asset: mp3, sourceResourceId: 'voa:2', rightsStatus: 'VOA_ORIGINAL_PUBLIC_DOMAIN' });
    expect(dedupeAssets([a, b])).toHaveLength(1);
  });
});

/* ── bounded media verification (§43) ───────────────────────────── */
describe('resolveAudioAssets (§43 bounded verification)', () => {
  const asset = (n: number, type: 'audio' | 'video' = 'audio'): LearningMediaAsset =>
    buildMediaAsset({ asset: { url: `https://voa-audio.voanews.eu/t/${n}.${type === 'audio' ? 'mp3' : 'mp4'}`, kind: type }, sourceResourceId: 'voa:1', rightsStatus: 'VOA_ORIGINAL_PUBLIC_DOMAIN' });

  it('checks at most `cap` unresolved audio assets per run', async () => {
    const assets = Array.from({ length: 10 }, (_, i) => asset(i));
    let calls = 0;
    const ok = await resolveAudioAssets(assets, async () => (++calls, true), 3);
    expect(calls).toBe(3);
    expect(ok).toBe(3);
    expect(assets.filter((a) => a.resolvable)).toHaveLength(3);
    expect(assets.filter((a) => !a.resolvable)).toHaveLength(7);
  });

  it('skips already-resolvable and non-audio assets so later runs advance the frontier', async () => {
    const done = asset(0);
    done.resolvable = true;
    const video = asset(1, 'video');
    const pending = [asset(2), asset(3)];
    let calls = 0;
    await resolveAudioAssets([done, video, ...pending], async () => (++calls, false));
    expect(calls).toBe(2);
    expect(pending.every((a) => !a.resolvable)).toBe(true);
    expect(video.resolvable).toBe(false);
  });

  it('a failed HEAD check stays resolvable=false (fail-closed, no caching of misses)', async () => {
    const a = asset(0);
    expect(await resolveAudioAssets([a], async () => false)).toBe(0);
    expect(a.resolvable).toBe(false);
  });
});
