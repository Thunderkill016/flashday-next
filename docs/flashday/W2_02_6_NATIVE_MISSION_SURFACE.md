# W2-02.6 — Native Mission Surface Integrity Pilot

Status: implemented on `flashday/w2-02-6-native-mission-surface`, stacked on
`23924cc` (W2-02.5 head). This is a surface-hardening prerequisite, **not**
W2-03, not W3 Speech.

## Discovered defect — modality laundering

The native mission runtime already existed (`src/lib/evidence-bridge/session.ts`
+ `src/app/(app)/mission/page.tsx`) and already called the production
`submitAttempt()`. But its response-channel dispatch was:

    response.type === 'choice'  → options
    everything else             → text input

Every non-choice task — including contracts that declare
`spoken_production`/`spoken_interaction` modality with a `spoken_turn`
response — rendered a text box whose typed payload was committed as a claim-
bearing attempt event. Typed text minted evidence for spoken capabilities:
**modality laundering** (`meet_new_person` ran 16/18 tasks this way).

## The rule

**A TaskContract's modality is an execution requirement, not descriptive
metadata. An execution surface that cannot produce the declared modality must
refuse the task rather than substitute another response channel.**

## Supported-surface matrix

`surfaceKindForTask()` in `session.ts` is the single classifier:

| Contract shape | Surface |
|---|---|
| `response.type = none` + `input`/`notice` purpose | `exposure` — `view()` mints an exposure observation, never an outcome |
| `modality = listening` + `stimulus.type = audio_line` + `response.type = choice` | `listening_choice_audio` — the one claim-bearing web surface |
| everything else (`spoken_turn`, unknown response types, …) | `unsupported` → `surface_unavailable` |

`unsupported` renders a fail-closed card: no text input, no choice
approximation, no self-report button — and the session-level guards mean no
channel (`commit`, `play`, `support`, `view`) mints an event for it. The
planner is unchanged; the refusal lives at execution.

## Pilot contract (nothing new authored)

`mission.meet_at_a_time → task.time.diagnostic.hear →
reception.listen.understand_clock_time → eval.choice.correct.v1`

Listening stimulus `"The class is at three o'clock."`, correct option `three`.
No new evaluator, capability, mission, or task was created.

## Audio delivery boundary

Listening evidence requires *auditory* stimulus delivery:

- `session.play()` is the delivery handshake — the page calls it **only** from
  the utterance's `onend` callback (`speechSynthesis` transport confirmation).
  A button press alone confirms nothing.
- `commit()` refuses (no-op, zero events) until `delivered` is set by a real
  `play()` call — the gate lives in the session, not just in disabled buttons.
- If the transport can't confirm (`speechSynthesis` missing, `onerror`,
  cancelled, never completes) → no delivery → the task can never commit.
- `delivered`/`deliveredAt` are volatile session state: a reload resets them —
  fail-safe, the learner simply hears the stimulus again.
- Honest limit: `onend` proves the transport emitted the stimulus; it does not
  prove the learner physically heard it. That distinction is preserved —
  nothing stronger is claimed.
- Response latency anchors to `deliveredAt` (commit − delivery completion) —
  render time and speech duration are excluded.

## Repeat/support semantics

- Play #1 = the required stimulus — **not** support.
- Play #N (N≥2) = one `support_use` observation with `repeat: true,
  repeatCount: 1`, deterministic id `e~…~<attemptId>~sup~repeat~<N-1>`.
- Each repeat event contributes exactly one replay; `unionSupport` accumulates
  the count additively at commit time, so the stamped attempt reports the true
  total (2 replays → `repeatCount: 2`). The ordinal lives in the event id —
  carrying a cumulative count *inside* each event would double-count.
- The committed attempt's stamped support is unioned **only** from durable
  `support_use` events for that attemptId — the in-memory snapshot is a
  projection, not a second source of truth (and would double-count after a
  reload).

## Canonical attempt identity

- Claim-bearing attempt events always mint `id = evt.<attemptId>` with
  `attemptId = <taskId>@<revision>:a<N>` derived from committed evidence —
  deterministic across reloads, `a2` follows `a1`, no random UUIDs.
- `bridge.ts` enforces this at the mint boundary: a caller-supplied `id` that
  mismatches `evt.<attemptId>` is **refused** (throw), not silently overridden;
  `id = evt.<attemptId>` is accepted verbatim (idempotent redelivery); an
  omitted `id` is derived. Observation events keep their own deterministic
  `e~…` ids — this rule applies only to claim-bearing attempts.
- Support and feedback observations share the attempt's `attemptId` but carry
  distinct ids (`…~sup~…`, `…~fb`).

## Response-schema integrity

`commit()` accepts `{ optionId }` only and dispatches by the *declared* surface:
only `listening_choice_audio` reaches `submitAttempt` with `{ optionId }`.
There is no `else → {text}` branch — a caller passing a rogue text payload gets
a silent no-op (the TypeScript signature no longer advertises `text`; tests
cast to prove the runtime refusal).

## Route

`/mission?m=<missionId>` — validated against `fixtureRegistry().missionById()`;
unknown/unregistered ids fall back to the pilot `mission.meet_at_a_time`.
Caller-supplied mission data can never bypass the registry. Intro copy
(`scenario`, `learnerGoal`) is derived from the mission contract — no
page-authored copy that could drift. The former hard-coded
`mission.meet_new_person` path still works and now honestly reaches
`surface_unavailable` on its first spoken diagnostic.

## Pilot projection result

A correct `three` commit mints exactly one event
`evt.task.time.diagnostic.hear@1:a1` (`outcome: success`, `modality:
listening`, `contractId: eval.choice.correct.v1`), followed by a `feedback`
observation. The projection moves **only**
`reception.listen.understand_clock_time`; `production.speak.state_clock_time`,
`interaction.greet`, `interaction.ask_name` and all other capabilities are
unchanged — asserted in `session-surface.test.ts`.

The next planner selection is `task.time.diagnostic.say` (declared baseline,
`spoken_turn`) → `surface_unavailable`, zero events — the honest terminal state
for web.

## Remaining unsupported surfaces

Every `spoken_production`/`spoken_interaction`/`spoken_turn` contract —
currently 10 of 18 `meet_at_a_time` tasks and 16/18 of `meet_new_person` — has
no legitimate W2 web surface. They fail closed until W3 Speech provides a real
audio-response channel. The regression matrix test
(`session-surface.test.ts` "surface compatibility matrix") classifies **every**
registered fixture task, so a future contract shape can't silently fall back
to a text box.

## Tests

- `session-surface.test.ts` — 14 tests: matrix, fail-closed, delivery gate,
  repeats, canonical identity, projection isolation, reload reset.
- `session.test.ts` — rewritten onto a TEST-ONLY all-listening mission
  (registry-passed contracts) covering driver semantics that no fixture
  mission can exercise on web anymore, plus the spoken-terminal pin on a
  mission whose only eliciting task is spoken.
- `e2e/mission-falsification.spec.ts` — real-browser pilot: delivery gating,
  silent-transport refusal, canonical event shape, wrong answer, repeats,
  reload behavior, forged rows, `?m=` fallback.
- `e2e/mission-meet-person.spec.ts` — the spoken fail-closed lock.
