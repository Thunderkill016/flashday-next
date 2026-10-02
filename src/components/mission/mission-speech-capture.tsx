'use client';

/*
 * MissionSpeechCapture — the real speech path for spoken_turn tasks.
 *
 * Thin mission adapter over EchoType's existing speech plumbing: native
 * Web Speech recognition when the browser ships it, otherwise the
 * MediaRecorder → /api/stt fallback chain. It produces ONLY capture
 * provenance + a transcript for the learner to review — the session
 * driver, deterministic evaluator and projection still own credit. An
 * interim transcript is displayed live but never emitted.
 */
import { Loader2, Mic, MicOff, RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFallbackSTT } from '@/hooks/use-fallback-stt';
import { useVoiceRecognition } from '@/hooks/use-voice-recognition';
import type { CaptureProvenance } from '@/lib/evidence-bridge/types';

export type SpeechCaptureState =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'recording'
  | 'transcribing'
  | 'error';

interface MissionSpeechCaptureProps {
  /** Called once a FINAL transcript exists. The parent renders the
   *  review/commit affordance — this component never commits itself. */
  onTranscript: (transcript: string, capture: CaptureProvenance) => void;
  /** Surface the coarse state upward so the parent can label the UI. */
  onStateChange?: (state: SpeechCaptureState) => void;
  disabled?: boolean;
  lang?: string;
}

const webSpeechErrorMessage = (code: string): string => {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Trình duyệt đã chặn micro. Cho phép quyền micro rồi thử lại, hoặc nhập bằng bàn phím.';
    case 'no-speech':
      return 'Không nghe thấy gì. Nói to hơn hoặc thử lại.';
    case 'audio-capture':
      return 'Không tìm thấy micro. Kiểm tra thiết bị rồi thử lại.';
    case 'network':
      return 'Lỗi mạng khi nhận diện giọng nói. Thử lại hoặc nhập bằng bàn phím.';
    default:
      return `Nhận diện giọng nói gặp lỗi (${code}). Thử lại hoặc nhập bằng bàn phím.`;
  }
};

export function MissionSpeechCapture({
  onTranscript,
  onStateChange,
  disabled,
  lang = 'en-US',
}: MissionSpeechCaptureProps) {
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SpeechCaptureState>('idle');
  const [fallbackInterim, setFallbackInterim] = useState('');
  /* A final transcript is reported exactly once per capture session —
   * this ref is the idempotence boundary so a late/duplicated onend or
   * a stale fallback callback cannot emit twice. */
  const reportedRef = useRef(false);

  const setBoth = useCallback(
    (s: SpeechCaptureState) => {
      setState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  /* ---- native Web Speech path ---- */
  const native = useVoiceRecognition({
    lang,
    continuous: false,
    interimResults: true,
    onError: useCallback(
      (code: string) => {
        setError(webSpeechErrorMessage(code));
        setBoth('error');
      },
      [setBoth],
    ),
  });

  /* When native listening ends with a final transcript, hand it to the
   * parent for review. Empty results surface as a retryable error. */
  const wasListeningRef = useRef(false);
  useEffect(() => {
    if (wasListeningRef.current && !native.isListening) {
      const finalText = native.transcript.trim();
      if (finalText) {
        if (!reportedRef.current) {
          reportedRef.current = true;
          onTranscript(finalText, {
            mode: 'speech',
            authority: 'asr',
            provider: 'web-speech',
            final: true,
            confidence: native.confidence,
          });
          setBoth('idle');
        }
      } else if (state === 'listening') {
        setError('Không nghe thấy gì. Nói to hơn hoặc thử lại.');
        setBoth('error');
      }
    }
    wasListeningRef.current = native.isListening;
  }, [native.isListening, native.transcript, native.confidence, onTranscript, setBoth, state]);

  /* ---- server STT fallback path (MediaRecorder → /api/stt) ---- */
  const fallback = useFallbackSTT({
    lang: lang.split('-')[0],
    onTranscript: useCallback(
      (text: string, meta?: { provider?: string | null }) => {
        setFallbackInterim('');
        const finalText = text.trim();
        if (!finalText) {
          setError('Không nhận diện được lời nói. Thử lại hoặc nhập bằng bàn phím.');
          setBoth('error');
          return;
        }
        if (!reportedRef.current) {
          reportedRef.current = true;
          onTranscript(finalText, {
            mode: 'speech',
            authority: 'asr',
            provider: meta?.provider ?? null,
            final: true,
            confidence: null,
          });
        }
        setBoth('idle');
      },
      [onTranscript, setBoth],
    ),
    onInterimTranscript: useCallback((text: string) => setFallbackInterim(text), []),
    onError: useCallback(
      (message: string) => {
        setFallbackInterim('');
        setError(message === 'Microphone access denied.' ? webSpeechErrorMessage('not-allowed') : message);
        setBoth('error');
      },
      [setBoth],
    ),
  });

  const nativeSupported = native.isSupported;
  const interim = nativeSupported ? native.interimTranscript : fallbackInterim;
  const capturing =
    state === 'listening' || state === 'recording' || state === 'requesting_permission' || state === 'transcribing';

  const start = useCallback(() => {
    reportedRef.current = false;
    setError(null);
    setFallbackInterim('');
    if (nativeSupported) {
      setBoth('listening');
      native.startListening();
    } else {
      /* getUserMedia runs inside startRecording — requesting_permission
       * covers the permission prompt window until the recorder flips
       * to 'recording'. */
      setBoth('requesting_permission');
      void fallback.startRecording();
    }
  }, [nativeSupported, native, fallback, setBoth]);

  /* Mirror the fallback hook's recording/transcribing flags into the
   * coarse state (start is initiated above; this effect converges). */
  useEffect(() => {
    if (nativeSupported) return;
    if (fallback.isRecording && state === 'requesting_permission') setBoth('recording');
    else if (fallback.isTranscribing && state !== 'transcribing') setBoth('transcribing');
    else if (!fallback.isRecording && !fallback.isTranscribing && (state === 'recording' || state === 'transcribing'))
      setBoth('idle');
  }, [nativeSupported, fallback.isRecording, fallback.isTranscribing, state, setBoth]);

  const stop = useCallback(() => {
    if (nativeSupported) {
      native.stopListening();
      /* onend flips isListening → the effect above emits the result. */
    } else {
      fallback.stopRecording();
      setBoth('transcribing');
    }
  }, [nativeSupported, native, fallback, setBoth]);

  return (
    <div className="space-y-2" data-testid="mission-speech" data-state={state}>
      {state === 'idle' && (
        <Button type="button" variant="outline" data-testid="mission-mic-start" disabled={disabled} onClick={start}>
          <Mic className="w-4 h-4" /> Nói câu trả lời
        </Button>
      )}

      {(state === 'requesting_permission' || state === 'transcribing') && (
        <div className="flex items-center gap-2 text-sm text-slate-500" data-testid="mission-mic-busy">
          <Loader2 className="w-4 h-4 animate-spin" />
          {state === 'requesting_permission' ? 'Đang xin quyền micro…' : 'Đang nhận diện…'}
        </div>
      )}

      {(state === 'listening' || state === 'recording') && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="destructive" size="sm" data-testid="mission-mic-stop" onClick={stop}>
              <MicOff className="w-4 h-4" /> Dừng
            </Button>
            <span className="text-xs text-red-500 animate-pulse" data-testid="mission-mic-status">
              Đang nghe…
            </span>
          </div>
          {(interim || nativeSupported) && (
            <p className="text-sm text-slate-500 italic min-h-[1.25rem]" data-testid="mission-interim">
              {interim || '…'}
            </p>
          )}
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-2" data-testid="mission-mic-error">
          <p className="text-sm text-red-600">{error}</p>
          <Button type="button" variant="ghost" size="sm" data-testid="mission-mic-retry" onClick={start}>
            <RefreshCcw className="w-4 h-4" /> Thử lại
          </Button>
        </div>
      )}

      {capturing === false && state !== 'idle' && state !== 'error' && null}
    </div>
  );
}
