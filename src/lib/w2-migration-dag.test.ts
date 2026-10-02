import { describe, expect, it } from 'vitest';
import dag from '../../docs/flashday/W2_MIGRATION_DAG.json';

interface DagNode {
  id: string;
  title: string;
  subsystem: string;
  priority: string;
  dependsOn: string[];
  currentAuthority: string;
  targetAuthority: string;
  writers: string[];
  readers: string[];
  action: string;
  adapter: string;
  backfill: string;
  syncImpact: string;
  rollbackCategory: string;
  rollback: string;
  invariants: string[];
  acceptance: string[];
  stopConditions: string[];
}

const REQUIRED_KEYS = [
  'id',
  'title',
  'subsystem',
  'priority',
  'dependsOn',
  'currentAuthority',
  'targetAuthority',
  'writers',
  'readers',
  'action',
  'adapter',
  'backfill',
  'syncImpact',
  'rollbackCategory',
  'rollback',
  'invariants',
  'acceptance',
  'stopConditions',
] as const;

const ALLOWED_ROLLBACK = new Set(['simple', 'dual-read', 'irreversible']);
const ALLOWED_PRIORITY = new Set(['P0', 'P1', 'P2']);
const ALLOWED_BACKFILL = new Set(['NONE', 'HISTORY ONLY', 'FACT-PRESERVING CANDIDATE']);

const nodes = dag.nodes as DagNode[];
const ids = new Set(nodes.map((n) => n.id));

describe('W2 migration DAG contract', () => {
  it('has nodes', () => {
    expect(nodes.length).toBeGreaterThan(0);
  });

  it('every node has all required fields', () => {
    for (const node of nodes) {
      for (const key of REQUIRED_KEYS) {
        expect(node, `${node.id} missing ${key}`).toHaveProperty(key);
      }
    }
  });

  it('node ids are unique', () => {
    expect(ids.size).toBe(nodes.length);
  });

  it('ids match the W2- pattern', () => {
    for (const node of nodes) {
      expect(node.id).toMatch(/^W2-[A-Z0-9]+$/);
    }
  });

  it('all dependencies reference existing nodes', () => {
    for (const node of nodes) {
      for (const dep of node.dependsOn) {
        expect(ids.has(dep), `${node.id} depends on missing ${dep}`).toBe(true);
      }
    }
  });

  it('no node depends on itself', () => {
    for (const node of nodes) {
      expect(node.dependsOn).not.toContain(node.id);
    }
  });

  it('graph is acyclic', () => {
    // Kahn's algorithm: repeatedly remove nodes with no unresolved deps.
    const remaining = new Map(nodes.map((n) => [n.id, new Set(n.dependsOn)]));
    let progress = true;
    while (progress && remaining.size > 0) {
      progress = false;
      for (const [id, deps] of [...remaining]) {
        if ([...deps].every((d) => !remaining.has(d))) {
          remaining.delete(id);
          progress = true;
        }
      }
    }
    expect(remaining.size, `cycle among: ${[...remaining.keys()].join(', ')}`).toBe(0);
  });

  it('rollback categories are from the allowed set', () => {
    for (const node of nodes) {
      expect(ALLOWED_ROLLBACK.has(node.rollbackCategory), `${node.id}: ${node.rollbackCategory}`).toBe(true);
    }
  });

  it('priorities are from the allowed set', () => {
    for (const node of nodes) {
      expect(ALLOWED_PRIORITY.has(node.priority), `${node.id}: ${node.priority}`).toBe(true);
    }
  });

  it('backfill classes are from the allowed set', () => {
    for (const node of nodes) {
      const ok = [...ALLOWED_BACKFILL].some((cls) => node.backfill === cls || node.backfill.startsWith(`${cls} `) || node.backfill.startsWith(`${cls} —`));
      expect(ok, `${node.id}: ${node.backfill}`).toBe(true);
    }
  });

  it('every P0/P1 node has acceptance criteria', () => {
    for (const node of nodes.filter((n) => n.priority !== 'P2')) {
      expect(node.acceptance.length, `${node.id} has no acceptance`).toBeGreaterThan(0);
    }
  });

  it('every P0/P1 node has a rollback plan', () => {
    for (const node of nodes.filter((n) => n.priority !== 'P2')) {
      expect(node.rollback.trim().length, `${node.id} has no rollback`).toBeGreaterThan(0);
    }
  });

  it('every P0/P1 node has invariants', () => {
    for (const node of nodes.filter((n) => n.priority !== 'P2')) {
      expect(node.invariants.length, `${node.id} has no invariants`).toBeGreaterThan(0);
    }
  });

  it('no P0/P1 node is irreversible', () => {
    for (const node of nodes.filter((n) => n.priority !== 'P2')) {
      expect(node.rollbackCategory, `${node.id} is irreversible`).not.toBe('irreversible');
    }
  });

  it('missions reference only existing nodes and cover the graph', () => {
    const covered = new Set(dag.missions.flatMap((m) => m.nodes));
    for (const mission of dag.missions) {
      for (const id of mission.nodes) {
        expect(ids.has(id), `${mission.id} references missing ${id}`).toBe(true);
      }
    }
    for (const node of nodes) {
      expect(covered.has(node.id), `${node.id} not assigned to any mission`).toBe(true);
    }
  });
});
