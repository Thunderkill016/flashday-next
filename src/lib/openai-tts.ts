import { fetchEgress } from './egress';

export interface OpenAISpeechInput {
  apiKey: string;
  baseUrl?: string;
  text: string;
  model?: string;
  voice?: string;
  speed?: number;
  instructions?: string;
}

function normalizeBaseUrl(baseUrl = 'https://api.openai.com/v1'): string {
  return baseUrl.trim().replace(/\/+$/, '') || 'https://api.openai.com/v1';
}

function formatOpenAIError(status: number, fallback: string, body: unknown): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error?: { message?: string } | string }).error;
    if (typeof error === 'string') return `${fallback} (${status}): ${error}`;
    if (error?.message) return `${fallback} (${status}): ${error.message}`;
  }
  return `${fallback} (${status}).`;
}

export async function synthesizeOpenAISpeech({
  apiKey,
  baseUrl,
  text,
  model = 'gpt-4o-mini-tts',
  voice = 'marin',
  speed = 1,
  instructions,
}: OpenAISpeechInput): Promise<{ audioBuffer: Buffer; contentType: string }> {
  const response = await fetchEgress(`${normalizeBaseUrl(baseUrl)}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      response_format: 'mp3',
      speed: Math.min(4, Math.max(0.25, speed)),
      ...(instructions?.trim() && model.startsWith('gpt-4o') ? { instructions: instructions.trim() } : {}),
    }),
  });

  const contentType = response.headers.get('Content-Type') ?? 'audio/mpeg';

  if (!response.ok) {
    const body = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
    throw new Error(formatOpenAIError(response.status, 'OpenAI TTS synthesis failed', body));
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  if (audioBuffer.length === 0) {
    throw new Error('OpenAI TTS synthesis returned no audio.');
  }

  return {
    audioBuffer,
    contentType: contentType.includes('audio/') ? contentType : 'audio/mpeg',
  };
}
