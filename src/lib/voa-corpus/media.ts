/*
 * FD-VOA-CORPUS-01 §43/§44 — minimal resolvable media registry.
 *
 * Not a DAM: one entry per unique asset URL bound to its source
 * resource + rights audit. `recorded` claims require resolvable URL —
 * the registry stores the proof, never the assertion alone.
 */
import { createHash } from 'node:crypto';
import { VOA_ATTRIBUTION } from './series.ts';
import type { LearningMediaAsset, VoaAsset, VoaRightsStatus } from './types.ts';

export function mediaAssetId(url: string): string {
  return `voa-media:${createHash('sha256').update(url).digest('hex').slice(0, 16)}`;
}

export function buildMediaAsset(args: {
  asset: VoaAsset;
  sourceResourceId: string;
  rightsStatus: VoaRightsStatus;
  resolvable?: boolean;
  hash?: string;
  durationMs?: number;
}): LearningMediaAsset {
  return {
    id: mediaAssetId(args.asset.url),
    provider: 'voa',
    sourceResourceId: args.sourceResourceId,
    /* registry covers every ref kind a resource can emit — a document
     * ref must resolve to a registry row like audio/video do */
    type: args.asset.kind === 'audio' ? 'audio' : args.asset.kind === 'video' ? 'video' : 'document',
    url: args.asset.url,
    hash: args.hash,
    durationMs: args.durationMs,
    mimeType: args.asset.mimeType,
    rightsStatus: args.rightsStatus,
    attribution: VOA_ATTRIBUTION,
    resolvable: args.resolvable ?? false,
  };
}

export function dedupeAssets(assets: LearningMediaAsset[]): LearningMediaAsset[] {
  const byId = new Map<string, LearningMediaAsset>();
  for (const a of assets) if (!byId.has(a.id)) byId.set(a.id, a);
  return [...byId.values()];
}

/* §43 — a `recorded` claim needs a resolvable URL. HEAD-verifying every
 * asset up front would take thousands of requests, so verification is
 * bounded per run: unresolved assets stay resolvable=false (fail-closed)
 * until a later incremental run reaches them. Manifest order puts the
 * Tier-A course audio first. */
export const RESOLVE_CAP_PER_RUN = 600;

export async function resolveAudioAssets(
  assets: LearningMediaAsset[],
  headCheck: (url: string) => Promise<boolean>,
  cap = RESOLVE_CAP_PER_RUN,
): Promise<number> {
  let checked = 0;
  let ok = 0;
  for (const a of assets) {
    if (a.type !== 'audio' || a.resolvable) continue;
    if (checked >= cap) break;
    checked++;
    a.resolvable = await headCheck(a.url);
    if (a.resolvable) ok++;
  }
  return ok;
}
