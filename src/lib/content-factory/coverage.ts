/*
 * Coverage reports (Part 11) — machine + human readable, gaps exposed.
 */

import { CAPABILITIES } from '../fd-content-v2/capabilities.ts';
import { OXFORD_LEVELS } from './knowledge/oxford-levels.generated.ts';
import { RESEARCH_MANIFEST } from './research.ts';
import { SOURCE_MANIFEST } from './sources.ts';
import type { KnowledgeEntry, LessonSpec } from './types.ts';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export interface CoverageReport {
  generatedFor: string;
  lessons: number;
  targets: number;
  uniqueChunks: number;
  byTrack: Record<string, number>;
  byLevel: Record<string, number>;
  capabilityCoverage: Record<string, string[]>;
  functionCoverage: { covered: number; total: number; uncovered: string[] };
  sourceCoverage: Record<string, string[]>;
  researchCoverage: Record<string, string[]>;
  chunkOccurrences: Record<string, number>;
  listeningCoverage: { lessons: number; targets: number };
  pronunciationCoverage: { lessons: number; targets: number };
  l1Coverage: { lessonsWithContrastNote: number };
  vocabLevels: Record<string, number>;
  gaps: string[];
}

export function coverageReport(lessons: LessonSpec[], knowledge: KnowledgeEntry[], packId: string): CoverageReport {
  const byTrack: Record<string, number> = {};
  const byLevel: Record<string, number> = {};
  const capabilityCoverage: Record<string, string[]> = {};
  const sourceCoverage: Record<string, string[]> = {};
  const researchCoverage: Record<string, string[]> = {};
  const chunkOcc: Record<string, number> = {};
  const vocabLevels: Record<string, number> = {};
  let listeningLessons = 0;
  let listeningTargets = 0;
  let pronTargets = 0;
  let contrastNotes = 0;

  const unique = new Set<string>();
  for (const l of lessons) {
    byTrack[l.track] = (byTrack[l.track] ?? 0) + 1;
    byLevel[l.level] = (byLevel[l.level] ?? 0) + 1;
    for (const c of l.capabilities) capabilityCoverage[c] = [...(capabilityCoverage[c] ?? []), l.id];
    for (const s of l.sourceRefs) sourceCoverage[s] = [...(sourceCoverage[s] ?? []), l.id];
    for (const r of l.researchRefs) researchCoverage[r] = [...(researchCoverage[r] ?? []), l.id];
    if (l.track === 'listening') listeningLessons++;
    for (const t of l.targets) {
      unique.add(norm(t.chunk));
      chunkOcc[t.chunk] = (chunkOcc[t.chunk] ?? 0) + 1;
      if (t.kind === 'listening') listeningTargets++;
      if (t.kind === 'pronunciation') pronTargets++;
      if (t.contrastVi) contrastNotes++;
      /* Oxford prior: level of the chunk's last content word */
      const last = norm(t.chunk).split(' ').pop() ?? '';
      const lvl = OXFORD_LEVELS[last];
      if (lvl) vocabLevels[lvl] = (vocabLevels[lvl] ?? 0) + 1;
    }
  }

  /* function coverage: NEP functions reached via lesson capabilities.
   * A lesson covers fn.NN when a capability it trains declares that fn. */
  const fns = knowledge.filter((k) => k.kind === 'function');
  const coveredFns = new Set(lessons.flatMap((l) => l.capabilities).flatMap((c) => CAPABILITIES[c]?.fns ?? []));
  const uncoveredFns = fns.filter((f) => !coveredFns.has(f.id)).map((f) => f.id);

  const gaps: string[] = [];
  for (const c of Object.keys(capabilityCoverage))
    if ((capabilityCoverage[c] ?? []).length < 1) gaps.push(`capability ${c} uncovered`);
  const knownCaps = new Set(lessons.flatMap((l) => l.capabilities));
  for (const f of uncoveredFns) gaps.push(`function ${f} has no lesson coverage`);
  if (!lessons.some((l) => l.track === 'listening')) gaps.push('no listening lessons');
  if (!lessons.some((l) => l.track === 'pronunciation')) gaps.push('no pronunciation lessons');
  if (!lessons.some((l) => l.track === 'developer')) gaps.push('no developer-English lessons');
  const usedSources = new Set(lessons.flatMap((l) => l.sourceRefs));
  for (const id of Object.keys(SOURCE_MANIFEST)) {
    const s = SOURCE_MANIFEST[id];
    if (s.klass === 'LINK_AND_DERIVE' && !usedSources.has(id)) gaps.push(`derivable source ${id} unused by any lesson`);
  }
  const usedResearch = new Set(lessons.flatMap((l) => l.researchRefs));
  for (const id of Object.keys(RESEARCH_MANIFEST))
    if (!usedResearch.has(id)) gaps.push(`research principle ${id} backs no lesson`);
  void knownCaps;

  return {
    generatedFor: packId,
    lessons: lessons.length,
    targets: lessons.reduce((n, l) => n + l.targets.length, 0),
    uniqueChunks: unique.size,
    byTrack,
    byLevel,
    capabilityCoverage,
    functionCoverage: { covered: fns.length - uncoveredFns.length, total: fns.length, uncovered: uncoveredFns },
    sourceCoverage,
    researchCoverage,
    chunkOccurrences: chunkOcc,
    listeningCoverage: { lessons: listeningLessons, targets: listeningTargets },
    pronunciationCoverage: { lessons: lessons.filter((l) => l.track === 'pronunciation').length, targets: pronTargets },
    l1Coverage: { lessonsWithContrastNote: contrastNotes },
    vocabLevels,
    gaps,
  };
}

export function coverageMarkdown(report: CoverageReport): string {
  const lines: string[] = [
    `# Coverage report — ${report.generatedFor}`,
    '',
    `lessons: ${report.lessons} · targets: ${report.targets} · unique chunks: ${report.uniqueChunks}`,
    '',
    '## By track',
    ...Object.entries(report.byTrack).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## By level',
    ...Object.entries(report.byLevel).map(([k, v]) => `- ${k}: ${v}`),
    '',
    `## Listening: ${report.listeningCoverage.lessons} lessons / ${report.listeningCoverage.targets} listening targets`,
    `## Pronunciation: ${report.pronunciationCoverage.lessons} lessons / ${report.pronunciationCoverage.targets} targets`,
    `## L1 contrast notes on targets: ${report.l1Coverage.lessonsWithContrastNote}`,
    '',
    `## Functions covered: ${report.functionCoverage.covered}/${report.functionCoverage.total}`,
    '',
    '## Gaps (exposed, not hidden)',
    ...(report.gaps.length ? report.gaps.map((g) => `- ${g}`) : ['- none']),
    '',
    '## Chunk occurrence (top 20)',
    ...Object.entries(report.chunkOccurrences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([c, n]) => `- ${c}: ${n}`),
  ];
  return lines.join('\n');
}
