import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import dagJson from '../../../docs/flashday/W2_MIGRATION_DAG.json';
import manifestJson from './legacy-claim-sites.json';
import { detectSensitiveSources, SOURCE_IDS } from './patterns';

/**
 * W2-G01 — authority guardrails.
 *
 * Any read of authority-sensitive legacy state (records fields incl. accuracy,
 * FSRS scheduling fields, sessions, weakSpots, pronunciationProgress,
 * learningAttempts, dailyTasks, assessment.currentLevel, the dailyPlan cache)
 * must be inventoried in `legacy-claim-sites.json` with a classification and a
 * migration owner. Adding a new sensitive read without a manifest entry fails.
 * Removing the read without updating the manifest fails (stale entry).
 */

const CLASSIFICATIONS = [
  'LEGIT_SCHEDULING',
  'LEGIT_HISTORY',
  'LEGIT_ANALYTICS',
  'LEGIT_PRESENTATION',
  'LEGIT_CANDIDATE_SIGNAL',
  'CAPABILITY_CLAIM',
  'AMBIGUOUS',
] as const;

const SCAN_EXTENSIONS = /\.(ts|tsx|js)$/;
const EXCLUDE = [
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /src\/lib\/authority-guardrails\//,
  /src\/lib\/i18n\/messages\//,
  /src\/vnext\//,
];

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (SCAN_EXTENSIONS.test(name)) yield p;
  }
}

function scanProductionFiles(root: string): Map<string, string[]> {
  const hits = new Map<string, string[]>();
  for (const abs of walk(join(root, 'src'))) {
    const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
    if (EXCLUDE.some((re) => re.test(rel))) continue;
    const sources = detectSensitiveSources(readFileSync(abs, 'utf8'));
    if (sources.length) hits.set(rel, sources);
  }
  return hits;
}

type Site = {
  file: string;
  source: string;
  classification: string;
  reason: string;
  migrationNode: string | null;
};

const root = process.cwd();
const manifest = manifestJson as { sites: Site[] };
const manifestKeys = new Set(manifest.sites.map((s) => `${s.file}::${s.source}`));
const dagNodeIds = new Set(dagJson.nodes.map((n: { id: string }) => n.id));

describe('W2-G01 authority guardrails', () => {
  it('every sensitive legacy read in production code is inventoried', () => {
    const missing: string[] = [];
    for (const [file, sources] of scanProductionFiles(root)) {
      for (const source of sources) {
        if (!manifestKeys.has(`${file}::${source}`)) missing.push(`${file}::${source}`);
      }
    }
    expect(
      missing,
      `new sensitive reads must be classified in legacy-claim-sites.json:\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  it('no stale manifest entries — every entry still detects its source', () => {
    const stale: string[] = [];
    for (const site of manifest.sites) {
      const abs = join(root, site.file);
      if (!existsSync(abs)) {
        stale.push(`${site.file}::${site.source} (file removed)`);
        continue;
      }
      const detected = detectSensitiveSources(readFileSync(abs, 'utf8'));
      if (!detected.includes(site.source as never)) {
        stale.push(`${site.file}::${site.source} (pattern no longer matches)`);
      }
    }
    expect(
      stale,
      `stale manifest entries — remove or re-classify:\n${stale.join('\n')}`,
    ).toEqual([]);
  });

  it('manifest entries are schema-valid', () => {
    for (const site of manifest.sites) {
      expect(
        CLASSIFICATIONS,
        `${site.file}::${site.source} has unknown classification`,
      ).toContain(site.classification);
      expect(SOURCE_IDS, `${site.file}::${site.source} has unknown source`).toContain(site.source);
      expect(site.reason.length, `${site.file}::${site.source} needs a reason`).toBeGreaterThan(0);
    }
  });

  it('no AMBIGUOUS classifications remain', () => {
    const ambiguous = manifest.sites.filter((s) => s.classification === 'AMBIGUOUS');
    expect(
      ambiguous.map((s) => `${s.file}::${s.source}`),
      'AMBIGUOUS sites must be resolved before this gate passes',
    ).toEqual([]);
  });

  it('every CAPABILITY_CLAIM names a migration owner in the W2 DAG', () => {
    const claims = manifest.sites.filter((s) => s.classification === 'CAPABILITY_CLAIM');
    expect(claims.length, 'expected at least one inventoried capability claim').toBeGreaterThan(0);
    for (const site of claims) {
      expect(
        site.migrationNode,
        `${site.file}::${site.source} is a CAPABILITY_CLAIM without a migrationNode`,
      ).not.toBeNull();
      expect(
        dagNodeIds.has(site.migrationNode as string),
        `${site.file}::${site.source} migrationNode ${site.migrationNode} is not a DAG node`,
      ).toBe(true);
    }
  });

  it('every migrationNode reference resolves to a DAG node', () => {
    for (const site of manifest.sites) {
      if (site.migrationNode === null) continue;
      expect(
        dagNodeIds.has(site.migrationNode),
        `${site.file}::${site.source} references unknown node ${site.migrationNode}`,
      ).toBe(true);
    }
  });

  it('expected CAPABILITY_CLAIM sites are captured', () => {
    const claims = new Set(
      manifest.sites
        .filter((s) => s.classification === 'CAPABILITY_CLAIM')
        .map((s) => `${s.file}::${s.source}`),
    );
    // Known capability claims discovered in the W2-01 audit — a claim removed
    // from this set means either the site was fixed (good: remove the manifest
    // entry) or the manifest regressed.
    expect(claims).toContain('src/lib/daily-plan.ts::records');
    expect(claims).toContain('src/lib/chat-analytics.ts::records');
    expect(claims).toContain('src/components/learning/lesson-workshop.tsx::weakSpots');
  });
});

describe('adversarial detection — sneaky authority reads must be caught', () => {
  it('A: accuracy-threshold mastery claims are detected', () => {
    const snippet = 'if (record.accuracy > 80) showBadge("mastered");';
    expect(detectSensitiveSources(snippet)).toContain('records');
  });

  it('B: FSRS due-ordering is detected (allowed only as LEGIT_SCHEDULING)', () => {
    const snippet = 'queue.sort((a, b) => a.fsrsCard.due - b.fsrsCard.due);';
    expect(detectSensitiveSources(snippet)).toContain('fsrs');
    // Policy check: scheduling use is legitimate — the manifest proves it for
    // the real sites, and no CAPABILITY_CLAIM may cite fsrs ordering.
    const fsrsClaims = manifest.sites.filter(
      (s) => s.source === 'fsrs' && s.classification === 'CAPABILITY_CLAIM',
    );
    expect(
      fsrsClaims,
      'FSRS scheduling state must never be a capability claim — see STATE_AUTHORITY.md',
    ).toEqual([]);
  });

  it('C: weakSpot.resolved reads are detected even in render paths', () => {
    const snippet = 'const label = weakSpot.resolved ? "Recovered" : "Needs practice";';
    expect(detectSensitiveSources(snippet)).toContain('weakSpots');
  });

  it('D: assessment.currentLevel for onboarding hints is detected', () => {
    const snippet = 'const band = useAssessmentStore((s) => s.currentLevel); suggest(band);';
    expect(detectSensitiveSources(snippet)).toContain('assessment.currentLevel');
  });

  it('E: alias helpers are caught via type imports and helper names', () => {
    const byType = 'function weakest(rows: LearningRecord[]) { return rows[0].accuracy; }';
    expect(detectSensitiveSources(byType)).toContain('records');
    const byHelper = 'const step = deriveTextCycle(lesson.id, source, attempts, now);';
    expect(detectSensitiveSources(byHelper)).toContain('learningAttempts');
  });
});
