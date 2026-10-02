/*
 * Canonical text normalization (W2-02.5).
 *
 * THE single definition shared by the legacy spelling check and any
 * scorer that must compare learner text to an expected form — two copies
 * could drift apart and evidence could score differently than the check
 * the learner experienced.
 *
 * This is shared TEXT NORMALIZATION only — it is not a scoring contract
 * and registers no evaluator. W2-02.5 rejected vocabulary:spelling as
 * capability evidence; a future deterministic scorer simply reuses this
 * canonical form.
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
