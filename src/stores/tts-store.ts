import { create } from 'zustand';
import { DEFAULT_TRANSLATION_TARGET, isTranslationTarget } from '@/lib/i18n/locale';

const STORAGE_KEY = 'echotype_tts_settings';

export type TTSSource = 'browser' | 'fish' | 'google' | 'openai';

const VALID_VOICE_SOURCES: ReadonlySet<string> = new Set(['browser', 'fish', 'google', 'openai']);

export interface TTSSettings {
  voiceSource: TTSSource;
  voiceURI: string; // SpeechSynthesisVoice.voiceURI
  speed: number; // 0.5 - 2.0
  pitch: number; // 0.5 - 2.0
  volume: number; // 0 - 1
  fishApiKey: string;
  fishVoiceId: string;
  fishVoiceName: string;
  fishModel: string;
  googleApiKey: string;
  googleVoiceName: string;
  googleVoiceLabel: string;
  googleLanguageCode: string;
  openaiTtsApiKey: string;
  openaiTtsBaseUrl: string;
  openaiTtsModel: string;
  openaiTtsVoice: string;
  openaiTtsVoiceLabel: string;
  kokoroServerUrl: string;
  kokoroApiKey: string;
  kokoroVoiceId: string;
  kokoroVoiceName: string;
  targetLang: string;
  recommendationsEnabled: boolean;
  recommendationsCount: number;
  groqApiKey: string;
  openaiKey: string;
  anthropicKey: string;
  deepseekKey: string;
}

interface TTSStore extends TTSSettings {
  hydrated: boolean;
  setVoiceSource: (source: TTSSource) => void;
  setVoiceURI: (uri: string) => void;
  setSpeed: (speed: number) => void;
  setPitch: (pitch: number) => void;
  setVolume: (volume: number) => void;
  setFishApiKey: (key: string) => void;
  setFishVoice: (voiceId: string, voiceName?: string) => void;
  setFishModel: (model: string) => void;
  setGoogleApiKey: (key: string) => void;
  setGoogleVoice: (voiceName: string, voiceLabel?: string, languageCode?: string) => void;
  setOpenAITtsApiKey: (key: string) => void;
  setOpenAITtsBaseUrl: (url: string) => void;
  setOpenAITtsModel: (model: string) => void;
  setOpenAITtsVoice: (voice: string, voiceLabel?: string) => void;
  setKokoroServerUrl: (url: string) => void;
  setKokoroApiKey: (key: string) => void;
  setKokoroVoice: (voiceId: string, voiceName?: string) => void;
  setTargetLang: (lang: string) => void;
  setRecommendationsEnabled: (enabled: boolean) => void;
  setRecommendationsCount: (count: number) => void;
  setGroqApiKey: (key: string) => void;
  setOpenaiKey: (key: string) => void;
  setAnthropicKey: (key: string) => void;
  setDeepseekKey: (key: string) => void;
  hydrate: () => void;
}

function loadFromStorage(): Partial<Omit<TTSSettings, 'voiceSource'>> & { voiceSource?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function toPersistedSettings(settings: TTSSettings | TTSStore): TTSSettings {
  return {
    voiceSource: settings.voiceSource,
    voiceURI: settings.voiceURI,
    speed: settings.speed,
    pitch: settings.pitch,
    volume: settings.volume,
    fishApiKey: settings.fishApiKey,
    fishVoiceId: settings.fishVoiceId,
    fishVoiceName: settings.fishVoiceName,
    fishModel: settings.fishModel,
    googleApiKey: settings.googleApiKey,
    googleVoiceName: settings.googleVoiceName,
    googleVoiceLabel: settings.googleVoiceLabel,
    googleLanguageCode: settings.googleLanguageCode,
    openaiTtsApiKey: settings.openaiTtsApiKey,
    openaiTtsBaseUrl: settings.openaiTtsBaseUrl,
    openaiTtsModel: settings.openaiTtsModel,
    openaiTtsVoice: settings.openaiTtsVoice,
    openaiTtsVoiceLabel: settings.openaiTtsVoiceLabel,
    kokoroServerUrl: settings.kokoroServerUrl,
    kokoroApiKey: settings.kokoroApiKey,
    kokoroVoiceId: settings.kokoroVoiceId,
    kokoroVoiceName: settings.kokoroVoiceName,
    targetLang: settings.targetLang,
    recommendationsEnabled: settings.recommendationsEnabled,
    recommendationsCount: settings.recommendationsCount,
    groqApiKey: settings.groqApiKey,
    openaiKey: settings.openaiKey,
    anthropicKey: settings.anthropicKey,
    deepseekKey: settings.deepseekKey,
  };
}

function saveToStorage(settings: TTSSettings | TTSStore) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistedSettings(settings)));
  } catch {
    /* ignore */
  }
}

function normalizeSavedSettings(
  saved: Partial<Omit<TTSSettings, 'voiceSource'>> & { voiceSource?: string },
): Partial<TTSSettings> {
  const normalized = { ...saved } as Partial<TTSSettings>;

  // Retired sources ('kokoro', 'edge') and corrupt values fail safe to browser speech.
  if (normalized.voiceSource !== undefined && !VALID_VOICE_SOURCES.has(normalized.voiceSource)) {
    normalized.voiceSource = 'browser';
  }

  if ('kokoroServerUrl' in normalized && !normalized.kokoroServerUrl?.trim()) {
    delete normalized.kokoroServerUrl;
  }

  if (normalized.targetLang === 'zh') {
    normalized.targetLang = 'zh-CN';
  } else if ('targetLang' in normalized && !isTranslationTarget(normalized.targetLang)) {
    delete normalized.targetLang;
  }

  return normalized;
}

export const DEFAULT_GOOGLE_VOICE_NAME = 'en-US-Wavenet-F';
export const DEFAULT_GOOGLE_VOICE_LABEL = 'Wavenet F';
export const DEFAULT_GOOGLE_LANGUAGE_CODE = 'en-US';
export const DEFAULT_OPENAI_TTS_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
export const DEFAULT_OPENAI_TTS_VOICE = 'marin';
export const DEFAULT_OPENAI_TTS_VOICE_LABEL = 'Marin';

const defaults: TTSSettings = {
  voiceSource: 'browser',
  voiceURI: '',
  speed: 1,
  pitch: 1,
  volume: 1,
  fishApiKey: '',
  fishVoiceId: '',
  fishVoiceName: '',
  fishModel: 's2-pro',
  googleApiKey: '',
  googleVoiceName: DEFAULT_GOOGLE_VOICE_NAME,
  googleVoiceLabel: DEFAULT_GOOGLE_VOICE_LABEL,
  googleLanguageCode: DEFAULT_GOOGLE_LANGUAGE_CODE,
  openaiTtsApiKey: '',
  openaiTtsBaseUrl: DEFAULT_OPENAI_TTS_BASE_URL,
  openaiTtsModel: DEFAULT_OPENAI_TTS_MODEL,
  openaiTtsVoice: DEFAULT_OPENAI_TTS_VOICE,
  openaiTtsVoiceLabel: DEFAULT_OPENAI_TTS_VOICE_LABEL,
  kokoroServerUrl: '',
  kokoroApiKey: '',
  kokoroVoiceId: '',
  kokoroVoiceName: '',
  targetLang: DEFAULT_TRANSLATION_TARGET,
  recommendationsEnabled: true,
  recommendationsCount: 5,
  groqApiKey: '',
  openaiKey: '',
  anthropicKey: '',
  deepseekKey: '',
};

export const useTTSStore = create<TTSStore>((set, get) => ({
  ...defaults,
  hydrated: false,

  setVoiceSource: (voiceSource) => {
    set({ voiceSource });
    saveToStorage({ ...get(), voiceSource });
  },

  setVoiceURI: (voiceURI) => {
    set({ voiceURI });
    saveToStorage({ ...get(), voiceURI });
  },

  setSpeed: (speed) => {
    set({ speed });
    saveToStorage({ ...get(), speed });
  },

  setPitch: (pitch) => {
    set({ pitch });
    saveToStorage({ ...get(), pitch });
  },

  setVolume: (volume) => {
    set({ volume });
    saveToStorage({ ...get(), volume });
  },

  setFishApiKey: (fishApiKey) => {
    set({ fishApiKey });
    saveToStorage({ ...get(), fishApiKey });
  },

  setFishVoice: (fishVoiceId, fishVoiceName = '') => {
    set({ fishVoiceId, fishVoiceName });
    saveToStorage({ ...get(), fishVoiceId, fishVoiceName });
  },

  setFishModel: (fishModel) => {
    set({ fishModel });
    saveToStorage({ ...get(), fishModel });
  },

  setGoogleApiKey: (googleApiKey) => {
    set({ googleApiKey });
    saveToStorage({ ...get(), googleApiKey });
  },

  setGoogleVoice: (googleVoiceName, googleVoiceLabel = '', googleLanguageCode = DEFAULT_GOOGLE_LANGUAGE_CODE) => {
    set({ googleVoiceName, googleVoiceLabel, googleLanguageCode });
    saveToStorage({ ...get(), googleVoiceName, googleVoiceLabel, googleLanguageCode });
  },

  setOpenAITtsApiKey: (openaiTtsApiKey) => {
    set({ openaiTtsApiKey });
    saveToStorage({ ...get(), openaiTtsApiKey });
  },

  setOpenAITtsBaseUrl: (openaiTtsBaseUrl) => {
    set({ openaiTtsBaseUrl });
    saveToStorage({ ...get(), openaiTtsBaseUrl });
  },

  setOpenAITtsModel: (openaiTtsModel) => {
    set({ openaiTtsModel });
    saveToStorage({ ...get(), openaiTtsModel });
  },

  setOpenAITtsVoice: (openaiTtsVoice, openaiTtsVoiceLabel = '') => {
    set({ openaiTtsVoice, openaiTtsVoiceLabel });
    saveToStorage({ ...get(), openaiTtsVoice, openaiTtsVoiceLabel });
  },

  setKokoroServerUrl: (kokoroServerUrl) => {
    set({ kokoroServerUrl });
    saveToStorage({ ...get(), kokoroServerUrl });
  },

  setKokoroApiKey: (kokoroApiKey) => {
    set({ kokoroApiKey });
    saveToStorage({ ...get(), kokoroApiKey });
  },

  setKokoroVoice: (kokoroVoiceId, kokoroVoiceName = '') => {
    set({ kokoroVoiceId, kokoroVoiceName });
    saveToStorage({ ...get(), kokoroVoiceId, kokoroVoiceName });
  },

  setTargetLang: (targetLang) => {
    set({ targetLang });
    saveToStorage({ ...get(), targetLang });
  },

  setRecommendationsEnabled: (recommendationsEnabled) => {
    set({ recommendationsEnabled });
    saveToStorage({ ...get(), recommendationsEnabled });
  },

  setRecommendationsCount: (recommendationsCount) => {
    set({ recommendationsCount });
    saveToStorage({ ...get(), recommendationsCount });
  },

  setGroqApiKey: (groqApiKey) => {
    set({ groqApiKey });
    saveToStorage({ ...get(), groqApiKey });
  },

  setOpenaiKey: (openaiKey) => {
    set({ openaiKey });
    saveToStorage({ ...get(), openaiKey });
  },

  setAnthropicKey: (anthropicKey) => {
    set({ anthropicKey });
    saveToStorage({ ...get(), anthropicKey });
  },

  setDeepseekKey: (deepseekKey) => {
    set({ deepseekKey });
    saveToStorage({ ...get(), deepseekKey });
  },

  hydrate: () => {
    if (get().hydrated) return;
    const saved = normalizeSavedSettings(loadFromStorage());
    if (Object.keys(saved).length > 0) {
      set({ ...saved, hydrated: true });
      saveToStorage({ ...get(), ...saved });
      return;
    }
    set({ hydrated: true });
  },
}));
