/*
 * Deterministic quality/duplicate analysis (Part 12).
 * Flags duplicates, near-duplicates, over-repetition, imbalance,
 * and targets that never get recycled — no AI in the loop.
 */
import type { LessonSpec } from './types.ts';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const STOP = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'for', 'and', 'is', 'are', 'i', 'you', 'we', 'it']);
const sig = (s: string) =>
  new Set(
    norm(s)
      .split(' ')
      .filter((w) => !STOP.has(w) && w.length > 1),
  );
const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};

export interface QualityIssue {
  kind:
    | 'duplicate-lesson-intent'
    | 'near-duplicate-chunk'
    | 'over-repeated-sentence'
    | 'same-transfer-disguised'
    | 'unbalanced-track'
    | 'overloaded-lesson'
    | 'underloaded-lesson'
    | 'chunk-never-recycled';
  message: string;
  ids: string[];
}

export function analyzeQuality(lessons: LessonSpec[]): QualityIssue[] {
  const issues: QualityIssue[] = [];

  /* Duplicate lesson intents — same task signature. */
  for (let i = 0; i < lessons.length; i++)
    for (let j = i + 1; j < lessons.length; j++) {
      const sim = jaccard(sig(lessons[i].task), sig(lessons[j].task));
      if (sim > 0.6 && lessons[i].track === lessons[j].track)
        issues.push({
          kind: 'duplicate-lesson-intent',
          message: `tasks ${Math.round(sim * 100)}% similar in same track`,
          ids: [lessons[i].id, lessons[j].id],
        });
    }

  /* Near-duplicate chunks across different targets (normalized overlap). */
  const targets = lessons.flatMap((l) => l.targets.map((t) => ({ lesson: l.id, ...t })));
  for (let i = 0; i < targets.length; i++)
    for (let j = i + 1; j < targets.length; j++) {
      if (targets[i].id === targets[j].id) continue;
      const sim = jaccard(sig(targets[i].chunk), sig(targets[j].chunk));
      if (sim >= 0.75 && norm(targets[i].chunk) !== norm(targets[j].chunk))
        issues.push({
          kind: 'near-duplicate-chunk',
          message: `chunks ${Math.round(sim * 100)}% overlap: "${targets[i].chunk}" ~ "${targets[j].chunk}"`,
          ids: [targets[i].id, targets[j].id],
        });
    }

  /* Over-repeated source sentences (same carrier sentence used widely). */
  const sentCount = new Map<string, number>();
  for (const t of targets) sentCount.set(norm(t.sourceSentence), (sentCount.get(norm(t.sourceSentence)) ?? 0) + 1);
  for (const [s, n] of sentCount)
    if (n > 2)
      issues.push({
        kind: 'over-repeated-sentence',
        message: `source sentence reused by ${n} targets: "${s.slice(0, 80)}"`,
        ids: targets.filter((t) => norm(t.sourceSentence) === s).map((t) => t.id),
      });

  /* Disguised same transfer — identical transfer prompt across lessons. */
  const transfers = new Map<string, string[]>();
  for (const l of lessons) {
    const k = norm(l.transferTask.prompt);
    transfers.set(k, [...(transfers.get(k) ?? []), l.id]);
  }
  for (const [p, ids] of transfers)
    if (ids.length > 1)
      issues.push({
        kind: 'same-transfer-disguised',
        message: `identical transfer prompt shared: "${p.slice(0, 80)}"`,
        ids,
      });

  /* Track balance: no track >40% of pack; every lesson 3..8 targets. */
  const byTrack = new Map<string, number>();
  for (const l of lessons) byTrack.set(l.track, (byTrack.get(l.track) ?? 0) + 1);
  for (const [t, n] of byTrack)
    if (n > lessons.length * 0.4)
      issues.push({ kind: 'unbalanced-track', message: `track ${t} holds ${n}/${lessons.length} lessons`, ids: [t] });
  for (const l of lessons) {
    if (l.targets.length > 7)
      issues.push({ kind: 'overloaded-lesson', message: `${l.id} carries ${l.targets.length} targets`, ids: [l.id] });
    if (l.targets.length < 3)
      issues.push({
        kind: 'underloaded-lesson',
        message: `${l.id} carries only ${l.targets.length} targets`,
        ids: [l.id],
      });
  }

  /* Chunk lifecycle: introduced but never recycled later (Part 13). */
  const recyclesInto = new Set(lessons.flatMap((l) => l.recyclingFrom));
  const chunksNeverRecycled: string[] = [];
  const lessonIndex = new Map(lessons.map((l, i) => [l.id, i]));
  for (const l of lessons) {
    if (!recyclesInto.size) break;
    /* a lesson's language is recycled iff some LATER lesson lists it in recyclingFrom */
    const later = lessons.slice((lessonIndex.get(l.id) ?? 0) + 1);
    const isRecycled = later.some((n) => n.recyclingFrom.includes(l.id));
    if (!isRecycled && lessonIndex.get(l.id)! < lessons.length - 3)
      for (const t of l.targets) chunksNeverRecycled.push(t.id);
  }
  if (chunksNeverRecycled.length)
    issues.push({
      kind: 'chunk-never-recycled',
      message: `${chunksNeverRecycled.length} targets belong to lessons never recycled downstream`,
      ids: chunksNeverRecycled.slice(0, 20),
    });

  return issues;
}
