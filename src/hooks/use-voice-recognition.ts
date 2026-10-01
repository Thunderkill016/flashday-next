'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVoiceRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

interface UseVoiceRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  /** Confidence of the most recent FINAL result's top alternative
   *  (0..1), or null when the recognizer does not report one. */
  confidence: number | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  getTranscript: () => { transcript: string; interimTranscript: string };
}

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}): UseVoiceRecognitionReturn {
  const { lang = 'en-US', continuous = true, interimResults = true, onResult, onEnd, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  });
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);

  const transcriptRef = useRef('');
  const interimTranscriptRef = useRef('');

  useEffect(() => {
    onResultRef.current = onResult;
    onEndRef.current = onEnd;
    onErrorRef.current = onError;
  }, [onResult, onEnd, onError]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const rec = new SpeechRecognitionAPI();
    rec.continuous = continuous;
    rec.interimResults = interimResults;
    rec.lang = lang;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interimText = '';
      let finalConfidence: number | null = null;
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
          // Some engines omit `confidence`; keep null rather than
          // inventing a value — provenance must stay honest.
          const c = result[0].confidence;
          if (typeof c === 'number' && !Number.isNaN(c)) finalConfidence = c;
        } else {
          interimText += result[0].transcript;
        }
      }
      if (finalConfidence != null) setConfidence(finalConfidence);
      transcriptRef.current = finalText;
      interimTranscriptRef.current = interimText;
      setTranscript(finalText);
      setInterimTranscript(interimText);
      onResultRef.current?.(finalText || interimText, !!finalText);
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      onErrorRef.current?.(event.error);
    };

    rec.onend = () => {
      setIsListening(false);
      onEndRef.current?.();
    };

    recognitionRef.current = rec;

    return () => {
      rec.abort();
    };
  }, [lang, continuous, interimResults]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    transcriptRef.current = '';
    interimTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setConfidence(null);
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // Already started
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    transcriptRef.current = '';
    interimTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setConfidence(null);
  }, []);

  const getTranscript = useCallback(
    () => ({
      transcript: transcriptRef.current,
      interimTranscript: interimTranscriptRef.current,
    }),
    [],
  );

  return {
    isListening,
    transcript,
    interimTranscript,
    confidence,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    getTranscript,
  };
}
