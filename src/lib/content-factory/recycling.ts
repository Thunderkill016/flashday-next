/*
 * Recycling tracker (Part 13) — chunk lifecycle stages.
 *
 * A chunk is `introduced` by its home lesson, `practiced` by chunk-mode
 * affordances, `retrieved` when it is a recall target, `recycled` when a
 * later lesson reuses it inside its input/targets, and `transferred`
 * when a transfer task names it. Appearances are never mastery.
 */
import type { LessonSpec, RecyclingStage } from './types.ts';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export interface ChunkLifecycle {
  chunk: string;
  homeLesson: string;
  stages: RecyclingStage[];
  recycledBy: string[];
  transferredIn: string[];
}

export function recyclingReport(lessons: LessonSpec[]): ChunkLifecycle[] {
  const report = new Map<string, ChunkLifecycle>();
  const chunkToLesson = new Map<string, string>();
  for (const l of lessons)
    for (const t of l.targets)
      if (!chunkToLesson.has(norm(t.chunk))) {
        chunkToLesson.set(norm(t.chunk), l.id);
        report.set(norm(t.chunk), {
          chunk: t.chunk,
          homeLesson: l.id,
          stages: ['introduced', 'practiced', 'retrieved'],
          recycledBy: [],
          transferredIn: [],
        });
      }
  for (const l of lessons) {
    const text = norm(l.input.text);
    for (const [key, lc] of report) {
      if (lc.homeLesson === l.id) continue;
      const uses = text.includes(key) || l.targets.some((t) => norm(t.chunk) === key);
      if (uses && !lc.recycledBy.includes(l.id)) {
        lc.recycledBy.push(l.id);
        if (!lc.stages.includes('recycled')) lc.stages.push('recycled');
      }
      if (norm(l.transferTask.prompt).includes(key)) {
        lc.transferredIn.push(l.id);
        if (!lc.stages.includes('transferred')) lc.stages.push('transferred');
      }
    }
    /* recyclingFrom edges mark intentional reuse even when verbatim reuse differs */
    for (const src of l.recyclingFrom)
      for (const lc of report.values())
        if (lc.homeLesson === src && !lc.recycledBy.includes(l.id)) {
          lc.recycledBy.push(l.id);
          if (!lc.stages.includes('recycled')) lc.stages.push('recycled');
        }
  }
  return [...report.values()];
}
