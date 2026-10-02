import { create } from 'zustand';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_LABELS: Record<CEFRLevel, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper Intermediate',
  C1: 'Advanced',
  C2: 'Proficiency',
};

export const CEFR_DESCRIPTIONS: Record<CEFRLevel, { summary: string; canDo: string; tip: string }> = {
  A1: {
    summary: 'You can understand and use basic everyday expressions.',
    canDo:
      'Introduce yourself, ask simple questions about personal details, interact in a simple way if the other person speaks slowly.',
    tip: 'Focus on basic vocabulary, simple sentence patterns, and daily conversation phrases.',
  },
  A2: {
    summary: 'You can communicate in simple, routine tasks on familiar topics.',
    canDo: 'Describe your background, immediate environment, and matters of immediate need in simple terms.',
    tip: 'Expand your vocabulary around daily topics and practice simple past/future tenses.',
  },
  B1: {
    summary: 'You can deal with most situations likely to arise while travelling.',
    canDo: 'Describe experiences, events, dreams, and ambitions. Give reasons and explanations for opinions and plans.',
    tip: 'Practice reading short articles, watching English media with subtitles, and writing paragraphs.',
  },
  B2: {
    summary: 'You can interact with a degree of fluency with native speakers.',
    canDo:
      'Understand the main ideas of complex text on concrete and abstract topics. Produce clear, detailed text on a wide range of subjects.',
    tip: 'Read longer articles, watch English content without subtitles, and practice expressing opinions on complex topics.',
  },
  C1: {
    summary: 'You can use English flexibly and effectively for social, academic, and professional purposes.',
    canDo:
      'Understand demanding, longer texts and recognize implicit meaning. Express ideas fluently and spontaneously without much searching for expressions.',
    tip: 'Focus on nuance, idiomatic expressions, and academic/professional writing skills.',
  },
  C2: {
    summary: 'You can understand virtually everything heard or read with ease.',
    canDo:
      'Summarize information from different spoken and written sources. Express yourself spontaneously, very fluently, and precisely.',
    tip: 'Maintain your level through extensive reading, professional writing, and engaging with complex content.',
  },
};

export const CEFR_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export interface AssessmentAnswer {
  questionIndex: number;
  correct: boolean;
}

export interface AssessmentResult {
  level: CEFRLevel;
  score: number;
  completedAt: number;
  sessionsAtTest: number;
  answers: AssessmentAnswer[];
  /** Breakdown by category */
  breakdown: { vocabulary: number; grammar: number; reading: number };
}

/**
 * W2-G03 — PlacementEstimate.
 *
 * Placement is an ADVISORY domain: an orientation estimate of where to start
 * practicing, not a capability claim. It is structurally barred from the
 * evidence kernel — no placement_estimate event type exists, it never enters
 * EvidenceEvent, it is never read by the capability projection, learner model,
 * prerequisites, mission completion, retained/transfer credit, weakness state,
 * or any evaluator. `levelEstimate` answers "where to aim content", never
 * "what the learner can do".
 */
export type PlacementSource = 'placement_test' | 'chat_tool' | 'legacy_payload';

export interface PlacementEstimate {
  levelEstimate: CEFRLevel;
  /** Where the estimate came from — provenance, not authority. */
  source: PlacementSource;
  /** Raw quiz score when the source produced one; null for claimed levels. */
  score: number | null;
  completedAt: number;
  method: 'adaptive_quiz' | 'chat_tool' | 'hydrated_legacy';
  version: 1;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'echotype_assessment';
const DEFAULT_THRESHOLD = 50;
const PLACEMENT_ESTIMATE_VERSION = 1;

interface AssessmentSettings {
  /** Advisory placement estimate — HISTORY ONLY, never capability truth. */
  placement: PlacementEstimate | null;
  history: AssessmentResult[];
  dismissedReminder: boolean;
  reminderThreshold: number;
}

/** Persisted payload keeps the legacy `currentLevel` mirror so older readers
 * (and older app builds) still see the level string; `placement` is the
 * authoritative advisory record. */
interface PersistedAssessmentSettings extends AssessmentSettings {
  currentLevel?: CEFRLevel | null;
}

interface AssessmentStore extends AssessmentSettings {
  /**
   * Record a claimed level from a non-quiz source (e.g. the chat tool's
   * updateUserLevel). Provenance is recorded as a claim — it is still an
   * advisory estimate, not evidence.
   */
  setPlacementEstimate: (level: CEFRLevel, source: Exclude<PlacementSource, 'legacy_payload'>) => void;
  setResult: (result: AssessmentResult) => void;
  dismissReminder: () => void;
  resetReminder: () => void;
  shouldShowReminder: (totalSessions: number) => boolean;
  hydrate: () => void;
}

function loadFromStorage(): Partial<PersistedAssessmentSettings> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function saveToStorage(settings: AssessmentSettings) {
  if (typeof window === 'undefined') return;
  try {
    const persisted: PersistedAssessmentSettings = {
      ...settings,
      currentLevel: settings.placement?.levelEstimate ?? null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    /* ignore */
  }
}

/** True when a persisted value looks like a PlacementEstimate. */
function isPlacementEstimate(value: unknown): value is PlacementEstimate {
  if (typeof value !== 'object' || value === null) return false;
  const level = (value as PlacementEstimate).levelEstimate;
  return typeof level === 'string' && CEFR_ORDER.includes(level);
}

/** Hydrate a legacy `currentLevel` string into an advisory estimate. The
 * provenance is honestly 'legacy_payload' — the old payload never recorded
 * how the level was produced. Score/completedAt are recovered from the newest
 * history entry matching the level when one exists; never invented. */
function legacyPlacementFrom(
  level: CEFRLevel | null | undefined,
  history: AssessmentResult[] | undefined,
): PlacementEstimate | null {
  if (!level) return null;
  const matching = [...(history ?? [])].reverse().find((entry) => entry.level === level);
  return {
    levelEstimate: level,
    source: 'legacy_payload',
    score: matching?.score ?? null,
    completedAt: matching?.completedAt ?? 0,
    method: 'hydrated_legacy',
    version: PLACEMENT_ESTIMATE_VERSION,
  };
}

const defaults: AssessmentSettings = {
  placement: null,
  history: [],
  dismissedReminder: false,
  reminderThreshold: DEFAULT_THRESHOLD,
};

export const useAssessmentStore = create<AssessmentStore>((set, get) => ({
  ...defaults,

  setPlacementEstimate: (level, source) => {
    const state = get();
    const placement: PlacementEstimate = {
      levelEstimate: level,
      source,
      score: null,
      completedAt: Date.now(),
      method: source === 'placement_test' ? 'adaptive_quiz' : 'chat_tool',
      version: PLACEMENT_ESTIMATE_VERSION,
    };
    const updated: AssessmentSettings = {
      placement,
      history: state.history,
      dismissedReminder: state.dismissedReminder,
      reminderThreshold: state.reminderThreshold,
    };
    set({ placement });
    saveToStorage(updated);
  },

  setResult: (result) => {
    const state = get();
    const placement: PlacementEstimate = {
      levelEstimate: result.level,
      source: 'placement_test',
      score: result.score,
      completedAt: result.completedAt,
      method: 'adaptive_quiz',
      version: PLACEMENT_ESTIMATE_VERSION,
    };
    const updated: AssessmentSettings = {
      placement,
      history: [...state.history, result],
      dismissedReminder: false,
      reminderThreshold: state.reminderThreshold,
    };
    set(updated);
    saveToStorage(updated);
  },

  dismissReminder: () => {
    const state = get();
    const updated: AssessmentSettings = {
      placement: state.placement,
      history: state.history,
      dismissedReminder: true,
      reminderThreshold: state.reminderThreshold,
    };
    set({ dismissedReminder: true });
    saveToStorage(updated);
  },

  resetReminder: () => {
    const state = get();
    const updated: AssessmentSettings = {
      placement: state.placement,
      history: state.history,
      dismissedReminder: false,
      reminderThreshold: state.reminderThreshold,
    };
    set({ dismissedReminder: false });
    saveToStorage(updated);
  },

  shouldShowReminder: (totalSessions) => {
    const { history, dismissedReminder, reminderThreshold } = get();
    if (dismissedReminder) return false;
    if (history.length === 0) return false;
    const lastTest = history[history.length - 1];
    return totalSessions - lastTest.sessionsAtTest >= reminderThreshold;
  },

  /* Accepts both shapes: the legacy `{ currentLevel, history, ... }` payload
   * and the current `{ placement, currentLevel, history, ... }` payload.
   * History is preserved verbatim; a legacy level is re-expressed as an
   * advisory estimate, never replayed as evidence. */
  hydrate: () => {
    const saved = loadFromStorage();
    if (Object.keys(saved).length === 0) return;
    const history = Array.isArray(saved.history) ? saved.history : [];
    const placement = isPlacementEstimate(saved.placement)
      ? saved.placement
      : legacyPlacementFrom(saved.currentLevel, history);
    set({
      placement,
      history,
      dismissedReminder: saved.dismissedReminder === true,
      reminderThreshold: typeof saved.reminderThreshold === 'number' ? saved.reminderThreshold : DEFAULT_THRESHOLD,
    });
  },
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function scoreToLevel(score: number): CEFRLevel {
  if (score <= 20) return 'A1';
  if (score <= 40) return 'A2';
  if (score <= 55) return 'B1';
  if (score <= 70) return 'B2';
  if (score <= 85) return 'C1';
  return 'C2';
}

export function levelComparison(prev: CEFRLevel, current: CEFRLevel): 'improved' | 'same' | 'declined' {
  const prevIdx = CEFR_ORDER.indexOf(prev);
  const currIdx = CEFR_ORDER.indexOf(current);
  if (currIdx > prevIdx) return 'improved';
  if (currIdx < prevIdx) return 'declined';
  return 'same';
}
