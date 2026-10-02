import { NextRequest } from 'next/server';
import { EgressPolicyError } from '@/lib/egress';
import { synthesizeKokoroSpeech } from '@/lib/kokoro';
import { enforceRouteRateLimit, rateLimitResponse } from '@/lib/platform-provider';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceRouteRateLimit({ headers: req.headers, bucket: 'tts' });
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const {
    serverUrl,
    apiKey,
    text,
    voice,
    speed,
  }: {
    serverUrl?: string;
    apiKey?: string;
    text?: string;
    voice?: string;
    speed?: number;
  } = await req.json();

  if (!serverUrl?.trim()) {
    return Response.json({ error: 'Kokoro server URL is required.' }, { status: 400 });
  }

  if (!text?.trim()) {
    return Response.json({ error: 'Text is required.' }, { status: 400 });
  }

  if (!voice) {
    return Response.json({ error: 'A Kokoro voice is required.' }, { status: 400 });
  }

  try {
    const { audioBuffer, contentType } = await synthesizeKokoroSpeech({
      serverUrl,
      apiKey: apiKey || undefined,
      text,
      voice,
      speed,
    });

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof EgressPolicyError) {
      return Response.json({ error: error.message, code: 'egress_blocked' }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Kokoro speech synthesis failed.';
    return Response.json({ error: message }, { status: 500 });
  }
}
