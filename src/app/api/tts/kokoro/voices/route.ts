import { NextRequest, NextResponse } from 'next/server';
import { EgressPolicyError } from '@/lib/egress';
import { listKokoroVoices } from '@/lib/kokoro';
import { enforceRouteRateLimit, rateLimitResponse } from '@/lib/platform-provider';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceRouteRateLimit({ headers: req.headers, bucket: 'tts' });
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const { serverUrl, apiKey }: { serverUrl?: string; apiKey?: string } = await req.json();

  if (!serverUrl?.trim()) {
    return NextResponse.json({ error: 'Kokoro server URL is required.' }, { status: 400 });
  }

  try {
    const voices = await listKokoroVoices(serverUrl, apiKey || undefined);
    return NextResponse.json({ voices });
  } catch (error) {
    if (error instanceof EgressPolicyError) {
      return NextResponse.json({ error: error.message, code: 'egress_blocked' }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to load Kokoro voices.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
