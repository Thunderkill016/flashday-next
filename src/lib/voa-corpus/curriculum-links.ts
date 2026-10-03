/*
 * FD-VOA-CORPUS-01 §20/§33/§40/§48 — curriculum linking.
 *
 * VOA resources link to authored curriculum as AUTHENTIC_REENCOUNTER /
 * audio-candidate / grammar-support — never as replacement lesson text
 * and never minting evidence by itself (§41).
 */
import { ALL_KNOWLEDGE } from '../content-factory/knowledge/index.ts';
import { recyclingReport } from '../content-factory/recycling.ts';
import { V2_LESSONS } from '../fd-content-v2/index.ts';
import type { CurriculumLink, RecyclingMatch, VoaLearningResource } from './types.ts';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

interface GapEntry {
  chunk: string;
  homeLesson: string;
}

/* 95-gap list: chunks introduced by a V2 lesson but never recycled or
 * transferred — the exact same derivation as the coverage report.
 * Memoized: V2_LESSONS is a static authored set, and recyclingReport
 * over 142 lessons is expensive to recompute per call. */
let gapCache: GapEntry[] | undefined;

export function curriculumGaps(): GapEntry[] {
  if (!gapCache) {
    gapCache = [];
    for (const r of recyclingReport(V2_LESSONS))
      if (r.recycledBy.length === 0 && r.transferredIn.length === 0)
        gapCache.push({ chunk: r.chunk, homeLesson: r.homeLesson });
  }
  return gapCache;
}

/* Per-resource links to the 142-lesson curriculum:
 *  - known-chunk hits → authentic reencounter for that lesson/target
 *  - capability hits  → capability-level reencounter
 *  - grammar series   → grammar-support reference
 *  - audio present    → audio candidate for matching lessons          */
export function linkResource(res: VoaLearningResource): CurriculumLink[] {
  const links: CurriculumLink[] = [];
  const ntext = ` ${norm(`${res.text} ${res.transcript ?? ''}`)} `;
  const hasAudio = res.audioRefs.length > 0;

  for (const lesson of V2_LESSONS) {
    let lessonLinked = false;
    for (const t of lesson.targets) {
      const c = norm(t.chunk);
      if (c.length >= 3 && ntext.includes(` ${c} `)) {
        links.push({
          voaResourceId: res.id,
          kind: 'authentic-reencounter',
          lessonId: lesson.id,
          targetId: t.id,
          matchedSurface: t.chunk,
          level: res.level.inferred,
          confidence: res.level.confidence,
        });
        lessonLinked = true;
      }
    }
    if (!lessonLinked) {
      const sharedCaps = lesson.capabilities.filter((c) => res.enrichment.capabilities.includes(c));
      if (sharedCaps.length)
        links.push({
          voaResourceId: res.id,
          kind: 'authentic-reencounter',
          lessonId: lesson.id,
          capabilityId: sharedCaps[0],
          matchedSurface: `capability:${sharedCaps.join(',')}`,
          level: res.level.inferred,
          confidence: res.level.confidence * 0.7,
        });
    }
  }

  if (hasAudio)
    for (const l of links.filter((x) => x.kind === 'authentic-reencounter'))
      links.push({ ...l, kind: 'audio-candidate' });

  return links;
}

/* §20 — for each uncovered curriculum chunk find VOA occurrences.
 * Never alters the article; only links when the chunk genuinely occurs. */
export function matchGaps(resources: VoaLearningResource[]): RecyclingMatch[] {
  const gaps = curriculumGaps();
  const matches: RecyclingMatch[] = [];
  for (const gap of gaps) {
    const g = norm(gap.chunk);
    if (g.length < 3) continue;
    for (const res of resources) {
      const text = `${norm(res.text)} ${norm(res.transcript ?? '')}`;
      const idx = text.indexOf(g);
      if (idx < 0) continue;
      const start = Math.max(0, idx - 60);
      const occurrence = text.slice(start, idx + g.length + 60).trim();
      matches.push({
        gapChunk: gap.chunk,
        homeLesson: gap.homeLesson,
        voaResourceId: res.id,
        voaTitle: res.title,
        occurrence,
        level: res.level.inferred,
        usable:
          res.source.publicDomainVerified &&
          (res.level.inferred === 'a0' || res.level.inferred === 'a1' || res.level.inferred === 'a2'),
      });
      break; // first usable occurrence per gap is enough for the report
    }
  }
  return matches;
}

/* §21 — map resource capability hits to knowledge function ids via the
 * ontology (never invented from titles). */
export function resourceFunctions(res: VoaLearningResource): string[] {
  return res.enrichment.communicativeFunctions.filter((f) => ALL_KNOWLEDGE.some((k) => k.id === f));
}
