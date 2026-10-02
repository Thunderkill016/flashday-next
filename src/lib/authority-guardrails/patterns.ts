/**
 * W2-G01 — authority guardrails (test-owned, no runtime import).
 *
 * Detection patterns for reads of authority-sensitive legacy state. A match
 * means "this file touches a sensitive source" — classification and intent
 * live in `legacy-claim-sites.json`, validated by `guardrail.test.ts`.
 *
 * Patterns deliberately include type imports, helper names, and the codebase's
 * conventional short variable names (`record`, `r`, comparator `a`/`b`,
 * `session`, `s`, `attempt`, `attempts`) so alias helpers and
 * multi-line call chains are detected too.
 */

export const SENSITIVE_SOURCES = {
  // records table rows + LearningRecord values (accuracy, attempts, mistakes…)
  // `r.`/`a.`/`b.` catch filter/sort callbacks where records are iterated.
  records:
    /\b(?:db|database|data|owner)\.records\b|\brecords\.[A-Za-z]+\b|\brecord\.(?:accuracy|attempts|mistakes|lastPracticed)\b|\b(?:r|a|b)\.(?:accuracy|attempts|mistakes|lastPracticed)\b|\bexistingRecord\b|\bLearningRecord\b/,
  // FSRS scheduling state on records and favorites (fsrsCard, nextReview, last_review)
  fsrs: /\bfsrsCard\b|\bnextReview\b|\blast_review\b|\bFSRSCardData\b|\baccuracyToRating\b|\bgradeCard\b|\bcardToData\b|\bcreateNewCard\b|\bpreviewRatings\b|\bbuildReviewForecast\b|\bFSRS\b|\bRating\.[A-Z]/,
  sessions:
    /\b(?:db|database|data|owner)\.sessions\b|\bsessions\.[A-Za-z]+\b|\bsession\.(?:completed|accuracy|endTime|startTime)\b|\bTypingSession\b|\bs\.(?:completed|accuracy|endTime|startTime|totalWords|module|contentId)\b|\b(?:a|b)\.(?:completed|endTime|startTime)\b|\blessonProgress\b/,
  weakSpots:
    /\bweakSpots?\b|\bweakSpotType\b|useWeakSpotsStore|weak-spots|\bWeakSpot\b|\bsourceWeakSpotId\b|\bcanResolveTransfer\b/,
  pronunciationProgress: /\bpronunciationProgress\b|\bevidence\.pronunciation\b|\bPronunciationProgress\b/,
  'assessment.currentLevel':
    /\bcurrentLevel\b|\buseAssessmentStore\b|echotype_assessment|\bCEFRLevel\b|\blevelToDifficulty\b|\bcefrToDifficulty\b/,
  learningAttempts:
    /\blearningAttempts\b|persistLearningAttempt|\bLearningAttempt\b|\battempt\.(?:answer|lessonId|parentAttemptId|sourceWeakSpotId|status|createdAt|cycle|feedback|id|completedAt|stage)\b|\battempts\.[A-Za-z]+\b|\bstate\.attempts\b|\bevidence\.attempts\b|\bderiveTextCycle\b|\bintroducedVocabularyToday\b|\bvalidateTextCycleAttempt\b|\bvalidateTextCorrection\b/,
  // Dexie dailyTasks rows (planner cache + lifecycle + preferences rows)
  dailyTasks:
    /\bdailyTasks\b|\bDailyTask\b|preferences:(?:daily|vocabulary)\b|\btask\.kind\b|\bapplyDailyEvidence\b|\breconcileDailyTasks\b|\bselectBudgetTasks\b|\btransitionDailyTask\b|\bremainingDailyMinutes\b/,
  // zustand daily-plan task cache (PlanTask) — same planner-cache class as dailyTasks
  dailyPlan:
    /\buseDailyPlanStore\b|\bgenerateDailyPlan\b|\bsyncPlanTasks(?:WithActivity)?\b|\bPlanTask\b|\bdaily-plan-store\b|\bgetDailyPlanSignature\b|\bisDailyPlanPractice\b/,
} as const;

export type SensitiveSource = keyof typeof SENSITIVE_SOURCES;

export const SOURCE_IDS = Object.keys(SENSITIVE_SOURCES) as SensitiveSource[];

/** Detect which authority-sensitive legacy sources a source text touches. */
export function detectSensitiveSources(text: string): SensitiveSource[] {
  return SOURCE_IDS.filter((source) => SENSITIVE_SOURCES[source].test(text));
}

/**
 * Normalize a source line into a stable occurrence token: trim and collapse
 * whitespace so pure formatting churn does not invalidate the baseline.
 * Line content (not line numbers) is the identity.
 */
export function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

/**
 * Extract the occurrences of a sensitive source in a file's text — the set of
 * normalized lines containing a match for that source family's pattern. This
 * is the mechanically-frozen baseline: adding, removing, or editing a
 * sensitive line changes the occurrence set.
 */
export function extractOccurrences(text: string, source: SensitiveSource): string[] {
  const lines = text.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const normalized = normalizeLine(line);
    if (normalized.length > 0 && SENSITIVE_SOURCES[source].test(normalized)) {
      out.push(normalized);
    }
  }
  return out;
}

/**
 * All detected occurrences across sources for a file's text:
 * `{ source: [normalized lines] }` — only sources with ≥1 occurrence.
 */
export function extractAllOccurrences(text: string): Partial<Record<SensitiveSource, string[]>> {
  const out: Partial<Record<SensitiveSource, string[]>> = {};
  for (const source of SOURCE_IDS) {
    const occurrences = extractOccurrences(text, source);
    if (occurrences.length > 0) out[source] = occurrences;
  }
  return out;
}
