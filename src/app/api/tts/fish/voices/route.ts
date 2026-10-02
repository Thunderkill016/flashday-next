import { NextRequest, NextResponse } from 'next/server';
import { listFishVoices } from '@/lib/fish-audio';
import { enforceRouteRateLimit, rateLimitResponse } from '@/lib/platform-provider';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceRouteRateLimit({ headers: req.headers, bucket: 'tts' });
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const { apiKey, query }: { apiKey?: string; query?: string } = await req.json();

  if (!apiKey) {
    return NextResponse.json({ error: 'Fish Audio API key is required.' }, { status: 400 });
  }

  try {
    const voices = await listFishVoices(apiKey, query);
    return NextResponse.json({ voices });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Fish Audio voices.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
