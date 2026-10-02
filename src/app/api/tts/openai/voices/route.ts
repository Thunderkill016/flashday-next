import { NextRequest, NextResponse } from 'next/server';
import { OPENAI_TTS_MODELS, OPENAI_TTS_VOICES } from '@/lib/openai-tts-presets';
import { enforceRouteRateLimit, rateLimitResponse } from '@/lib/platform-provider';

export async function GET(req: NextRequest) {
  const rateLimit = await enforceRouteRateLimit({ headers: req.headers, bucket: 'tts' });
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  return NextResponse.json({
    voices: OPENAI_TTS_VOICES,
    models: OPENAI_TTS_MODELS,
  });
}
