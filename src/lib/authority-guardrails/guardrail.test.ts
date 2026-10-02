import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import dagJson from '../../../docs/flashday/W2_MIGRATION_DAG.json';
import manifestJson from './legacy-claim-sites.json';
import { detectSensitiveSources, extractAllOccurrences, SOURCE_IDS } from './patterns';

/**
 * W2-G01 — site-level authority guardrails.
 *
 * The manifest freezes the sensitive-read baseline at *occurrence multiset*
 * level: for each (file, source) the lines claimed by manifest sites must
 * equal the detected sensitive lines WITH COUNTS — adding, removing,
 * duplicating, or editing a sensitive line (even in a file+family already
 * inventoried, even an exact copy of an existing line) fails until a human
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

/** Line → count multiset for a normalized-occurrence list. */
function toCountMap(lines: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
  return counts;
}

/** Occurrence multiset per (file, source) claimed by manifest sites. */
function manifestOccurrences(): Map<string, Map<string, Map<string, number>>> {
  const map = new Map<string, Map<string, Map<string, number>>>();
  for (const site of manifest.sites) {
    if (!map.has(site.file)) map.set(site.file, new Map());
    const fam = map.get(site.file)!;
    if (!fam.has(site.source)) fam.set(site.source, new Map());
    const counts = fam.get(site.source)!;
    for (const line of site.occurrences) counts.set(line, (counts.get(line) ?? 0) + 1);
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
  it('manifest claims exactly the detected occurrence multiset for every (file, source)', () => {
    const owned = manifestOccurrences();
    const detected = scanProductionFiles(root);
    const problems: string[] = [];
    // Detected → owned: every detected line copy must be claimed (no unowned).
    for (const [file, fams] of detected) {
      for (const [source, lines] of Object.entries(fams)) {
        if (!lines) continue;
        const ownedCounts = owned.get(file)?.get(source);
        if (!ownedCounts) {
          problems.push(`${file}::${source} — no manifest site covers this source`);
          continue;
        }
        for (const [line, count] of toCountMap(lines)) {
          const oc = ownedCounts.get(line) ?? 0;
          if (oc !== count)
            problems.push(
              `${file}::${source} "${line.slice(0, 80)}" — manifest claims ${oc}, source has ${count}`,
            );
        }
      }
    }
    // Owned → detected: over-claimed or stale (owned where nothing detects).
    for (const [file, fams] of owned) {
      for (const [source, ownedCounts] of fams) {
        const detectedCounts = toCountMap(detected.get(file)?.[source] ?? []);
        for (const [line, count] of ownedCounts) {
          const dc = detectedCounts.get(line) ?? 0;
          if (dc !== count && detected.get(file)?.[source])
            problems.push(
              `${file}::${source} "${line.slice(0, 80)}" — manifest claims ${count}, source has ${dc}`,
            );
          else if (dc !== count)
            problems.push(`${file}::${source} — ${count} claimed line(s) never detected`);
        }
      }
    }
    expect(
      problems,
      `occurrence multiset drift — re-classify changed sensitive reads:\n${problems.join('\n')}`,
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

  it('site ids are unique', () => {
    const ids = new Set<string>();
    const dupes: string[] = [];
    for (const site of manifest.sites) {
      if (ids.has(site.id)) dupes.push(`duplicate id ${site.id}`);
      ids.add(site.id);
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

    // Set-based occurrence check (the W2-01R residual weakness): the new line
    // is not in the claimed set → FAILS.
    const owned = manifestOccurrences().get(file)?.get('records') ?? new Map<string, number>();
    const detectedNow = extractAllOccurrences(mutated)['records'] ?? [];
    const uncovered = detectedNow.filter((l) => !owned.has(l));
    expect(uncovered).toContain('const mastered = records.filter((r) => r.accuracy > 80);');
  });

  it('I: identical-line duplication reproduces the set-coverage multiplicity bypass', () => {
    // W2-01R residual weakness: coverage compared Sets, so duplicating an
    // already-inventoried line verbatim collapsed to the same set entry.
    // `accuracy: record.accuracy,` is claimed exactly once by
    // `lib-today-review.records-display`.
    const file = 'src/lib/today-review.ts';
    const duplicatedLine = 'accuracy: record.accuracy,';
    const baseline = readFileSync(join(root, file), 'utf8');
    const mutated = `${baseline}\n  ${duplicatedLine}\n`;

    const owned = manifestOccurrences().get(file)?.get('records') ?? new Map<string, number>();
    expect(owned.get(duplicatedLine), 'baseline must claim this line exactly once').toBe(1);

    // Set-based coverage (W2-01R): both copies satisfy `owned.has(line)` →
    // the duplication passes undetected. This is the documented bypass.
    const detectedNow = extractAllOccurrences(mutated)['records'] ?? [];
    const setCovered = detectedNow.every((l) => owned.has(l));
    expect(setCovered, 'set-based coverage cannot see the duplicated read').toBe(true);

    // Multiset coverage (W2-01R2): detected count 2 ≠ claimed count 1 → FAILS.
    const detectedCounts = toCountMap(detectedNow);
    expect(detectedCounts.get(duplicatedLine)).toBe(2);
    expect(detectedCounts.get(duplicatedLine)).not.toBe(owned.get(duplicatedLine));
  });
});
