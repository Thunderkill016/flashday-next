import { afterEach, describe, expect, it, vi } from 'vitest';

const upstashMocks = vi.hoisted(() => {
  const limit = vi.fn();
  const slidingWindow = vi.fn();
  const fromEnv = vi.fn();
  const RatelimitMock = vi.fn(function MockRatelimit() {
    return { limit };
  });

  Object.assign(RatelimitMock, { slidingWindow });

  return {
    limit,
    slidingWindow,
    fromEnv,
    RatelimitMock,
  };
});

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: upstashMocks.RatelimitMock,
}));

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: upstashMocks.fromEnv,
  },
}));

import {
  enforcePlatformRateLimit,
  enforceRouteRateLimit,
  hasUpstashRateLimitEnv,
  rateLimitResponse,
  resetPlatformRateLimitState,
} from './platform-provider';

const baseResolution = {
  providerId: 'groq' as const,
  modelId: 'llama-3.3-70b-versatile',
  fallbackApplied: false,
};

describe('platform provider helpers', () => {
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetPlatformRateLimitState();
    vi.clearAllMocks();
  });

  it('does not rate limit non-platform traffic', async () => {
    const result = await enforcePlatformRateLimit({
      headers: new Headers(),
      capability: 'chat',
      resolution: {
        ...baseResolution,
        credentialSource: 'stored',
      },
    });

    expect(result).toEqual({ ok: true });
  });

  it('rate limits shared platform Groq traffic after the per-minute threshold without Upstash', async () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9' });

    for (let i = 0; i < 30; i += 1) {
      await expect(
        enforcePlatformRateLimit({
          headers,
          capability: 'chat',
          resolution: {
            ...baseResolution,
            credentialSource: 'platform',
          },
        }),
      ).resolves.toEqual({ ok: true });
    }

    const blocked = await enforcePlatformRateLimit({
      headers,
      capability: 'chat',
      resolution: {
        ...baseResolution,
        credentialSource: 'platform',
      },
    });

    expect(blocked).toMatchObject({
      ok: false,
    });
  });

  it('uses Upstash when global rate limit env vars are configured', async () => {
    upstashMocks.fromEnv.mockReturnValue({ kind: 'redis' });
    upstashMocks.slidingWindow.mockReturnValue('sliding-window');
    upstashMocks.limit.mockResolvedValue({
      success: false,
      reset: Date.now() + 15_000,
    });

    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';

    expect(hasUpstashRateLimitEnv()).toBe(true);

    const result = await enforcePlatformRateLimit({
      headers: new Headers({ 'x-forwarded-for': '198.51.100.7' }),
      capability: 'chat',
      resolution: {
        ...baseResolution,
        credentialSource: 'platform',
      },
    });

    expect(upstashMocks.fromEnv).toHaveBeenCalledTimes(1);
    expect(upstashMocks.slidingWindow).toHaveBeenCalledWith(30, '60 s');
    expect(upstashMocks.limit).toHaveBeenCalledWith('198.51.100.7');
    expect(result).toMatchObject({
      ok: false,
    });
  });
});

describe('enforceRouteRateLimit', () => {
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetPlatformRateLimitState();
    vi.clearAllMocks();
  });

  it('allows requests under the bucket limit regardless of provider credentials', async () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.40' });

    for (let i = 0; i < 15; i += 1) {
      await expect(enforceRouteRateLimit({ headers, bucket: 'stt' })).resolves.toEqual({ ok: true });
    }
  });

  it('rejects requests over the bucket limit with a retry hint', async () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.41' });

    for (let i = 0; i < 15; i += 1) {
      await enforceRouteRateLimit({ headers, bucket: 'stt' });
    }

    const blocked = await enforceRouteRateLimit({ headers, bucket: 'stt' });
    expect(blocked).toMatchObject({ ok: false });
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('keeps separate counters per bucket and per client', async () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.42' });

    for (let i = 0; i < 15; i += 1) {
      await enforceRouteRateLimit({ headers, bucket: 'stt' });
    }

    await expect(enforceRouteRateLimit({ headers, bucket: 'stt' })).resolves.toMatchObject({ ok: false });
    await expect(enforceRouteRateLimit({ headers, bucket: 'tts' })).resolves.toEqual({ ok: true });
    await expect(
      enforceRouteRateLimit({ headers: new Headers({ 'x-forwarded-for': '198.51.100.42' }), bucket: 'stt' }),
    ).resolves.toEqual({ ok: true });
  });

  it('uses Upstash for route buckets when configured', async () => {
    upstashMocks.fromEnv.mockReturnValue({ kind: 'redis' });
    upstashMocks.slidingWindow.mockReturnValue('sliding-window');
    upstashMocks.limit.mockResolvedValue({ success: false, reset: Date.now() + 10_000 });

    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';

    const result = await enforceRouteRateLimit({
      headers: new Headers({ 'x-forwarded-for': '198.51.100.99' }),
      bucket: 'import',
    });

    expect(upstashMocks.slidingWindow).toHaveBeenCalledWith(12, '60 s');
    expect(upstashMocks.limit).toHaveBeenCalledWith('198.51.100.99');
    expect(result).toMatchObject({ ok: false });
  });

  it('builds a 429 response with Retry-After', async () => {
    const response = rateLimitResponse({ retryAfterSeconds: 42, message: 'slow down' });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    await expect(response.json()).resolves.toMatchObject({ code: 'rate_limited', error: 'slow down' });
  });
});
