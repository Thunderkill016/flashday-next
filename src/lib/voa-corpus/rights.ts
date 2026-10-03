/*
 * FD-VOA-CORPUS-01 §12/§46/§47 — asset-level rights gate.
 *
 * Fail-closed: UNKNOWN never becomes learner-facing. Keyword detection
 * is a WARNING system only (§46) — it can demote, never promote.
 * Promotion to VOA_ORIGINAL_PUBLIC_DOMAIN requires positive VOA
 * evidence: no third-party credits AND VOA-domain assets AND the
 * series prior allows it.
 */
import type { VoaAsset, VoaRightsStatus } from './types.ts';

export const THIRD_PARTY_SIGNALS: { re: RegExp; label: string }[] = [
  { re: /\bassociated press\b|\bAP\b reported|\bThe AP\b/i, label: 'Associated Press' },
  { re: /\breuters\b/i, label: 'Reuters' },
  { re: /\bAFP\b|agence france/i, label: 'AFP' },
  { re: /\bgetty\b/i, label: 'Getty Images' },
  { re: /\bcourtesy of\b/i, label: 'courtesy (external)' },
  { re: /\blicen[cs]ed (?:from|by|under)\b/i, label: 'licensed external' },
  { re: /\bcopyright\s*©?\s*(?!voa|voice of america)/i, label: 'third-party copyright' },
  { re: /\badapted (?:by|from)\b/i, label: 'adapted third-party material' },
];

/* "X reported this story. Y adapted it for VOA" = VOA-adapted wire copy.
 * The adaptation is VOA-authored but the underlying reporting is not —
 * conservative class: MIXED (§12 example). */
export const WIRE_ADAPT_RE =
  /([A-Z][A-Za-z .&'-]+?) reported this story\.?\s*([A-Z][A-Za-z .&'-]+?) adapted it for VOA/i;

export function detectExternalCredits(creditLines: string[]): { label: string; line: string }[] {
  const hits: { label: string; line: string }[] = [];
  for (const line of creditLines) {
    for (const sig of THIRD_PARTY_SIGNALS) {
      if (sig.re.test(line)) hits.push({ label: sig.label, line });
    }
    const wire = WIRE_ADAPT_RE.exec(line);
    if (wire && !/voa|voice of america/i.test(wire[1])) hits.push({ label: `wire source: ${wire[1].trim()}`, line });
  }
  return hits;
}

export interface RightsAudit {
  status: VoaRightsStatus;
  reasons: string[];
  externalCredits: string[];
  assetAudit: { url: string; status: VoaRightsStatus; reason: string }[];
}

const VOA_MEDIA_HOSTS = [
  'voa-audio.voanews.eu',
  'voa-video-ns.akamaized.net',
  'docs.voanews.eu',
  'gdb.voanews.com',
  'voa-english.voanews.eu',
  'learningenglish.voanews.com',
];

export function auditAsset(asset: VoaAsset, thirdPartyLabels: string[]): { status: VoaRightsStatus; reason: string } {
  const host = (() => {
    try {
      return new URL(asset.url).host;
    } catch {
      return '';
    }
  })();
  if (!host) return { status: 'UNKNOWN', reason: 'unparseable asset URL' };
  if (!VOA_MEDIA_HOSTS.includes(host)) return { status: 'THIRD_PARTY_RESTRICTED', reason: `non-VOA host: ${host}` };
  /* VOA media hosts still serve embedded third-party clips; if the page
   * carries third-party credits we cannot prove THIS asset is the VOA
   * component → mixed, not restricted (VOA hosts = plausibly VOA). */
  if (thirdPartyLabels.length)
    return {
      status: 'MIXED_RIGHTS_REVIEW_REQUIRED',
      reason: `page carries ${thirdPartyLabels.join(',')} credits; asset provenance unverified`,
    };
  return { status: 'VOA_ORIGINAL_PUBLIC_DOMAIN', reason: 'VOA host + no third-party credits detected' };
}

export function auditResource(args: {
  seriesRightsPrior: VoaRightsStatus;
  creditLines: string[];
  assets: VoaAsset[];
  canonicalUrl?: string;
}): RightsAudit {
  const hits = detectExternalCredits(args.creditLines);
  const labels = [...new Set(hits.map((h) => h.label))];
  const reasons: string[] = [];
  const assetAudit = args.assets.map((a) => ({ url: a.url, ...auditAsset(a, labels) }));

  let status: VoaRightsStatus;
  if (!args.canonicalUrl) {
    status = 'UNKNOWN';
    reasons.push('missing canonical URL — cannot establish provenance');
  } else if (labels.length) {
    status = 'MIXED_RIGHTS_REVIEW_REQUIRED';
    reasons.push(`third-party credits detected: ${labels.join(', ')}`);
    for (const h of hits) reasons.push(`credit line: "${h.line}"`);
  } else {
    status = args.seriesRightsPrior;
    reasons.push(
      status === 'VOA_ORIGINAL_PUBLIC_DOMAIN'
        ? 'no third-party credits + VOA-original series'
        : `no credits detected but series prior is ${status} — kept conservative`,
    );
  }
  /* asset audit can only downgrade the page status */
  if (assetAudit.some((a) => a.status === 'THIRD_PARTY_RESTRICTED')) {
    if (status === 'VOA_ORIGINAL_PUBLIC_DOMAIN') status = 'MIXED_RIGHTS_REVIEW_REQUIRED';
    reasons.push('one or more assets live on non-VOA hosts — restricted at asset level');
  }
  if (
    status !== 'VOA_ORIGINAL_PUBLIC_DOMAIN' &&
    status !== 'MIXED_RIGHTS_REVIEW_REQUIRED' &&
    status !== 'THIRD_PARTY_RESTRICTED'
  )
    status = 'UNKNOWN';
  return { status, reasons, externalCredits: hits.map((h) => h.line), assetAudit };
}
