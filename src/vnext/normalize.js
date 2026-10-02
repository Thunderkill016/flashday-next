/*
 * Canonical text normalization (W2-02.5 spelling pilot).
 *
 * THE single definition shared by the legacy spelling checker and the
 * kernel's exact-match evaluator — two copies could drift apart and an
 * event could score differently than the history write claimed.
 *
 * Pipeline (identical to the historical normalizeSpelling):
 *   Unicode NFKC → trim → lowercase → curly apostrophes → '
 *   → dash variants → - → collapse whitespace.
 *
 * Deliberately NOT fuzzy: no Levenshtein, no typo tolerance, no stemming.
 */
export function canonicalExactText(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[‐‑–—]/g, '-')
    .replace(/\s+/g, ' ');
}
