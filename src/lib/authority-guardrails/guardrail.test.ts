import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import dagJson from '../../../docs/flashday/W2_MIGRATION_DAG.json';
import manifestJson from './legacy-claim-sites.json';
import { detectSensitiveSources, extractAllOccurrences, SOURCE_IDS } from './patterns';

/**
 * W2-G01 — site-level authority guardrails.
 *
 * The manifest freezes the sensitive-read baseline at *occurrence* level: for
 * each (file, source) the union of manifest-site `occurrences` must exactly
 * equal the detected sensitive lines. Adding, removing, or editing a sensitive
 * line — even in a file+family already inventoried — fails until a human
 * re-classifies the site.
 *
 * The scanner detects change; the manifest records human semantics. A passed
 * suite proves baseline integrity, not semantic correctness.
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

function scanProductionFiles(root: string): Map<string, Partial<Record<string, string[]>>> {
  const hits = new Map<string, Partial<Record<string, string[]>>>();
  for (const abs of walk(join(root, 'src'))) {
    const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
    if (EXCLUDE.some((re) => re.test(rel))) continue;
    const occurrences = extractAllOccurrences(readFileSync(abs, 'utf8'));
    if (Object.keys(occurrences).length) hits.set(rel, occurrences);
  }
  return hits;
}

type Site = {
  id: string;
  file: string;
  source: string;
  anchor: string;
  occurrences: string[];
  classification: string;
  reason: string;
  migrationNode: string | null;
  transitional?: boolean;
};

const root = process.cwd();
const manifest = manifestJson as { sites: Site[] };
const dagNodeIds = new Set(dagJson.nodes.map((n: { id: string }) => n.id));

/** Occurrences per (file, source) claimed by manifest sites. */
function manifestOccurrences(): Map<string, Map<string, Set<string>>> {
  const map = new Map<string, Map<string, Set<string>>>();
  for (const site of manifest.sites) {
    if (!map.has(site.file)) map.set(site.file, new Map());
    const fam = map.get(site.file)!;
    if (!fam.has(site.source)) fam.set(site.source, new Set());
    for (const line of site.occurrences) fam.get(site.source)!.add(line);
  }
  return map;
}

/**
 * Emulates the W2-01 (pre-revision) file::source-level check for the bypass
 * reproduction: a (file, source) pair passes if any manifest site covers it.
 */
function legacyFileLevelKeys(): Set<string> {
  return new Set(manifest.sites.map((s) => `${s.file}::${s.source}`));
}

describe('W2-G01 site-level authority guardrails', () => {
  it('every detected sensitive occurrence is owned by a manifest site', () => {
    const covered = manifestOccurrences();
    const uncovered: string[] = [];
    for (const [file, fams] of scanProductionFiles(root)) {
      for (const [source, lines] of Object.entries(fams)) {
        if (!lines) continue;
        const owned = covered.get(file)?.get(source) ?? new Set<string>();
        for (const line of lines) {
          if (!owned.has(line)) uncovered.push(`${file}::${source} → ${line.slice(0, 100)}`);
        }
      }
    }
    expect(
      uncovered,
      `new sensitive occurrences must be classified into a manifest site:\n${uncovered.join('\n')}`,
    ).toEqual([]);
  });

  it('no stale manifest occurrences — every claimed line still detects', () => {
    const stale: string[] = [];
    for (const site of manifest.sites) {
      const abs = join(root, site.file);
      if (!existsSync(abs)) {
        stale.push(`${site.id} (file removed)`);
        continue;
      }
      const detected = new Set(
        extractAllOccurrences(readFileSync(abs, 'utf8'))[site.source as never] ?? [],
      );
      for (const line of site.occurrences) {
        if (!detected.has(line)) stale.push(`${site.id} stale line: ${line.slice(0, 100)}`);
      }
    }
    expect(stale, `stale manifest occurrences — re-review the site:\n${stale.join('\n')}`).toEqual(
      [],
    );
  });

  it('site ids are unique and occurrences do not overlap within (file, source)', () => {
    const ids = new Set<string>();
    const dupes: string[] = [];
    const owner = new Map<string, string>();
    for (const site of manifest.sites) {
      if (ids.has(site.id)) dupes.push(`duplicate id ${site.id}`);
      ids.add(site.id);
      for (const line of site.occurrences) {
        const key = `${site.file}::${site.source}::${line}`;
        if (owner.has(key)) dupes.push(`${key.slice(0, 90)} claimed by ${owner.get(key)} AND ${site.id}`);
        else owner.set(key, site.id);
      }
    }
    expect(dupes).toEqual([]);
  });

  it('manifest entries are schema-valid', () => {
    for (const site of manifest.sites) {
      expect(
        CLASSIFICATIONS,
        `${site.id} has unknown classification`,
      ).toContain(site.classification);
      expect(SOURCE_IDS, `${site.id} has unknown source`).toContain(site.source);
      expect(site.reason.length, `${site.id} needs a reason`).toBeGreaterThan(0);
      expect(site.occurrences.length, `${site.id} owns zero occurrences`).toBeGreaterThan(0);
      expect(site.anchor.length, `${site.id} needs an anchor`).toBeGreaterThan(0);
    }
  });

  it('no AMBIGUOUS classifications remain', () => {
    const ambiguous = manifest.sites.filter((s) => s.classification === 'AMBIGUOUS');
    expect(
      ambiguous.map((s) => s.id),
      'AMBIGUOUS sites must be resolved before this gate passes',
    ).toEqual([]);
  });

  it('every CAPABILITY_CLAIM names a migration owner in the W2 DAG', () => {
    const claims = manifest.sites.filter((s) => s.classification === 'CAPABILITY_CLAIM');
    expect(claims.length, 'expected inventoried capability claims').toBeGreaterThan(0);
    for (const site of claims) {
      expect(
        site.migrationNode,
        `${site.id} is a CAPABILITY_CLAIM without a migrationNode`,
      ).not.toBeNull();
      expect(
        dagNodeIds.has(site.migrationNode as string),
        `${site.id} migrationNode ${site.migrationNode} is not a DAG node`,
      ).toBe(true);
    }
  });

  it('every migrationNode reference resolves to a DAG node', () => {
    for (const site of manifest.sites) {
      if (site.migrationNode === null) continue;
      expect(
        dagNodeIds.has(site.migrationNode),
        `${site.id} references unknown node ${site.migrationNode}`,
      ).toBe(true);
    }
  });

  it('expected CAPABILITY_CLAIM sites are captured', () => {
    const claims = new Set(
      manifest.sites
        .filter((s) => s.classification === 'CAPABILITY_CLAIM')
        .map((s) => s.id),
    );
    expect(claims).toContain('lib-daily-plan.records-weakness-heuristic');
    expect(claims).toContain('lib-chat-analytics.records-weakness-claim');
    expect(claims).toContain('components-learning-lesson-workshop.weakSpots-resolve-claim');
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
    const byShortVar = 'const mastered = records.filter((r) => r.accuracy > 80);';
    expect(detectSensitiveSources(byShortVar)).toContain('records');
    const byComparator = 'items.sort((a, b) => a.accuracy - b.accuracy);';
    expect(detectSensitiveSources(byComparator)).toContain('records');
  });

  it('H: same-file + same-family new read reproduces the pre-revision bypass', () => {
    // Reproduction of the W2-01 weakness: a file already inventoried for
    // `records` gained a second semantic read. The old file::source check
    // could not distinguish it — the pair was already whitelisted.
    const file = 'src/lib/today-review.ts';
    const baseline = readFileSync(join(root, file), 'utf8');
    const mutated = `${baseline}\nconst mastered = records.filter((r) => r.accuracy > 80);\n`;

    // Legacy file::source-level check: the pair is already covered → PASSES
    // (this is the documented bypass).
    const legacyDetected = detectSensitiveSources(mutated);
    const legacyCovered = legacyDetected.every((s) => legacyFileLevelKeys().has(`${file}::${s}`));
    expect(legacyCovered, 'file-level guardrail cannot see the new read').toBe(true);

    // Site-level occurrence check: the new line is an uncovered occurrence → FAILS.
    const owned = manifestOccurrences().get(file)?.get('records') ?? new Set<string>();
    const detectedNow = extractAllOccurrences(mutated)['records'] ?? [];
    const uncovered = detectedNow.filter((l) => !owned.has(l));
    expect(uncovered).toContain('const mastered = records.filter((r) => r.accuracy > 80);');
  });
});
