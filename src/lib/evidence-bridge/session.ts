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

/* W2-02.6 — a TaskContract's modality is an EXECUTION REQUIREMENT, not
 * descriptive metadata. The web surface supports exactly two honest
 * shapes; everything else is refused, never approximated. In particular
 * `spoken_turn` is NOT reinterpreted as a text box — typed text cannot
 * mint spoken_production/spoken_interaction evidence. */
export type SurfaceKind = 'exposure' | 'listening_choice_audio' | 'unsupported';
export const surfaceKindForTask = (task: KernelTask): SurfaceKind => {
  const responseType = task.response?.type;
  const stimulusType = (task.stimulus as { type?: string } | undefined)?.type;
  if (responseType === 'none' && EXPOSURE_PURPOSES.has(task.purpose)) return 'exposure';
  if (task.modality === 'listening' && stimulusType === 'audio_line' && responseType === 'choice') {
    return 'listening_choice_audio';
  }
  return 'unsupported';
};

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
  | {
      type: 'intro';
      missionId: string;
      resumed: boolean;
      needsName: boolean;
      /** Contract-derived copy — the page renders the mission's own
       * declared scenario/goal, never page-authored fiction. */
      scenario: string;
      learnerGoal: string;
    }
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
      responseType: 'choice' | 'text';
      options: { id: string; text: string; correct?: boolean }[] | null;
      requiredFunctions: string[];
      supportOffered: string[];
      supportUsed: SupportSnapshot;
      evaluation: AttemptEvalResult | null;
      revealModelAfterAttempt: boolean;
      /** For LISTENING_CHOICE_AUDIO_V1: true only after the transport
       * confirmed the stimulus played (utterance onend). Choices stay
       * disabled until then — a lucky guess is not listening evidence. */
      delivered: boolean;
      decisionReason: string | null;
    }
  | {
      /** The contract's declared surface is not executable on the web —
       * e.g. spoken_turn. No input, no self-report, no evidence. */
      type: 'surface_unavailable';
      taskId: string;
      taskRevision: number;
      capabilityId: string;
      purpose: string;
      modality: string;
      responseType: string | null;
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
  /* Stimulus delivery is transport-confirmed, not a button press: the
   * page calls confirmDelivery() only after the browser reports the
   * audio finished, and it must name WHICH attempt the utterance
   * belonged to — a completion for a stale task/attempt confirms
   * nothing for the live one. First confirmation = delivered (never
   * support); each further one is a repeat support_use. `deliveredAt`
   * anchors response latency — the clock starts when the stimulus
   * finished, not when React rendered. */
  let delivered = false;
  let deliveredAt: number | null = null;

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
    /* Only LISTENING_CHOICE_AUDIO_V1 reaches a task screen — the surface
     * classifier refuses every other claim-bearing shape, so the
     * response channel is always 'choice'. No text fallback exists. */
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
      responseType: 'choice',
      options:
        (task.response as { options?: { id: string; text: string; correct?: boolean }[] } | undefined)?.options ?? [],
      requiredFunctions: task.response?.requiredFunctions ?? [],
      supportOffered: phase === 'prompt' ? supportOffered(task) : [],
      supportUsed: { ...supportSnapshot },
      evaluation: phase === 'feedback' ? evalResult : null,
      revealModelAfterAttempt:
        (task.supportPolicy as { revealModelAfterAttempt?: boolean } | undefined)?.revealModelAfterAttempt === true,
      delivered,
      decisionReason: liveTask?.decision?.reason ?? null,
    };
  };

  const unavailableScreen = (task: KernelTask): SessionScreen => ({
    type: 'surface_unavailable',
    taskId: task.id,
    taskRevision: task.revision ?? 1,
    capabilityId: task.capabilityId,
    purpose: task.purpose,
    modality: task.modality,
    responseType: task.response?.type ?? null,
    decisionReason: liveTask?.decision?.reason ?? null,
  });

  /** The one switch that enforces the modality contract: every selected
   * task renders its honest surface or refuses to render a channel. */
  const screenFor = (task: KernelTask): SessionScreen => {
    const kind = surfaceKindForTask(task);
    if (kind === 'exposure') return inputScreen(task);
    if (kind === 'listening_choice_audio') return taskScreen(task, null);
    return unavailableScreen(task);
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
          scenario: (mission as { scenario?: string }).scenario ?? '',
          learnerGoal: (mission as { learnerGoal?: string }).learnerGoal ?? '',
        };
      }
      if (phase === 'feedback' && committed) {
        return taskScreen(committed.task, committed.evalResult);
      }
      // Live-task lock: render the standing decision until consumed —
      // the selector never re-runs underneath an open prompt.
      if (liveTask && phase === 'prompt') {
        return screenFor(liveTask.task);
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
            delivered = false;
            deliveredAt = null;
          }
          return screenFor(task);
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
      if (surfaceKindForTask(task) !== 'exposure') return session.screen();
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
      if (surfaceKindForTask(task) === 'unsupported') return session.screen();
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

    /** Transport-confirmed stimulus delivery: the page calls this only
     * after the browser reports playback completed (utterance onend),
     * carrying the taskId+attemptId the audio was started for. Both are
     * re-verified against the LIVE selection — an utterance that outlives
     * its prompt (task advanced, attempt committed, feedback showing)
     * confirms nothing for whatever replaced it. The first confirmation
     * is the stimulus itself — required, never support; each further one
     * is a repeat, recorded as support. */
    async confirmDelivery({
      taskId = null,
      attemptId = null,
    }: {
      taskId?: string | null;
      attemptId?: string | null;
    } = {}): Promise<SessionScreen> {
      if (!liveTask || phase !== 'prompt') return session.screen();
      const task = liveTask.task;
      if (surfaceKindForTask(task) !== 'listening_choice_audio') return session.screen();
      if (taskId !== task.id || attemptId !== attemptIdFor(task)) return session.screen();
      playCount += 1;
      if (playCount === 1) {
        delivered = true;
        deliveredAt = now();
      } else {
        const task = liveTask.task;
        const attemptId = attemptIdFor(task);
        // Each repeat event contributes ONE replay to the union — the
        // kernel sums repeatCount across events, so the ordinal lives in
        // the event id and the stamped total stays truthful.
        await submitObservation(store, registry, {
          id: evtId(ns, attemptId, 'sup', 'repeat', playCount - 1),
          learnerId,
          occurredAt: now(),
          taskId: task.id,
          eventType: 'support_use',
          attempt: { attemptId },
          support: { ...freshSupport(), repeat: true, repeatCount: 1 },
        });
        await syncEvents();
        supportSnapshot = {
          ...supportSnapshot,
          repeat: true,
          repeatCount: (supportSnapshot.repeatCount ?? 0) + 1,
        };
      }
      return session.screen();
    },

    /** Commit the response: dispatch is by the DECLARED response surface,
     * never by what the caller happened to send. Only the listening
     * choice surface is executable — it additionally requires the
     * transport-confirmed stimulus (a lucky guess is not listening
     * evidence). Everything else refuses silently: no substitute
     * channel, no event. A second commit on the same screen is a no-op. */
    async commit({ optionId = null }: { optionId?: string | null } = {}): Promise<SessionScreen> {
      const active = phase === 'feedback' && committed ? { task: committed.task } : liveTask;
      if (!active || phase !== 'prompt') return session.screen();
      const task = active.task;
      if (surfaceKindForTask(task) !== 'listening_choice_audio') return session.screen();
      if (!delivered) return session.screen();
      if (optionId == null) return session.screen();
      const response = { optionId };

      const attemptId = attemptIdFor(task);
      // The stamped support snapshot is the union of this attempt's
      // DURABLE support_use events — in-memory flags are merely a
      // projection of them, so seeding from supportSnapshot would
      // double-count (e.g. repeatCount). unionSupport is the same
      // accumulation rule the projection applies.
      let stamped = freshSupport();
      for (const e of events) {
        if (e.attempt?.attemptId === attemptId && e.taskId === task.id && e.eventType === 'support_use') {
          stamped = unionSupport(stamped, e.support) ?? stamped;
        }
      }
      const { evalResult } = await submitAttempt(store, registry, {
        // No caller id: the bridge pins the canonical evt.<attemptId> —
        // a custom id would be refused, not silently honored.
        learnerId,
        occurredAt: now(),
        taskId: task.id,
        response,
        attemptId,
        // Latency = commit − transport-confirmed delivery. Render time
        // and speech duration are deliberately excluded (§11).
        latencyMs: deliveredAt != null ? Math.max(0, now() - deliveredAt) : undefined,
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
      delivered = false;
      deliveredAt = null;
      return session.screen();
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
