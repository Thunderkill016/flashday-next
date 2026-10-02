export interface OpenAITTSVoice {
  id: string;
  name: string;
  description: string;
  gender: 'neutral' | 'female' | 'male';
}

export const OPENAI_TTS_MODELS = ['gpt-4o-mini-tts', 'tts-1-hd', 'tts-1'] as const;

export const OPENAI_TTS_VOICES: OpenAITTSVoice[] = [
  { id: 'marin', name: 'Marin', description: 'Best quality OpenAI voice', gender: 'neutral' },
  { id: 'cedar', name: 'Cedar', description: 'Best quality OpenAI voice', gender: 'neutral' },
  { id: 'coral', name: 'Coral', description: 'Bright and expressive', gender: 'female' },
  { id: 'nova', name: 'Nova', description: 'Clear and energetic', gender: 'female' },
  { id: 'shimmer', name: 'Shimmer', description: 'Warm and polished', gender: 'female' },
  { id: 'alloy', name: 'Alloy', description: 'Balanced and neutral', gender: 'neutral' },
  { id: 'ash', name: 'Ash', description: 'Calm and natural', gender: 'neutral' },
  { id: 'ballad', name: 'Ballad', description: 'Soft narration style', gender: 'neutral' },
  { id: 'echo', name: 'Echo', description: 'Crisp male voice', gender: 'male' },
  { id: 'fable', name: 'Fable', description: 'Narrative voice', gender: 'neutral' },
  { id: 'onyx', name: 'Onyx', description: 'Deep male voice', gender: 'male' },
  { id: 'sage', name: 'Sage', description: 'Steady and conversational', gender: 'neutral' },
  { id: 'verse', name: 'Verse', description: 'Expressive narration', gender: 'neutral' },
];
