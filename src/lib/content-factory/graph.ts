/*
 * Dependency graph (Part 4) — real prerequisites only.
 *
 * true-prerequisite: failing A makes B structurally blocked (validated
 * only as far as data can prove: B must cite rationale).
 * recommended-sequence/related-reinforcing/recycles/transfer-relation
 * never gate; only true-prerequisite edges participate in cycle
 * rejection (recycling is cyclic by nature and explicitly excluded).
 */
import type { CurriculumEdge, LessonSpec } from './types.ts';

export interface GraphIssue {
  code: 'cycle' | 'unknown-node' | 'missing-rationale' | 'self-edge';
  message: string;
  nodes: string[];
}

/** Build edges from lesson spec fields. */
export function buildEdges(lessons: LessonSpec[]): CurriculumEdge[] {
  const edges: CurriculumEdge[] = [];
  for (const l of lessons) {
    for (const to of l.truePrerequisites)
      edges.push({ from: l.id, to, kind: 'true-prerequisite', rationale: `${l.id} cannot run reliably without ${to}` });
    for (const to of l.recommendedAfter) edges.push({ from: l.id, to, kind: 'recommended-sequence' });
    for (const to of l.recyclingFrom) edges.push({ from: l.id, to, kind: 'recycles' });
  }
  return edges;
}

/** Detect cycles among a chosen subset of edge kinds (default: true-prerequisite). */
export function findCycles(edges: CurriculumEdge[], kinds: readonly string[] = ['true-prerequisite']): string[][] {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!kinds.includes(e.kind)) continue;
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
  }
  const cycles: string[][] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const dfs = (n: string) => {
    state.set(n, 'visiting');
    stack.push(n);
    for (const m of adj.get(n) ?? []) {
      if (state.get(m) === 'visiting') {
        cycles.push([...stack.slice(stack.indexOf(m)), m]);
      } else if (!state.get(m)) {
        dfs(m);
      }
    }
    stack.pop();
    state.set(n, 'done');
  };
  for (const n of adj.keys()) if (!state.get(n)) dfs(n);
  return cycles;
}

export function validateGraph(lessons: LessonSpec[], externalIds?: ReadonlySet<string>): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const ids = new Set(lessons.map((l) => l.id));
  const edges = buildEdges(lessons);
  for (const e of edges) {
    if (e.from === e.to)
      issues.push({ code: 'self-edge', message: `${e.from} references itself (${e.kind})`, nodes: [e.from] });
    if (!ids.has(e.to) && !externalIds?.has(e.to))
      issues.push({
        code: 'unknown-node',
        message: `${e.from} -> unknown lesson "${e.to}" (${e.kind})`,
        nodes: [e.from, e.to],
      });
  }
  for (const l of lessons)
    for (const to of l.truePrerequisites)
      if (ids.has(to) && !l.researchRefs.length)
        issues.push({
          code: 'missing-rationale',
          message: `${l.id} declares a hard prerequisite on ${to} with no research backing`,
          nodes: [l.id, to],
        });
  for (const cyc of findCycles(edges))
    issues.push({ code: 'cycle', message: `true-prerequisite cycle: ${cyc.join(' -> ')}`, nodes: cyc });
  return issues;
}

/** Topological order over recommended-sequence + true-prerequisite (display aid). */
export function lessonOrder(lessons: LessonSpec[]): string[] {
  const ids = new Set(lessons.map((l) => l.id));
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const l of lessons) {
    indeg.set(l.id, 0);
  }
  for (const l of lessons) {
    for (const dep of [...l.truePrerequisites, ...l.recommendedAfter]) {
      if (!ids.has(dep)) continue;
      adj.set(dep, [...(adj.get(dep) ?? []), l.id]);
      indeg.set(l.id, (indeg.get(l.id) ?? 0) + 1);
    }
  }
  const queue = lessons.filter((l) => (indeg.get(l.id) ?? 0) === 0).map((l) => l.id);
  const order: string[] = [];
  while (queue.length) {
    const n = queue.shift() as string;
    order.push(n);
    for (const m of adj.get(n) ?? []) {
      indeg.set(m, (indeg.get(m) ?? 0) - 1);
      if (indeg.get(m) === 0) queue.push(m);
    }
  }
  /* Any leftovers (cycles in recommendation edges) append in authored order. */
  for (const l of lessons) if (!order.includes(l.id)) order.push(l.id);
  return order;
}
