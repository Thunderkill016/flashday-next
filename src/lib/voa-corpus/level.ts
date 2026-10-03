/*
 * FD-VOA-CORPUS-01 §16/§18 — FlashDay level inference.
 *
 * VOA's own level label is preserved verbatim (level.source) and NEVER
 * overwritten. The estimate uses Oxford 5000 band coverage of the
 * resource's content words — a difficulty prior, not a certification.
 */
import { OXFORD_LEVELS } from '../content-factory/knowledge/index.ts';
import type { FlashDayLevel, VoaLevelInfo } from './types.ts';

const WORD_RE = /[a-zA-Z][a-zA-Z'-]*/g;
const STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',
  'i',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'me',
  'him',
  'her',
  'us',
  'them',
  'my',
  'your',
  'his',
  'its',
  'our',
  'their',
  'this',
  'that',
  'these',
  'those',
  'what',
  'who',
  'whom',
  'which',
  'when',
  'where',
  'why',
  'how',
  'not',
  'no',
  'yes',
  'so',
  'if',
  'then',
  'than',
  'as',
  'by',
  'from',
  'up',
  'down',
  'out',
  'about',
  'into',
  'over',
  'after',
  'before',
  'between',
  'under',
  'again',
  'once',
  'here',
  'there',
  'all',
  'any',
  'both',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'only',
  'own',
  'same',
  'very',
  'just',
  'now',
  'will',
  'would',
  'can',
  'could',
  'shall',
  'should',
  'may',
  'might',
  'must',
  'said',
  'says',
]);

const BANDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(WORD_RE) ?? []).map((w) => w.replace(/^'+|'+$/g, ''));
}

export function contentWords(text: string): string[] {
  return tokenize(text).filter((w) => w.length > 1 && !STOP.has(w));
}

/* Naive morphological fallback — Oxford keys are headwords, so common
 * inflections must reduce before lookup. Deterministic, no stemmer dep. */
export function headword(w: string): string {
  if (OXFORD_LEVELS[w]) return w;
  const tries: string[] = [];
  if (/ies$/.test(w) && w.length > 4) tries.push(`${w.slice(0, -3)}y`); // countries→country
  if (/sses$|shes$|ches$|xes$|zes$/.test(w)) tries.push(w.slice(0, -2)); // classes→class
  if (/[^s]s$/.test(w) && w.length > 3) tries.push(w.slice(0, -1)); // tourists→tourist
  if (/ying$/.test(w)) tries.push(`${w.slice(0, -4)}ie`); // dying→die
  if (/ing$/.test(w) && w.length > 5) tries.push(w.slice(0, -3), `${w.slice(0, -3)}e`); // making→make
  if (/ied$/.test(w)) tries.push(`${w.slice(0, -3)}y`); // carried→carry
  if (/ed$/.test(w) && w.length > 4) tries.push(w.slice(0, -2), `${w.slice(0, -2)}e`); // learned→learn
  if (/er$|est$/.test(w) && w.length > 5) tries.push(w.replace(/e?r$|e?st$/, '')); // bigger→big
  for (const t of tries) if (OXFORD_LEVELS[t]) return t;
  return w;
}

export function oxfordCoverage(words: string[]): Record<string, number> {
  const cov: Record<string, number> = {};
  let known = 0;
  for (const b of BANDS) cov[b] = 0;
  for (const w of words) {
    const lvl = OXFORD_LEVELS[headword(w)];
    if (lvl) {
      cov[lvl] = (cov[lvl] ?? 0) + 1;
      known++;
    }
  }
  if (!words.length) return cov;
  for (const b of BANDS) cov[b] = (cov[b] ?? 0) / words.length;
  cov.__known = known / words.length;
  return cov;
}

/* Proper nouns are not vocabulary load — tokens that appear capitalized
 * mid-sentence in the source are excluded from the level estimate. */
export function properNouns(text: string): Set<string> {
  const caps = new Set<string>();
  for (const m of text.matchAll(/[a-zA-Z][a-zA-Z'-]*/g)) {
    const w = m[0];
    if (!/^[A-Z]/.test(w) || /^[A-Z]+$/.test(w)) continue;
    /* mid-sentence iff the nearest non-space char before it isn't
     * sentence-ending punctuation */
    const before = text.slice(0, m.index).trimEnd();
    const last = before.slice(-1);
    if (last && last !== '.' && last !== '!' && last !== '?' && last !== ':' && last !== '—') caps.add(w.toLowerCase());
  }
  return caps;
}

export function inferLevel(text: string, sourceHint?: string): VoaLevelInfo {
  const proper = properNouns(text);
  const words = contentWords(text).filter((w) => !proper.has(w));
  const cov = oxfordCoverage(words);
  /* cumulative coverage: how far down the bands a typical reader must
   * reach to understand ~90% of content words. Map band → FlashDay level. */
  const cum = { a1: cov.A1 ?? 0, a2: (cov.A1 ?? 0) + (cov.A2 ?? 0), b1: (cov.A1 ?? 0) + (cov.A2 ?? 0) + (cov.B1 ?? 0) };
  const knownRatio = cov.__known ?? 0;

  /* Median-band mapping: the level is the band where cumulative coverage
   * crosses 55% of (non-proper) content words — where the typical
   * vocabulary load sits. a0 requires near-total A1 coverage. */
  let inferred: FlashDayLevel;
  let confidence: number;
  if (words.length < 30) {
    inferred = 'a1';
    confidence = 0.2; // too little text to estimate honestly
  } else if (cum.a1 >= 0.8) {
    inferred = 'a0';
    confidence = Math.min(0.9, 0.5 + knownRatio * 0.4);
  } else if (cum.a1 >= 0.55) {
    inferred = 'a1';
    confidence = Math.min(0.85, 0.45 + knownRatio * 0.4);
  } else if (cum.a2 >= 0.55) {
    inferred = 'a2';
    confidence = Math.min(0.8, 0.4 + knownRatio * 0.4);
  } else if (cum.b1 >= 0.55) {
    inferred = 'b1';
    confidence = Math.min(0.7, 0.35 + knownRatio * 0.35);
  } else {
    inferred = 'b2';
    confidence = Math.min(0.6, 0.3 + knownRatio * 0.3);
  }
  /* VOA 'beginning' hint nudges confidence, never overrides derivation */
  const hint = sourceHint?.toLowerCase();
  if (hint === 'beginning' && (inferred === 'a0' || inferred === 'a1')) confidence = Math.min(0.92, confidence + 0.1);
  if (hint === 'intermediate' && (inferred === 'a2' || inferred === 'b1')) confidence = Math.min(0.9, confidence + 0.1);

  return {
    source: sourceHint,
    inferred,
    confidence: Math.round(confidence * 100) / 100,
    basis: `oxford-coverage known=${knownRatio.toFixed(2)} cumA1=${cum.a1.toFixed(2)} cumA2=${cum.a2.toFixed(2)} cumB1=${cum.b1.toFixed(2)}`,
  };
}
