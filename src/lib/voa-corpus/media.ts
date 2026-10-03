/*
 * FD-VOA-CORPUS-01 §43/§44 — minimal resolvable media registry.
 *
 * Not a DAM: one entry per unique asset URL bound to its source
 * resource + rights audit. `recorded` claims require resolvable URL —
 * the registry stores the proof, never the assertion alone.
 */
import { createHash } from 'node:crypto';
import { VOA_ATTRIBUTION } from './series.ts';
import type { LearningMediaAsset, MediaRightsObservation, VoaAsset, VoaRightsStatus } from './types.ts';

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
    sourceResourceIds: [args.sourceResourceId],
    observations: [{ sourceResourceId: args.sourceResourceId, rightsStatus: args.rightsStatus }],
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

/* confirmed restrictions outrank undetermined states; everything
 * non-PD blocks shipping, so the merge only needs to be conservative
 * + deterministic, never order-dependent. */
const RIGHTS_RANK: Record<VoaRightsStatus, number> = {
  THIRD_PARTY_RESTRICTED: 0,
  MIXED_RIGHTS_REVIEW_REQUIRED: 1,
  UNKNOWN: 2,
  VOA_ORIGINAL_PUBLIC_DOMAIN: 3,
};

const mostRestrictive = (statuses: VoaRightsStatus[]): VoaRightsStatus =>
  statuses.reduce((m, s) => (RIGHTS_RANK[s] < RIGHTS_RANK[m] ? s : m), 'VOA_ORIGINAL_PUBLIC_DOMAIN');

export function dedupeAssets(assets: LearningMediaAsset[]): LearningMediaAsset[] {
  const byId = new Map<string, LearningMediaAsset>();
  for (const a of assets) {
    const prev = byId.get(a.id);
    if (!prev) {
      byId.set(a.id, {
        ...a,
        sourceResourceIds: [...a.sourceResourceIds],
        observations: a.observations.map((o): MediaRightsObservation => ({ ...o })),
      });
      continue;
    }
    /* provenance union — sorted so output never depends on input order;
     * a shared asset keeps every page that referenced it */
    prev.sourceResourceIds = [...new Set([...prev.sourceResourceIds, ...a.sourceResourceIds])].sort();
    for (const obs of a.observations) {
      const prior = prev.observations.find((o) => o.sourceResourceId === obs.sourceResourceId);
      if (prior) {
        if (RIGHTS_RANK[obs.rightsStatus] < RIGHTS_RANK[prior.rightsStatus]) prior.rightsStatus = obs.rightsStatus;
      } else prev.observations.push(obs);
    }
    prev.observations.sort((x, y) => x.sourceResourceId.localeCompare(y.sourceResourceId));
    /* merged rights recomputed over all observations — PD survives only
     * when every observation is PD (fail-closed, order-independent) */
    prev.rightsStatus = mostRestrictive(prev.observations.map((o) => o.rightsStatus));
    /* resolvable is a property of the URL, not the source — keep any
     * verification proof an earlier run established */
    prev.resolvable ||= a.resolvable;
    prev.hash ??= a.hash;
    prev.durationMs ??= a.durationMs;
  }
  return [...byId.values()];
}

/* the single verified-usable predicate shared by audio-candidate links
 * and the search index — canonical registry row that is rights-clean
 * (VOA_ORIGINAL_PUBLIC_DOMAIN) AND HEAD-resolved. */
export function isVerifiedUsableMedia(a: LearningMediaAsset | undefined): boolean {
  return a?.rightsStatus === 'VOA_ORIGINAL_PUBLIC_DOMAIN' && a.resolvable === true;
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
