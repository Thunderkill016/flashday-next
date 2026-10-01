'use client';

/*
 * /mission — the first FlashDay vertical slice on EchoType.
 *
 * One registered mission (mission.meet_new_person) driven entirely by
 * the vendored kernel: the reference planner picks each step with an
 * explainable reason, the session driver mints deterministic attempt
 * ids from the committed log, every response is scored by the task's
 * declared evaluator, and all evidence lands append-only in Dexie —
 * reloads resume the same trajectory because nothing here is session
 * state, only replayed evidence.
 */
import { ChevronRight, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/db';
import {
  CAP_LABEL,
  FUNCTION_HINT,
  modelFor,
  PURPOSE_FRAME,
  STATE_LABEL,
  SUPPORT_LABEL,
} from '@/lib/evidence-bridge/mission-copy';
import { fixtureRegistry } from '@/lib/evidence-bridge/registry';
import { createMissionSession, type SessionScreen } from '@/lib/evidence-bridge/session';
import { createDexieEventStore } from '@/lib/evidence-bridge/store';
import { useAuthStore } from '@/stores/auth-store';

const MISSION_ID = 'mission.meet_new_person';

/* Demo/test clock: the honest way to reach delayed_retrieval without
 * waiting 24h is a clock shift — kernel policy still owns the lag.
 * `fdn:timeOffsetMs` in localStorage survives reloads (so a refresh mid
 * verification keeps the shifted clock); `__FDN_TIME_OFFSET__` is a
 * page-eval seam for browser tests. */
const testOffsetMs = () =>
  typeof window === 'undefined'
    ? 0
    : Number(window.localStorage.getItem('fdn:timeOffsetMs') ?? 0) +
      Number((window as { __FDN_TIME_OFFSET__?: number }).__FDN_TIME_OFFSET__ ?? 0);

const speak = (text: string | null) => {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  window.speechSynthesis.speak(u);
};

export default function MissionPage() {
  const user = useAuthStore((s) => s.user);
  const [screen, setScreen] = useState<SessionScreen | null>(null);
  const [busy, setBusy] = useState(false);
  // learnerName is evaluation context (state_own_name matching) — it
  // is not evidence, so it lives in localStorage, not the event log.
  const nameKey = `fdn:learnerName:${MISSION_ID}`;
  const [name, setName] = useState(() =>
    typeof window === 'undefined' ? '' : (window.localStorage.getItem(nameKey) ?? ''),
  );
  const [text, setText] = useState('');
  const [eventCount, setEventCount] = useState(0);
  const sessionRef = useRef<ReturnType<typeof createMissionSession> | null>(null);

  const sync = useCallback((scr: SessionScreen | Promise<SessionScreen>) => {
    void Promise.resolve(scr).then((s) => {
      setScreen(s);
      setEventCount(sessionRef.current?.log().length ?? 0);
      setBusy(false);
    });
  }, []);

  useEffect(() => {
    const learnerId = user?.id ?? 'local.anonymous';
    const session = createMissionSession({
      learnerId,
      missionId: MISSION_ID,
      registry: fixtureRegistry(),
      store: createDexieEventStore(db.evidenceEvents),
      now: () => Date.now() + testOffsetMs(),
    });
    sessionRef.current = session;
    setBusy(true);
    sync(session.init());
  }, [user?.id, sync]);

  const act = (fn: () => SessionScreen | Promise<SessionScreen>) => {
    if (busy) return;
    setBusy(true);
    sync(fn());
  };

  if (!screen) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-slate-500" data-testid="mission-loading">
          Đang tải nhiệm vụ…
        </p>
      </div>
    );
  }

  if (screen.type === 'intro') {
    return (
      <div className="max-w-2xl mx-auto p-6" data-testid="mission-intro">
        <Card>
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              FlashDay · {MISSION_ID}
            </Badge>
            <CardTitle className="text-2xl">Gặp người mới — Meet someone new</CardTitle>
            <p className="text-sm text-slate-500">
              Chào hỏi, nói tên của bạn, và hỏi tên người khác — từng bước được ghi lại làm bằng chứng học tập.
            </p>
            {screen.resumed && (
              <p className="text-xs text-indigo-600" data-testid="mission-resumed">
                Tiếp tục từ phiên trước — tiến trình của bạn đã được lưu.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {screen.needsName && (
              <label className="block space-y-1.5" htmlFor="mission-name">
                <span className="text-sm font-medium text-slate-700">Tên của bạn (dùng trong bài tập nói tên):</span>
                <Input
                  id="mission-name"
                  data-testid="mission-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mai"
                  className="max-w-xs"
                />
              </label>
            )}
            <Button
              data-testid="mission-start"
              disabled={busy || (screen.needsName && name.trim() === '')}
              onClick={() => {
                window.localStorage.setItem(nameKey, name);
                act(() => sessionRef.current!.start({ learnerName: name }));
              }}
            >
              {screen.resumed ? 'Tiếp tục' : 'Bắt đầu'}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (screen.type === 'summary') {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4" data-testid="mission-summary">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Hoàn thành nhiệm vụ</CardTitle>
            <p className="text-sm text-slate-500" data-testid="mission-summary-reason">
              {screen.reason}
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {screen.progress.map((p) => (
                <li
                  key={p.capabilityId}
                  data-testid={`mission-progress-${p.capabilityId}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                >
                  <span className="text-sm text-slate-700">{CAP_LABEL[p.capabilityId] ?? p.capabilityId}</span>
                  <Badge variant={p.state === 'TRANSFERRED' ? 'default' : 'secondary'}>
                    {STATE_LABEL[p.state] ?? p.state}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <EvidenceFooter count={eventCount} />
      </div>
    );
  }

  const frame = PURPOSE_FRAME[screen.purpose] ?? { label: screen.purpose, hint: '' };

  if (screen.type === 'input') {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4" data-testid="mission-input">
        <StepHeader
          frame={frame}
          taskId={screen.taskId}
          reason={screen.decisionReason}
          testid="mission-input-purpose"
        />
        <Card>
          <CardContent className="pt-6 space-y-3">
            {screen.prompt.lines.map((line, i) => (
              <p key={i} className="rounded-lg bg-slate-50 px-4 py-3 text-lg text-slate-800">
                {line}
              </p>
            ))}
            <div className="flex items-center gap-2">
              {screen.prompt.audioText && (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="mission-play"
                  onClick={() => speak(screen.prompt.audioText)}
                >
                  <Volume2 className="w-4 h-4" /> Nghe
                </Button>
              )}
              {screen.supportOffered.map((kind) => (
                <Button
                  key={kind}
                  variant="ghost"
                  size="sm"
                  data-testid={`mission-support-${kind}`}
                  onClick={() => act(() => sessionRef.current!.support(kind))}
                >
                  {SUPPORT_LABEL[kind] ?? kind}
                </Button>
              ))}
            </div>
            <Button data-testid="mission-view" disabled={busy} onClick={() => act(() => sessionRef.current!.view())}>
              Đã xem — tiếp tục <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
        <EvidenceFooter count={eventCount} />
      </div>
    );
  }

  // task screen — prompt or feedback phase.
  const isFeedback = screen.phase === 'feedback';
  const evalResult = screen.evaluation;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4" data-testid="mission-task">
      <StepHeader
        frame={frame}
        taskId={screen.taskId}
        attemptId={screen.attemptId}
        reason={screen.decisionReason}
        testid="mission-task-purpose"
      />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2" data-testid="mission-stimulus">
            {screen.prompt.textVisible ? (
              screen.prompt.lines.map((line, i) => (
                <p key={i} className="rounded-lg bg-slate-50 px-4 py-3 text-lg text-slate-800">
                  {line}
                </p>
              ))
            ) : (
              <p className="rounded-lg bg-slate-50 px-4 py-3 text-slate-500 italic">
                Nghe đoạn hội thoại — phần chữ bị ẩn.
              </p>
            )}
            {screen.prompt.audioText && (
              <Button
                variant="outline"
                size="sm"
                data-testid="mission-play"
                onClick={() => {
                  speak(screen.prompt.audioText);
                  act(() => sessionRef.current!.play());
                }}
              >
                <Volume2 className="w-4 h-4" /> Nghe
              </Button>
            )}
          </div>

          {isFeedback ? (
            <div className="space-y-3" data-testid="mission-feedback">
              <Badge
                data-testid="mission-outcome"
                variant={evalResult?.outcome === 'success' ? 'default' : 'destructive'}
              >
                {evalResult?.outcome === 'success'
                  ? 'Đúng'
                  : evalResult?.outcome === 'partial'
                    ? 'Gần đúng'
                    : 'Chưa đúng'}
              </Badge>
              {evalResult?.functions && (
                <ul className="text-sm text-slate-600 space-y-1">
                  {evalResult.functions.map((f) => (
                    <li key={f.fn} data-testid={`mission-fn-${f.fn}`}>
                      {f.met ? '✓' : '✗'} {f.fn}
                    </li>
                  ))}
                </ul>
              )}
              {screen.revealModelAfterAttempt && (
                <p className="rounded-lg bg-indigo-50 px-4 py-3 text-indigo-800" data-testid="mission-model">
                  Mẫu: {modelFor(screen.requiredFunctions, null).join(' — ')}
                </p>
              )}
              <Button data-testid="mission-next" disabled={busy} onClick={() => act(() => sessionRef.current!.next())}>
                Tiếp tục <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {screen.responseType === 'choice' ? (
                <div className="space-y-2" data-testid="mission-options">
                  {(screen.options ?? []).map((opt) => (
                    <Button
                      key={opt.id}
                      variant="outline"
                      className="w-full justify-start"
                      data-testid={`mission-option-${opt.id}`}
                      disabled={busy}
                      onClick={() => act(() => sessionRef.current!.commit({ optionId: opt.id }))}
                    >
                      {opt.text}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      data-testid="mission-response-input"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && text.trim()) {
                          act(async () => {
                            const scr = await sessionRef.current!.commit({ text });
                            setText('');
                            return scr;
                          });
                        }
                      }}
                      placeholder="Nhập câu trả lời của bạn…"
                      className="flex-1"
                    />
                    <Button
                      data-testid="mission-commit"
                      disabled={busy || text.trim() === ''}
                      onClick={() =>
                        act(async () => {
                          const scr = await sessionRef.current!.commit({ text });
                          setText('');
                          return scr;
                        })
                      }
                    >
                      Gửi
                    </Button>
                  </div>
                </div>
              )}
              {screen.supportOffered.length > 0 && (
                <div className="flex flex-wrap gap-2" data-testid="mission-supports">
                  {screen.supportOffered.map((kind) =>
                    screen.supportUsed[kind as keyof typeof screen.supportUsed] === true ? (
                      <span
                        key={kind}
                        data-testid={`mission-support-used-${kind}`}
                        className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700"
                      >
                        {SUPPORT_LABEL[kind] ?? kind} (đã ghi)
                      </span>
                    ) : (
                      <Button
                        key={kind}
                        variant="ghost"
                        size="sm"
                        data-testid={`mission-support-${kind}`}
                        disabled={busy}
                        onClick={() => act(() => sessionRef.current!.support(kind))}
                      >
                        {SUPPORT_LABEL[kind] ?? kind}
                      </Button>
                    ),
                  )}
                </div>
              )}
              {screen.supportUsed.modelAnswer && (
                <p className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                  Mẫu: {modelFor(screen.requiredFunctions, name || null).join(' — ') || '—'}
                </p>
              )}
              {screen.supportUsed.hint && (
                <p className="text-sm text-amber-700">
                  Gợi ý:{' '}
                  {screen.requiredFunctions
                    .map((fn) => FUNCTION_HINT[fn])
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              {screen.supportUsed.transcript && screen.prompt.lines.length > 0 && (
                <p className="text-sm text-slate-600">{screen.prompt.lines.join(' / ')}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <EvidenceFooter count={eventCount} />
    </div>
  );
}

function StepHeader({
  frame,
  taskId,
  attemptId,
  reason,
  testid,
}: {
  frame: { label: string; hint: string };
  taskId: string;
  attemptId?: string;
  reason: string | null;
  testid: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" data-testid={testid}>
          {frame.label}
        </Badge>
        <span className="text-xs text-slate-400" data-testid="mission-task-id">
          {taskId}
          {attemptId ? ` · ${attemptId}` : ''}
        </span>
      </div>
      {frame.hint && <p className="text-sm text-slate-500">{frame.hint}</p>}
      {reason && (
        <p className="text-xs text-indigo-500" data-testid="mission-reason">
          Vì sao bước này: {reason}
        </p>
      )}
    </div>
  );
}

function EvidenceFooter({ count }: { count: number }) {
  return (
    <p className="text-center text-xs text-slate-300" data-testid="mission-evidence">
      {count} sự kiện bằng chứng đã ghi
    </p>
  );
}
