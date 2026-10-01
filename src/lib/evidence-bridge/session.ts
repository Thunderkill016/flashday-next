/*
 * Mission Session — drives one mission through the real kernel/bridge.
 *
 * Mirrors the evidence semantics of FlashDay's ui-session.js without
 * the B0/B1 experiment machinery: deterministic attempt ids recomputed
 * from the committed log (a reload converges to the same id, so a
 * retried commit dedupes), support_use events plus a stamped snapshot
 * before any attempt commit, feedback only after evidence lands, and
 * a live-task lock so the selector never re-runs underneath an open
 * prompt. Selection is the shipped reference-mode planner.
 */
import { unionSupport } from '@/vnext/evidence';
import { SELECTION_MODES, selectNextTask } from '@/vnext/next-for-you/selector';
import { projectLearnerState } from '@/vnext/projection';
import { type AttemptEvalResult, submitAttempt, submitObservation } from './bridge';
import type {
  CaptureProvenance,
  ContractRegistry,
  EventStore,
  EvidenceEvent,
  KernelTask,
  LearnerProjection,
  NextTaskDecision,
} from './types';

/* Purposes that may offer pre-commit support. A used control always
 * leaves a support_use event plus a stamped snapshot — the offer is a
 * learner affordance, not an evidence cheat. */
const SUPPORTABLE_PURPOSES = new Set(['retrieval', 'production', 'interaction', 'remediation']);
const EXPOSURE_PURPOSES = new Set(['input', 'notice']);

/* Deterministic event ids — a re-delivered append dedupes on identical
 * content instead of double-writing, and ids stay stable across
 * reloads. `_xx` encodes any non-alphanumeric char so task keys can
 * never collide. Same scheme as ui-session.js. */
const enc = (s: string) => String(s).replace(/[^a-zA-Z0-9]/g, (c) => `_${(c.codePointAt(0) ?? 0).toString(16)}`);
const evtId = (...parts: (string | number | null | undefined)[]) =>
  `e~${parts.map((p) => enc(String(p ?? ''))).join('~')}`;

const keyOf = (t: KernelTask) => `${t.id}@${t.revision ?? 1}`;

const freshSupport = () => ({
  hint: false,
  translation: false,
  transcript: false,
  modelAnswer: false,
  repeat: false,
  repeatCount: null as number | null,
});

type SupportSnapshot = ReturnType<typeof freshSupport>;

export interface PromptSpec {
  stimulusType: string | null;
  /** Stimulus lines from the contract — dialogue turns, partner turn,
   * or the cued-prompt line. */
  lines: string[];
  /** Lines joined for TTS playback. */
  audioText: string | null;
  cue: string | null;
  /** Bare audio lines keep the text hidden until transcript support
   * is used — seeing the words would launder listening into reading. */
  textVisible: boolean;
}

export interface ProgressLine {
  capabilityId: string;
  state: string;
  milestones: Record<string, boolean>;
  consecutiveFailures: number;
}

export type SessionScreen =
  | { type: 'intro'; missionId: string; resumed: boolean; needsName: boolean }
  | {
      type: 'input';
      taskId: string;
      taskRevision: number;
      purpose: string;
      prompt: PromptSpec;
      supportOffered: string[];
      decisionReason: string | null;
    }
  | {
      type: 'task';
      phase: 'prompt' | 'feedback';
      taskId: string;
      taskRevision: number;
      capabilityId: string;
      purpose: string;
      modality: string;
      attemptId: string;
      prompt: PromptSpec;
      responseType: 'choice' | 'text' | 'spoken_turn';
      options: { id: string; text: string; correct?: boolean }[] | null;
      requiredFunctions: string[];
      supportOffered: string[];
      supportUsed: SupportSnapshot;
      evaluation: AttemptEvalResult | null;
      revealModelAfterAttempt: boolean;
      decisionReason: string | null;
    }
  | {
      type: 'summary';
      status: string;
      reason: string | null;
      progress: ProgressLine[];
    };

export interface MissionSessionOptions {
  learnerId: string;
  missionId: string;
  registry: ContractRegistry;
  store: EventStore;
  now?: () => number;
}

export function createMissionSession({
  learnerId,
  missionId,
  registry,
  store,
  now = () => Date.now(),
}: MissionSessionOptions) {
  const mission = registry.missionById(missionId);
  if (!mission) throw new Error(`unregistered mission '${missionId}'`);
  const tasks = registry.tasks.filter((t) => mission.taskIds.includes(t.id));
  const capabilities = registry.capabilities;
  const tasksById = new Map(registry.tasks.map((t) => [t.id, t]));
  /* Namespace for deterministic event ids — the same evidence mints the
   * same id for this learner+mission across reloads. */
  const ns = `fdn~${enc(learnerId)}~${enc(missionId)}`;

  const events: EvidenceEvent[] = [];
  let started = false;
  let learnerName: string | null = null;
  let phase: 'prompt' | 'feedback' = 'prompt';
  let liveTask: { key: string; task: KernelTask; decision: NextTaskDecision } | null = null;
  let committed: { task: KernelTask; attemptId: string; evalResult: AttemptEvalResult | null } | null = null;
  let supportSnapshot: SupportSnapshot = freshSupport();
  let supportCounts = new Map<string, number>();
  let playCount = 0;
  let promptShownAt: number | null = null;

  /** Mirror the durable log into memory (dedupe-safe by id). Only this
   * learner's rows are mirrored — a shared table must never leak another
   * learner's evidence into this session's selection or resume state. */
  const syncEvents = async () => {
    const stored = await store.list();
    for (const e of stored) {
      if (e.learnerId !== learnerId) continue;
      const i = events.findIndex((x) => x.id === e.id);
      if (i >= 0) events[i] = e;
      else events.push(e);
    }
    events.sort((a, b) => a.occurredAt - b.occurredAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  };

  const attemptCountFor = (taskKey: string) =>
    events.filter(
      (e) => e.learnerId === learnerId && `${e.taskId}@${e.taskRevision}` === taskKey && e.attempt?.outcome != null,
    ).length;

  const attemptIdFor = (task: KernelTask) => `${keyOf(task)}:a${attemptCountFor(keyOf(task)) + 1}`;

  const promptSpec = (task: KernelTask): PromptSpec => {
    const stimulus = task.stimulus as { type?: string; languageComponents?: string[] } | undefined;
    const lines = stimulus?.languageComponents ?? [];
    const stimulusType = stimulus?.type ?? null;
    return {
      stimulusType,
      lines,
      audioText:
        ['audio_line', 'dialogue', 'partner_turn'].includes(stimulusType ?? '') && lines.length
          ? lines.join(' ')
          : null,
      cue: stimulusType === 'cued_prompt' ? (lines[0] ?? null) : null,
      textVisible: stimulusType !== 'audio_line',
    };
  };

  const supportOffered = (task: KernelTask): string[] => {
    const stimulusType = (task.stimulus as { type?: string } | undefined)?.type;
    if (EXPOSURE_PURPOSES.has(task.purpose)) {
      return stimulusType === 'audio_line' ? ['transcript'] : [];
    }
    if (!SUPPORTABLE_PURPOSES.has(task.purpose)) return [];
    const offered = ['hint', 'modelAnswer'];
    if (stimulusType === 'audio_line' || stimulusType === 'dialogue') offered.push('transcript');
    return offered;
  };

  const select = (): NextTaskDecision =>
    selectNextTask({
      mode: SELECTION_MODES.REFERENCE,
      learnerId,
      mission: mission as never,
      tasks: registry.tasks as never,
      capabilities: capabilities as never,
      events: events as never,
      riskPriors: [],
      now: now(),
    }) as NextTaskDecision;

  const taskScreen = (task: KernelTask, evalResult: AttemptEvalResult | null): SessionScreen => {
    const isChoice = task.response?.type === 'choice';
    return {
      type: 'task',
      phase,
      taskId: task.id,
      taskRevision: task.revision ?? 1,
      capabilityId: task.capabilityId,
      purpose: task.purpose,
      modality: task.modality,
      attemptId: phase === 'feedback' && committed ? committed.attemptId : attemptIdFor(task),
      prompt: promptSpec(task),
      responseType: isChoice ? 'choice' : task.response?.type === 'spoken_turn' ? 'spoken_turn' : 'text',
      options: isChoice
        ? ((task.response as { options?: { id: string; text: string; correct?: boolean }[] })?.options ?? [])
        : null,
      requiredFunctions: task.response?.requiredFunctions ?? [],
      supportOffered: phase === 'prompt' ? supportOffered(task) : [],
      supportUsed: { ...supportSnapshot },
      evaluation: phase === 'feedback' ? evalResult : null,
      revealModelAfterAttempt:
        (task.supportPolicy as { revealModelAfterAttempt?: boolean } | undefined)?.revealModelAfterAttempt === true,
      decisionReason: liveTask?.decision?.reason ?? null,
    };
  };

  const inputScreen = (task: KernelTask): SessionScreen => ({
    type: 'input',
    taskId: task.id,
    taskRevision: task.revision ?? 1,
    purpose: task.purpose,
    prompt: promptSpec(task),
    supportOffered: supportOffered(task),
    decisionReason: liveTask?.decision?.reason ?? null,
  });

  const progress = (): ProgressLine[] => {
    const { byCapability } = projectLearnerState(
      learnerId,
      events as never,
      capabilities as never,
      registry.tasks as never,
    ) as unknown as LearnerProjection;
    const supportSet = new Set((mission as { supportCapabilities?: string[] }).supportCapabilities ?? []);
    const ids = [
      ...mission.targetCapabilities,
      ...((mission as { carrierCapabilities?: string[] }).carrierCapabilities ?? []),
    ].filter((id) => !supportSet.has(id));
    return ids.map((capId) => {
      const entry = byCapability.get(capId);
      return {
        capabilityId: capId,
        state: entry?.state ?? 'NOT_SEEN',
        milestones: entry?.milestones ?? {},
        consecutiveFailures: entry?.consecutiveFailures ?? 0,
      };
    });
  };

  const session = {
    /** Load the evidence log; a reload resumes at the same selection
     * because attempt ids are recomputed from committed events. */
    async init(): Promise<SessionScreen> {
      await syncEvents();
      return session.screen();
    },

    /** The learner-visible descriptor for the current step. */
    screen(): SessionScreen {
      if (!started) {
        return {
          type: 'intro',
          missionId: mission.id,
          resumed: events.length > 0,
          needsName: session.needsName(),
        };
      }
      if (phase === 'feedback' && committed) {
        return taskScreen(committed.task, committed.evalResult);
      }
      // Live-task lock: render the standing decision until consumed —
      // the selector never re-runs underneath an open prompt.
      if (liveTask && phase === 'prompt') {
        return EXPOSURE_PURPOSES.has(liveTask.task.purpose)
          ? inputScreen(liveTask.task)
          : taskScreen(liveTask.task, null);
      }
      const sel = select();
      if (sel.status === 'ready' && sel.taskId) {
        const task = tasksById.get(sel.taskId);
        if (task) {
          const key = keyOf(task);
          if (liveTask?.key !== key) {
            liveTask = { key, task, decision: sel };
            phase = 'prompt';
            committed = null;
            supportSnapshot = freshSupport();
            supportCounts = new Map();
            playCount = 0;
            promptShownAt = null;
          }
          return EXPOSURE_PURPOSES.has(task.purpose) ? inputScreen(task) : taskScreen(task, null);
        }
      }
      return {
        type: 'summary',
        status: sel.status,
        reason: sel.reason ?? null,
        progress: progress(),
      };
    },

    needsName(): boolean {
      return tasks.some((t) => (t.response?.requiredFunctions ?? []).includes('state_own_name'));
    },

    /** Intro confirm — stores the persona name state_own_name checks
     * resolve against. */
    start({ learnerName: name }: { learnerName?: string } = {}): SessionScreen {
      learnerName = name?.trim() || null;
      started = true;
      return session.screen();
    },

    /** Exposure-phase confirm — viewing mints an observation, never an
     * attempt outcome. */
    async view(): Promise<SessionScreen> {
      const active = phase === 'feedback' && committed ? { task: committed.task } : liveTask;
      if (!active || phase !== 'prompt') return session.screen();
      const task = active.task;
      if (!EXPOSURE_PURPOSES.has(task.purpose)) return session.screen();
      await submitObservation(store, registry, {
        id: evtId(ns, task.id, `r${task.revision ?? 1}`, 'exp'),
        learnerId,
        occurredAt: now(),
        taskId: task.id,
        eventType: 'exposure',
        attempt: { attemptId: null },
      });
      await syncEvents();
      liveTask = null;
      return session.screen();
    },

    /** Learner-visible support before commit: a support_use event plus
     * a stamped snapshot — a hint you could close and hide is still a
     * hint. */
    async support(kind: string): Promise<SessionScreen> {
      if (!liveTask || phase !== 'prompt') return session.screen();
      const task = liveTask.task;
      if (!supportOffered(task).includes(kind)) return session.screen();
      const attemptId = attemptIdFor(task);
      const n = (supportCounts.get(kind) ?? 0) + 1;
      supportCounts.set(kind, n);
      await submitObservation(store, registry, {
        id: evtId(ns, attemptId, 'sup', kind, n),
        learnerId,
        occurredAt: now(),
        taskId: task.id,
        eventType: 'support_use',
        attempt: { attemptId },
        support: { ...freshSupport(), [kind]: true },
      });
      await syncEvents();
      supportSnapshot = { ...supportSnapshot, [kind]: true };
      return session.screen();
    },

    /** Stimulus replay: the first play is the stimulus itself; each
     * further press is a repeat — support, recorded as such. */
    async play(): Promise<SessionScreen> {
      if (!liveTask || phase !== 'prompt') return session.screen();
      playCount += 1;
      if (playCount > 1) {
        const task = liveTask.task;
        const attemptId = attemptIdFor(task);
        await submitObservation(store, registry, {
          id: evtId(ns, attemptId, 'sup', 'repeat', playCount - 1),
          learnerId,
          occurredAt: now(),
          taskId: task.id,
          eventType: 'support_use',
          attempt: { attemptId },
          support: { ...freshSupport(), repeat: true, repeatCount: playCount - 1 },
        });
        await syncEvents();
        supportSnapshot = { ...supportSnapshot, repeat: true, repeatCount: playCount - 1 };
      }
      return session.screen();
    },

    /** Commit the response: the declared evaluator scores it, the
     * binder derives semantics, evidence lands, THEN feedback can
     * render. A second commit on the same screen is a no-op. */
    async commit({
      text = null,
      optionId = null,
      capture = null,
    }: {
      text?: string | null;
      optionId?: string | null;
      capture?: CaptureProvenance | null;
    } = {}): Promise<SessionScreen> {
      const active = phase === 'feedback' && committed ? { task: committed.task } : liveTask;
      if (!active || phase !== 'prompt') return session.screen();
      const task = active.task;
      if (EXPOSURE_PURPOSES.has(task.purpose)) return session.screen();
      const isChoice = task.response?.type === 'choice';
      const response = isChoice ? optionId : (text ?? '').trim();
      if (response == null || response === '') return session.screen();

      const attemptId = attemptIdFor(task);
      // The stamped support snapshot must reflect the attempt's WHOLE
      // support history — including support_use events landed before a
      // reload, when the in-memory snapshot was reset. unionSupport is
      // the same accumulation rule the projection applies.
      let stamped = { ...supportSnapshot };
      for (const e of events) {
        if (e.attempt?.attemptId === attemptId && e.taskId === task.id && e.eventType === 'support_use') {
          stamped = unionSupport(stamped, e.support) ?? stamped;
        }
      }
      const { evalResult } = await submitAttempt(store, registry, {
        id: evtId(ns, attemptId),
        learnerId,
        occurredAt: now(),
        taskId: task.id,
        response: isChoice ? { optionId } : { text: response },
        attemptId,
        latencyMs: promptShownAt != null ? Math.max(0, now() - promptShownAt) : undefined,
        capture,
        support: stamped,
        evaluation: { evaluator: 'fdnext-session', version: '1' },
        evaluationCtx: { learnerName: learnerName ?? undefined },
      });
      await submitObservation(store, registry, {
        id: evtId(ns, attemptId, 'fb'),
        learnerId,
        occurredAt: now(),
        taskId: task.id,
        eventType: 'feedback',
        attempt: { attemptId },
        feedback: { given: true, target: evalResult?.missed ?? [] },
      });
      await syncEvents();
      committed = { task, attemptId, evalResult };
      phase = 'feedback';
      return session.screen();
    },

    /** Learner leaves feedback → re-select. */
    next(): SessionScreen {
      liveTask = null;
      committed = null;
      phase = 'prompt';
      supportSnapshot = freshSupport();
      supportCounts = new Map();
      playCount = 0;
      promptShownAt = null;
      return session.screen();
    },

    markPromptShown() {
      if (promptShownAt == null) promptShownAt = now();
    },

    /** Replay-derived learner state — read-only. */
    projection(): LearnerProjection {
      return projectLearnerState(
        learnerId,
        events as never,
        capabilities as never,
        registry.tasks as never,
      ) as unknown as LearnerProjection;
    },

    /** The raw evidence log (defensive copy). */
    log(): EvidenceEvent[] {
      return [...events];
    },

    /** The standing selection decision, for "why this next" display. */
    decision(): NextTaskDecision | null {
      return liveTask?.decision ?? null;
    },
  };

  return session;
}
