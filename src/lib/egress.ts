import type { LookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';
import { Agent, type Dispatcher } from 'undici';

/**
 * Server-side egress policy.
 *
 * Two explicit classes:
 * - Class 1 (hosted public fetch): http/https only, every DNS answer validated,
 *   and the actual connection is pinned to the validated addresses via a
 *   dedicated undici Agent whose `lookup` serves the pinned list — the socket
 *   never performs a second uncontrolled DNS resolution (no rebinding TOCTOU).
 * - Class 2 (local/self-host provider): private/LAN destinations are rejected
 *   on hosted deployments unless the server operator explicitly opted in via
 *   FLASHDAY_SELF_HOST=1 or listed the exact origin in FLASHDAY_LOCAL_PROVIDERS
 *   (comma-separated origins, e.g. "http://localhost:11434,http://192.168.1.5:8880").
 *   Callers may choose the model/path within the permitted provider contract,
 *   never an arbitrary host.
 */

export class EgressPolicyError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'EgressPolicyError';
  }
}

const MAX_FOLLOWED_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const SELF_HOST_ENV = 'FLASHDAY_SELF_HOST';
const LOCAL_PROVIDERS_ENV = 'FLASHDAY_LOCAL_PROVIDERS';

function isPrivateIpv4Address(ip: string): boolean {
  const octets = ip.split('.').map(Number);
  const [a, b, c] = octets;
  return (
    a === 0 || // "this network"
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64.0.0/10
    (a === 169 && b === 254) || // link-local, covers cloud metadata endpoints
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 192 && b === 0 && c === 2) || // documentation TEST-NET-1
    (a === 198 && (b === 18 || b === 19)) || // benchmark ranges
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast (224/4) and reserved (240/4)
  );
}

function parseIpv6Address(ip: string): Uint8Array | null {
  const normalized = ip.toLowerCase();
  const zoneIndex = normalized.indexOf('%');
  const address = zoneIndex >= 0 ? normalized.slice(0, zoneIndex) : normalized;

  const doubleColon = address.indexOf('::');
  if (doubleColon !== address.lastIndexOf('::')) return null;

  const parseSide = (side: string): number[] | null => {
    if (!side) return [];
    const hextets: number[] = [];
    const parts = side.split(':');
    const last = parts[parts.length - 1];
    const hasEmbeddedIpv4 = last.includes('.');
    const end = hasEmbeddedIpv4 ? parts.length - 1 : parts.length;
    for (let i = 0; i < end; i++) {
      if (!/^[0-9a-f]{1,4}$/.test(parts[i])) return null;
      hextets.push(parseInt(parts[i], 16));
    }
    if (hasEmbeddedIpv4) {
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(last)) return null;
      const octets = last.split('.').map(Number);
      if (octets.some((o) => o > 255)) return null;
      hextets.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
    }
    return hextets;
  };

  let head: number[];
  let tail: number[] = [];
  if (doubleColon >= 0) {
    const headParsed = parseSide(address.slice(0, doubleColon));
    const tailParsed = parseSide(address.slice(doubleColon + 2));
    if (headParsed === null || tailParsed === null) return null;
    head = headParsed;
    tail = tailParsed;
  } else {
    const parsed = parseSide(address);
    if (parsed === null) return null;
    head = parsed;
  }

  const total = head.length + tail.length;
  if (total > 8 || (doubleColon < 0 && total !== 8)) return null;
  const hextets = [...head, ...new Array(8 - total).fill(0), ...tail];

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    bytes[i * 2] = (hextets[i] >> 8) & 0xff;
    bytes[i * 2 + 1] = hextets[i] & 0xff;
  }
  return bytes;
}

function ipv4FromBytes(bytes: Uint8Array, offset: number): string {
  return `${bytes[offset]}.${bytes[offset + 1]}.${bytes[offset + 2]}.${bytes[offset + 3]}`;
}

export function isPrivateIpAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    return isPrivateIpv4Address(ip);
  }

  const bytes = parseIpv6Address(ip);
  if (!bytes) return false;

  const isZero = (start: number, end: number) => bytes.slice(start, end).every((b) => b === 0);

  if (isZero(0, 16)) return true; // :: unspecified
  if (isZero(0, 15) && bytes[15] === 1) return true; // ::1 loopback
  if (bytes[0] === 0xff) return true; // multicast ff00::/8
  if (bytes[0] === 0xfc || bytes[0] === 0xfd) return true; // unique-local fc00::/7
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true; // link-local fe80::/10
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return true; // site-local fec0::/10

  // IPv4-mapped ::ffff:a.b.c.d — unwrap and apply IPv4 policy
  if (isZero(0, 10) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return isPrivateIpv4Address(ipv4FromBytes(bytes, 12));
  }

  // NAT64 well-known prefix 64:ff9b::/96 — embedded IPv4 in last 4 bytes
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && isZero(4, 12)) {
    return isPrivateIpv4Address(ipv4FromBytes(bytes, 12));
  }

  // 6to4 2002::/16 — embedded IPv4 in bytes 2-5
  if (bytes[0] === 0x20 && bytes[1] === 0x02) {
    return isPrivateIpv4Address(ipv4FromBytes(bytes, 2));
  }

  return false;
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
    return true;
  }

  if (normalized.endsWith('.local') || normalized.endsWith('.internal')) {
    return true;
  }

  return false;
}

function isSelfHostEnabled(): boolean {
  return ['1', 'true', 'yes'].includes((process.env[SELF_HOST_ENV] ?? '').trim().toLowerCase());
}

function getAllowedLocalOrigins(): Set<string> {
  const raw = process.env[LOCAL_PROVIDERS_ENV] ?? '';
  const origins = new Set<string>();
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    try {
      origins.add(new URL(trimmed).origin);
    } catch {
      // Ignore malformed allowlist entries — they simply match nothing.
    }
  }
  return origins;
}

function unwrapIpLiteral(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

type EgressTarget = { mode: 'local'; url: URL } | { mode: 'public'; url: URL; addresses: LookupAddress[] };

function localTargetOrThrow(url: URL): EgressTarget {
  if (isSelfHostEnabled() || getAllowedLocalOrigins().has(url.origin)) {
    return { mode: 'local', url };
  }
  throw new EgressPolicyError(
    `Private or local URLs are not allowed (origin ${url.origin}). ` +
      `Self-host operators can opt in via ${SELF_HOST_ENV}=1 or ${LOCAL_PROVIDERS_ENV}.`,
  );
}

async function resolveEgressTarget(url: URL): Promise<EgressTarget> {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new EgressPolicyError(`Unsupported URL protocol: ${url.protocol}`);
  }

  const hostname = url.hostname.toLowerCase();
  const literal = unwrapIpLiteral(hostname);

  if (isIP(literal)) {
    if (isPrivateIpAddress(literal)) {
      return localTargetOrThrow(url);
    }
    // Public IP literal: no DNS involved; pin to the literal itself.
    return { mode: 'public', url, addresses: [{ address: literal, family: isIP(literal) }] };
  }

  if (isPrivateHostname(hostname)) {
    return localTargetOrThrow(url);
  }

  const addresses = await lookup(literal, { all: true }).catch((error: unknown) => {
    throw new EgressPolicyError(`Could not resolve host: ${literal}`, { cause: error });
  });

  if (!addresses.length || addresses.some(({ address }) => isPrivateIpAddress(address))) {
    return localTargetOrThrow(url);
  }

  return { mode: 'public', url, addresses };
}

/**
 * dns.lookup-compatible callback that always serves the validated addresses,
 * so the socket opened by undici connects to exactly what validation approved —
 * a second system DNS resolution can never redirect the connection elsewhere.
 */
export function createPinnedLookup(addresses: LookupAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    if (options?.all) {
      callback(
        null,
        addresses.map(({ address, family }) => ({ address, family })),
      );
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  };
}

export function createPinnedDispatcher(addresses: LookupAddress[]): Dispatcher {
  return new Agent({ connect: { lookup: createPinnedLookup(addresses) } });
}

function headersWithoutCredentials(headers: HeadersInit | undefined): HeadersInit | undefined {
  if (!headers) return headers;
  const next = new Headers(headers);
  next.delete('authorization');
  next.delete('x-api-key');
  next.delete('cookie');
  return next;
}

function redirectableInit(init: RequestInit): RequestInit {
  return { ...init, redirect: 'manual' };
}

function canResendBody(body: RequestInit['body']): boolean {
  if (body == null) return true;
  if (typeof body === 'string') return true;
  return (
    body instanceof URLSearchParams ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  );
}

async function fetchOnce(target: EgressTarget, init: RequestInit): Promise<Response> {
  if (target.mode === 'local') {
    // Operator-trusted destination — plain fetch, redirects still surfaced to
    // the caller/loop so each hop is revalidated by this module.
    return fetch(target.url.href, init);
  }

  const dispatcher = createPinnedDispatcher(target.addresses);
  try {
    return await fetch(target.url.href, { ...init, dispatcher } as RequestInit);
  } finally {
    // Drains once the in-flight request finishes; keeps sockets from leaking.
    void dispatcher.close().catch(() => {});
  }
}

/**
 * fetch() with the FlashDay server egress policy applied: protocol and
 * destination validation, DNS resolution bound to the actual connection, and
 * validated redirect handling. `init.redirect === 'manual'` performs a single
 * hop and returns the raw response (callers implement their own hop loop);
 * otherwise redirects are followed internally with per-hop revalidation.
 */
export async function fetchEgress(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const follow = init.redirect !== 'manual';
  let url = input instanceof URL ? input : new URL(input);
  let requestInit = redirectableInit(init);

  for (let hop = 0; hop <= MAX_FOLLOWED_REDIRECTS; hop++) {
    const target = await resolveEgressTarget(url);
    const response = await fetchOnce(target, requestInit);

    if (!follow || !REDIRECT_STATUSES.has(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) return response;

    await response.body?.cancel();
    const nextUrl = new URL(location, url);
    const method = (requestInit.method ?? 'GET').toUpperCase();

    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === 'POST')) {
      requestInit = {
        ...requestInit,
        method: 'GET',
        body: undefined,
        headers: headersWithoutCredentials(requestInit.headers),
      };
    } else {
      if (!canResendBody(requestInit.body)) return response;
      if (nextUrl.origin !== url.origin) {
        requestInit = { ...requestInit, headers: headersWithoutCredentials(requestInit.headers) };
      }
    }

    url = nextUrl;
  }

  throw new EgressPolicyError('Too many redirects while fetching');
}

/**
 * fetch-compatible adapter for APIs that take a `fetch` option
 * (Vercel AI SDK provider factories, etc.).
 */
export const egressFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (input instanceof Request) {
    const merged: RequestInit = {
      method: input.method,
      headers: input.headers,
      signal: input.signal,
      redirect: init?.redirect ?? input.redirect,
      ...init,
    };
    if (input.body && init?.body == null) {
      merged.body = input.body;
      // undici requires duplex for streaming request bodies
      (merged as RequestInit & { duplex?: 'half' }).duplex = 'half';
    }
    return fetchEgress(input.url, merged);
  }
  return fetchEgress(typeof input === 'string' ? input : input.href, init ?? {});
};

/**
 * Preflight validation for egress performed by a subprocess (yt-dlp), where a
 * pinned connection cannot be injected. Rejects private/local/non-http targets
 * up front; the subprocess performs its own resolution afterward (documented
 * residual — hostname answers could theoretically change between check and
 * subprocess connect).
 */
export async function assertPublicEgressUrl(rawUrl: string): Promise<void> {
  const target = await resolveEgressTarget(new URL(rawUrl));
  if (target.mode === 'local') return;
}
