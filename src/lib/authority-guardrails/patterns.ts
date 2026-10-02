/**
 * W2-G01 — authority guardrails (test-owned, no runtime import).
 *
 * Detection patterns for reads of authority-sensitive legacy state. A match
 * means "this file touches a sensitive source" — classification and intent
 * live in `legacy-claim-sites.json`, validated by `guardrail.test.ts`.
 *
 * Patterns deliberately include type imports and helper names so alias
 * helpers (e.g. `deriveTextCycle`, `LearningRecord` params) are detected too.
 */

export const SENSITIVE_SOURCES = {
  // records table rows + LearningRecord values (accuracy, attempts, mistakes…)
  records:
    /\b(?:db|database|data|owner)\.records\b|\brecords\.(?:toArray|filter|map|reduce|orderBy)\b|\brecord\.(?:accuracy|attempts|mistakes|lastPracticed)\b|\bexistingRecord\b|\bLearningRecord\b/,
  // FSRS scheduling state on records and favorites (fsrsCard, nextReview, last_review)
  fsrs: /\bfsrsCard\b|\bnextReview\b|\blast_review\b|\bFSRSCardData\b|\baccuracyToRating\b|\bgradeCard\b|\bcardToData\b|\bcreateNewCard\b|\bpreviewRatings\b|\bbuildReviewForecast\b/,
  sessions:
    /\b(?:db|database|data|owner)\.sessions\b|\bsession\.(?:completed|accuracy|endTime|startTime)\b|\bsessions\.(?:filter|map|reduce|toArray|orderBy)\b|\bTypingSession\b|\bs\.(?:completed|accuracy|endTime|startTime)\b|\blessonProgress\b/,
  weakSpots: /\bweakSpots?\b|\bweakSpotType\b|useWeakSpotsStore|weak-spots|\bWeakSpot\b|\bsourceWeakSpotId\b/,
  pronunciationProgress: /\bpronunciationProgress\b|\bevidence\.pronunciation\b|\bPronunciationProgress\b/,
  'assessment.currentLevel': /\bcurrentLevel\b|\buseAssessmentStore\b|echotype_assessment|\bCEFRLevel\b/,
  learningAttempts:
    /\blearningAttempts\b|persistLearningAttempt|\bLearningAttempt\b|\battempt\.(?:answer|lessonId|parentAttemptId|sourceWeakSpotId|status|createdAt|cycle)\b|\battempts\.(?:filter|find|map|toArray)\b|\bstate\.attempts\b|\bevidence\.attempts\b|\bderiveTextCycle\b|\bintroducedVocabularyToday\b/,
  // Dexie dailyTasks rows (planner cache + lifecycle + preferences rows)
  dailyTasks:
    /\bdailyTasks\b|\bDailyTask\b|preferences:(?:daily|vocabulary)\b|\btask\.kind\b|\bapplyDailyEvidence\b|\breconcileDailyTasks\b|\bselectBudgetTasks\b|\btransitionDailyTask\b|\bremainingDailyMinutes\b/,
  // zustand daily-plan task cache (PlanTask) — same planner-cache class as dailyTasks
  dailyPlan:
    /\buseDailyPlanStore\b|\bgenerateDailyPlan\b|\bsyncPlanTasks(?:WithActivity)?\b|\bPlanTask\b|\bdaily-plan-store\b|\bgetDailyPlanSignature\b/,
} as const;

export type SensitiveSource = keyof typeof SENSITIVE_SOURCES;

export const SOURCE_IDS = Object.keys(SENSITIVE_SOURCES) as SensitiveSource[];

/** Detect which authority-sensitive legacy sources a source text touches. */
export function detectSensitiveSources(text: string): SensitiveSource[] {
  return SOURCE_IDS.filter((source) => SENSITIVE_SOURCES[source].test(text));
}
