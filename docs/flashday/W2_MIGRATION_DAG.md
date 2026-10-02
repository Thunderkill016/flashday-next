# W2_MIGRATION_DAG — Executable Migration Plan (readable view)

Mission: W2-00R2 · Status: proposed for external review · Base: `main @ 672b3f3`
Machine graph: `W2_MIGRATION_DAG.json` (validated by `src/lib/w2-migration-dag.test.ts`)
Decisions/doctrine: `W2_AUTHORITY_ADR.md`

## Critical path

```
W2-G01 guardrails ─┬─ W2-G02 semantic commit contract ─┬─ W2-AT1 dual-write adapter
                   │                                   └─ W2-SY1 event sync mirror ─┐
                   ├─ W2-G03 placement boundary ────────┼─ W2-AS1 relabel            │
                   └─ W2-G04 coverage audit ── W2-PC1 extension gate (skipped-       │
                                                satisfied if zero missing)         │
                              │          │                    │                      │
                        W2-WS1 mapping ──┤              W2-PL1 planner ─┐            │
                              │          │                    │          │            │
                        W2-WS2 readers ──┤        W2-PR1 + W2-MB1 ──────┤            │
                              └──────────┴──────────┬───────────────────┘            │
                                              W2-CS1 consumer sweep                  │
                                                    │                                │
                                              W2-FZ1 writer freeze ──────────────────┤
                                                                                     │
                              W2-VR1 replay verification ◄───────────────────────────┘
                                                    │
                              W2-RT1 retirement plan · W2-BF1 backfill gate (P2)
```

Longest hard-dependency chain: **G01 → G04 → PC1 → PL1 → CS1 → FZ1 → VR1**
(PL1 is also gated by G02 → AT1; CS1 is gated by *every* boundary node —
WS2, PL1, AS1, PR1, MB1 — and VR1 also needs SY1). This is the longest path,
not a complete execution order: AS1 runs in parallel off G03, WS1/WS2 off
G04/PC1, SY1 off G02. The JSON graph is authoritative.

## Subsystem sequence (rationale)

1. **Guardrails first** (G01): stop bleeding — freeze new authority violations
   before migrating anything, so the moving parts shrink instead of grow.
2. **Commit contract before any adapter** (G02): the split-brain question
   (history vs event) must be decided *architecturally* before dual-write code
   exists. Answer: one Dexie transaction (ADR §3).
3. **Coverage gate before consumers** (G04→PC1): consumers can only migrate to
   constructs that provably exist in the kernel. PC1 always executes as a gate
   node — with zero missing constructs it resolves *skipped-satisfied* with a
   recorded `missingConstructs=[]`, so dependents never wait on a node that
   disappears.
4. **Weakness semantics before read migration** (WS1→WS2): generic `weak`
   becomes four distinct constructs (consecutive failure / recurring error /
   support dependency / remediation demand); the kernel already ships
   correction episodes + support lifecycle — the mapping pins which construct
   serves which surface.
5. **Planner after events flow** (PL1): `nextAction` needs projection inputs
   worth consuming; `dailyTasks` splits into planner-generated /
   lifecycle / preferences row classes — only planner rows carry decision
   provenance (`preferences:vocabulary` is exempt).
6. **Label demotions can parallel** (AS1, PR1, MB1): copy + read-path work
   gated only by boundary nodes (AS1 ← G03, PR1/MB1 ← G01). AS1 emits no
   observation — placement is advisory state outside the event log.
7. **Freeze after sweep** (FZ1): writers become history-only only once every
   consumer has a projection read-path.
8. **Sync mirror + replay verification** (SY1, VR1): multi-device parity,
   downgrade, anonymous→auth, stale-sync answers verified before retirement
   is even planned.
9. **Retirement/backfill last** (RT1, BF1): P2, both behind external review;
   no deletion inside Wave 2.

## Mission decomposition (assignable Wave-2 missions)

| Mission | Nodes | Runtime change | Data migration | Review gate |
|---|---|---|---|---|
| W2-01 Authority Guardrails | G01 | no | no | mission close |
| W2-02 Semantic Commit Adapter | G02, AT1 | yes | no | pre-merge |
| W2-03 Projection Coverage + Placement Boundary | G03, G04, PC1, WS1 | yes | no | pre-merge |
| W2-04 Planner Authority | PL1 | yes | no | pre-merge |
| W2-05 Weakness/Remediation Surfaces | WS2 | yes | no | pre-merge |
| W2-06 Legacy Consumer Migration | AS1, PR1, CS1 | yes | no | pre-merge |
| W2-07 Memory Boundary | MB1 | yes | no | pre-merge |
| W2-08 Writer Freeze | FZ1 | no | no | pre-merge |
| W2-09 Replay/Sync Verification | SY1, VR1 | yes | yes (new remote table) | pre-merge |
| W2-10 Retirement | RT1, BF1 | no | yes (gated) | explicit separate review |

Mission dependencies follow node deps exactly: W2-02 → W2-03 → {W2-04, W2-05}
→ W2-06 → {W2-07 parallel} → W2-08 → W2-09 → W2-10. W2-09's SY1 can start once
W2-02's commit contract lands; VR1 still needs the freeze.

## What this plan refuses to do

- No `OPTIONAL` backfill bucket — every legacy write class is classified
  NONE / FACT-PRESERVING CANDIDATE / HISTORY ONLY (ADR §5).
- No capability claim manufactured from `sessions.accuracy`,
  `weakSpots.count/resolved`, `currentLevel`, or `pronunciationProgress`.
- No generic `weak` boolean shipped to UI.
- No `submitObservation` without a registered contract — and no placement
  `EvidenceEvent` at all: placement is a separate advisory domain (ADR §2).
- No deletions, no schema splits, no Speech work, no runtime migration in
  this docs mission.
