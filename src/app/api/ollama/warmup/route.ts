import { NextRequest, NextResponse } from 'next/server';
import { EgressPolicyError, fetchEgress } from '@/lib/egress';
import { enforceRouteRateLimit, rateLimitResponse } from '@/lib/platform-provider';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceRouteRateLimit({ headers: req.headers, bucket: 'generate' });
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const { modelId, baseUrl, apiPath } = await req.json();

    if (!modelId || !baseUrl) {
      return NextResponse.json({ error: 'Missing modelId or baseUrl' }, { status: 400 });
    }

    // Build full URL: baseUrl (origin) + apiPath (full path)
    const fullUrl = `${baseUrl.replace(/\/$/, '')}${apiPath || '/v1/chat/completions'}`;

    const startTime = Date.now();

    const res = await fetchEgress(fullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'warmup' }],
        max_tokens: 1,
      }),
    });

    const elapsed = Date.now() - startTime;

    if (res.ok) {
      return NextResponse.json({ status: 'ready', time: elapsed });
    } else {
      const error = await res.text();
      return NextResponse.json({ status: 'error', error }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof EgressPolicyError) {
      return NextResponse.json({ status: 'error', error: error.message, code: 'egress_blocked' }, { status: 403 });
    }
    console.error('Ollama warmup error:', error);
    const msg = error instanceof Error ? error.message : 'Warmup failed';
    return NextResponse.json({ status: 'error', error: msg }, { status: 500 });
  }
}
