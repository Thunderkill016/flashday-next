import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { ProviderCapability } from './provider-capabilities';
import type { CredentialSource, ProviderResolution } from './provider-resolver';
import type { ProviderId } from './providers';

const PLATFORM_GROQ_ENV_KEY = 'GROQ_API_KEY';
const UPSTASH_REDIS_URL_ENV_KEY = 'UPSTASH_REDIS_REST_URL';
const UPSTASH_REDIS_TOKEN_ENV_KEY = 'UPSTASH_REDIS_REST_TOKEN';
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_WINDOW = '60 s';
const RATE_LIMIT_PREFIX = 'echotype:platform-groq';
const ROUTE_RATE_LIMIT_PREFIX = 'echotype:route';
const RATE_LIMIT_MESSAGE =
  'Platform Groq capacity is temporarily busy. Please try again shortly or add your own API key in Settings.';
const ROUTE_RATE_LIMIT_MESSAGE = 'Too many requests. Please try again shortly.';

const PLATFORM_RATE_LIMITS: Record<ProviderCapability, number> = {
  chat: 30,
  generate: 12,
  classify: 30,
  translateText: 30,
  transcribe: 4,
  translateAudio: 4,
  evaluate: 12,
};

/**
 * Per-IP limits for expensive or abuse-prone API routes, applied regardless of
 * whose provider credential funds the call. Requests per 60s window.
 */
export type RouteRateLimitBucket = 'stt' | 'tts' | 'translate-free' | 'import' | 'generate' | 'download' | 'metadata';

const ROUTE_RATE_LIMITS: Record<RouteRateLimitBucket, number> = {
  stt: 15,
  tts: 40,
  'translate-free': 60,
  import: 12,
  generate: 12,
  download: 30,
  metadata: 60,
};

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface PlatformRateLimitState {
  entries: Map<string, RateLimitEntry>;
}

interface UpstashRateLimitBundle {
  redis: Redis;
  limiters: Record<string, Ratelimit>;
}

declare global {
  var __echotypePlatformRateLimitState: PlatformRateLimitState | undefined;
  var __echotypeUpstashRateLimitBundle: UpstashRateLimitBundle | undefined;
}

function getRateLimitState(): PlatformRateLimitState {
  globalThis.__echotypePlatformRateLimitState ??= {
    entries: new Map(),
  };
  return globalThis.__echotypePlatformRateLimitState;
}

function getRateLimitKey(clientAddress: string, key: string) {
  return `${clientAddress}:${key}`;
}

export function resetPlatformRateLimitState() {
  globalThis.__echotypePlatformRateLimitState = {
    entries: new Map(),
  };
  globalThis.__echotypeUpstashRateLimitBundle = undefined;
}

export function getPlatformGroqApiKey(): string {
  return process.env[PLATFORM_GROQ_ENV_KEY] || '';
}

export function hasPlatformProviderKey(providerId: ProviderId): boolean {
  return providerId === 'groq' && Boolean(getPlatformGroqApiKey());
}

export function hasUpstashRateLimitEnv(): boolean {
  return Boolean(process.env[UPSTASH_REDIS_URL_ENV_KEY] && process.env[UPSTASH_REDIS_TOKEN_ENV_KEY]);
}

function getUpstashBundle(): UpstashRateLimitBundle | null {
  if (!hasUpstashRateLimitEnv()) {
    return null;
  }

  globalThis.__echotypeUpstashRateLimitBundle ??= {
    redis: Redis.fromEnv(),
    limiters: {},
  };

  return globalThis.__echotypeUpstashRateLimitBundle;
}

function getUpstashLimiter(key: string, limit: number, prefix: string): Ratelimit | null {
  const bundle = getUpstashBundle();
  if (!bundle) {
    return null;
  }

  bundle.limiters[key] ??= new Ratelimit({
    redis: bundle.redis,
    limiter: Ratelimit.slidingWindow(limit, DEFAULT_WINDOW),
    prefix,
    analytics: false,
  });

  return bundle.limiters[key] ?? null;
}

export function getClientAddress(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }

  return headers.get('x-real-ip') || headers.get('cf-connecting-ip') || 'unknown';
}

export function isUsingPlatformProvider(providerId: ProviderId, credentialSource: CredentialSource): boolean {
  return providerId === 'groq' && credentialSource === 'platform';
}

function enforceInMemoryRateLimit(headers: Headers, key: string, limit: number, message: string) {
  const now = Date.now();
  const resetAt = now + DEFAULT_WINDOW_MS;
  const clientAddress = getClientAddress(headers);
  const state = getRateLimitState();
  const entryKey = getRateLimitKey(clientAddress, key);
  const current = state.entries.get(entryKey);

  if (!current || current.resetAt <= now) {
    state.entries.set(entryKey, { count: 1, resetAt });
    return { ok: true as const };
  }

  if (current.count >= limit) {
    return {
      ok: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      message,
    };
  }

  current.count += 1;
  state.entries.set(entryKey, current);
  return { ok: true as const };
}

async function enforceUpstashRateLimit(headers: Headers, key: string, limit: number, prefix: string, message: string) {
  const limiter = getUpstashLimiter(key, limit, prefix);
  if (!limiter) {
    return null;
  }

  const clientAddress = getClientAddress(headers);
  const result = await limiter.limit(clientAddress);

  if (result.success) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
    message,
  };
}

type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number; message: string };

async function enforceSharedRateLimit({
  headers,
  key,
  limit,
  prefix,
  message,
}: {
  headers: Headers;
  key: string;
  limit: number;
  prefix: string;
  message: string;
}): Promise<RateLimitResult> {
  if (!hasUpstashRateLimitEnv()) {
    return enforceInMemoryRateLimit(headers, key, limit, message);
  }

  try {
    return (
      (await enforceUpstashRateLimit(headers, key, limit, prefix, message)) ??
      enforceInMemoryRateLimit(headers, key, limit, message)
    );
  } catch (error) {
    console.warn('Rate limit backend failed, falling back to in-memory limiter.', error);
    return enforceInMemoryRateLimit(headers, key, limit, message);
  }
}

export async function enforcePlatformRateLimit({
  headers,
  capability,
  resolution,
}: {
  headers: Headers;
  capability: ProviderCapability;
  resolution: ProviderResolution;
}): Promise<RateLimitResult> {
  if (!isUsingPlatformProvider(resolution.providerId, resolution.credentialSource)) {
    return { ok: true };
  }

  return enforceSharedRateLimit({
    headers,
    key: `platform:${capability}`,
    limit: PLATFORM_RATE_LIMITS[capability],
    prefix: `${RATE_LIMIT_PREFIX}:${capability}`,
    message: RATE_LIMIT_MESSAGE,
  });
}

export async function enforceRouteRateLimit({
  headers,
  bucket,
}: {
  headers: Headers;
  bucket: RouteRateLimitBucket;
}): Promise<RateLimitResult> {
  return enforceSharedRateLimit({
    headers,
    key: `route:${bucket}`,
    limit: ROUTE_RATE_LIMITS[bucket],
    prefix: `${ROUTE_RATE_LIMIT_PREFIX}:${bucket}`,
    message: ROUTE_RATE_LIMIT_MESSAGE,
  });
}

export function rateLimitResponse(result: { retryAfterSeconds: number; message: string }): Response {
  return new Response(JSON.stringify({ error: result.message, code: 'rate_limited' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(result.retryAfterSeconds),
    },
  });
}
