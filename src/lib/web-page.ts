import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const URL_REGEX = /https?:\/\/[^\s]+/i;
const HTTP_FALLBACK_HOSTS = new Set(['downloads.bbc.co.uk']);
const MAX_REDIRECT_HOPS = 5;

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

function isPrivateIpAddress(ip: string): boolean {
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

  const literal = normalized.startsWith('[') && normalized.endsWith(']') ? normalized.slice(1, -1) : normalized;
  return isIP(literal) !== 0 && isPrivateIpAddress(literal);
}

async function assertSafeRequestUrl(parsedUrl: URL): Promise<void> {
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsedUrl.protocol}`);
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const literal = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  if (isIP(literal)) {
    if (isPrivateIpAddress(literal)) {
      throw new Error('Private or local URLs are not allowed');
    }
    return;
  }

  if (isPrivateHostname(hostname)) {
    throw new Error('Private or local URLs are not allowed');
  }

  const addresses = await lookup(literal, { all: true }).catch((error: unknown) => {
    throw new Error(`Could not resolve host: ${literal}`, { cause: error });
  });

  if (!addresses.length || addresses.some(({ address }) => isPrivateIpAddress(address))) {
    throw new Error('Private or local URLs are not allowed');
  }
}

function stripTags(html: string): string {
  return (
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      // Add double newlines after block elements for paragraph separation
      .replace(/<\/(p|div|section|article|main|h1|h2|h3|h4|h5|h6|li|blockquote|pre)>/gi, '$&\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function normalizeWhitespace(text: string): string {
  // Split by lines, trim each line, but preserve empty lines for paragraph breaks
  const lines = text.split('\n').map((line) => line.replace(/\s+/g, ' ').trim());

  // Join lines and normalize multiple consecutive newlines to double newlines
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // Reduce 3+ newlines to 2
    .replace(/^\n+/, '') // Remove leading newlines
    .replace(/\n+$/, '') // Remove trailing newlines
    .trim();
}

function pickContentContainer(html: string): string {
  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
  if (articleMatch) return articleMatch[0];

  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
  if (mainMatch) return mainMatch[0];

  const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i);
  if (bodyMatch) return bodyMatch[0];

  return html;
}

function extractTitle(html: string, fallbackUrl: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    const title = normalizeWhitespace(decodeHtmlEntities(stripTags(titleMatch[1])));
    if (title) return title;
  }

  try {
    const url = new URL(fallbackUrl);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return 'Imported article';
  }
}

function fallbackTitleFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const lastSegment = decodeURIComponent(parsedUrl.pathname.split('/').filter(Boolean).pop() || '');
    const stem = lastSegment.replace(/\.[^.]+$/, '').trim();
    if (stem) return stem;
    return parsedUrl.hostname.replace(/^www\./, '');
  } catch {
    return 'Imported article';
  }
}

function inferRemoteContentKind(url: string, contentType: string): 'html' | 'text' | 'pdf' | 'unsupported' {
  const normalizedType = contentType.toLowerCase();

  if (normalizedType.includes('application/pdf')) {
    return 'pdf';
  }

  if (normalizedType.includes('text/html') || normalizedType.includes('application/xhtml+xml')) {
    return 'html';
  }

  if (normalizedType.includes('text/plain')) {
    return 'text';
  }

  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.pdf')) {
    return 'pdf';
  }
  if (pathname.endsWith('.txt') || pathname.endsWith('.text') || pathname.endsWith('.md')) {
    return 'text';
  }
  if (pathname.endsWith('.html') || pathname.endsWith('.htm')) {
    return 'html';
  }

  return 'unsupported';
}

function canRetryOverHttp(parsedUrl: URL, error: unknown): boolean {
  if (parsedUrl.protocol !== 'https:' || !HTTP_FALLBACK_HOSTS.has(parsedUrl.hostname)) {
    return false;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /fetch failed|ECONNRESET|TLS|secure TLS connection/i.test(error.message);
}

async function requestWithRetries(parsedUrl: URL, requestInit: RequestInit, deadline: number): Promise<Response> {
  let requestUrl = parsedUrl.toString();
  for (let attempt = 0; attempt < 3; attempt++) {
    let delay = 1000 * 2 ** attempt;
    let response: Response;
    try {
      response = await fetch(requestUrl, {
        ...requestInit,
        redirect: 'manual',
        signal: AbortSignal.timeout(Math.max(1, Math.min(15_000, deadline - Date.now()))),
      });
    } catch (error) {
      if (!(error instanceof Error) || error.name === 'AbortError') throw error;
      if (!/fetch failed|network|ECONN|ENOTFOUND|TLS|timeout|timed out/i.test(`${error.name} ${error.message}`))
        throw error;
      if (attempt === 2 || Date.now() + delay + 1000 > deadline) {
        throw new Error('URL automatic retries exhausted', { cause: error });
      }
      if (canRetryOverHttp(parsedUrl, error)) {
        const fallbackUrl = new URL(parsedUrl);
        fallbackUrl.protocol = 'http:';
        requestUrl = fallbackUrl.toString();
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    if (![408, 429, 500, 502, 503, 504].includes(response.status)) return response;
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      const wait = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
      if (Number.isFinite(wait)) delay = Math.max(delay, wait);
    }
    // Never retry sooner than Retry-After. Long waits are handed back to the user.
    if (attempt === 2 || Date.now() + delay + 1000 > deadline) {
      await response.body?.cancel();
      throw new Error(`URL automatic retries exhausted: Failed to fetch page (${response.status})`);
    }
    await response.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error('URL automatic retries exhausted');
}

async function fetchRemoteResponse(url: string): Promise<Response> {
  const deadline = Date.now() + 24_000;
  const requestInit: RequestInit = {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
  };

  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const parsedUrl = new URL(currentUrl);
    // Every hop — initial URL and each redirect target — is revalidated
    // against protocol, literal-IP, hostname, and DNS policy before fetching.
    await assertSafeRequestUrl(parsedUrl);

    const response = await requestWithRetries(parsedUrl, requestInit, deadline);
    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) return response;

    currentUrl = new URL(location, currentUrl).toString();
  }
  throw new Error('Too many redirects while fetching page');
}

async function extractPdfFromBuffer(buffer: Buffer) {
  const extractText = await import('./extract-text');
  return extractText.extractPdf(buffer);
}

export function extractFirstUrl(input: string): string | null {
  const match = input.match(URL_REGEX);
  return match?.[0] ?? null;
}

export function removeUrlFromPrompt(input: string, url: string): string {
  return normalizeWhitespace(input.replace(url, ' '));
}

export function htmlToText(html: string): { title: string; text: string } {
  const title = extractTitle(html, '');
  const container = pickContentContainer(html);
  const text = normalizeWhitespace(decodeHtmlEntities(stripTags(container)));
  return { title, text };
}

export async function fetchWebPageContent(url: string): Promise<{ title: string; text: string; url: string }> {
  const parsedUrl = new URL(url);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsedUrl.protocol}`);
  }

  const response = await fetchRemoteResponse(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch page (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || '';
  const contentKind = inferRemoteContentKind(url, contentType);
  if (contentKind === 'unsupported') {
    throw new Error(`Unsupported page type: ${contentType || 'unknown'}`);
  }

  if (contentKind === 'pdf') {
    const raw = Buffer.from(await response.arrayBuffer());
    if (!raw.byteLength) {
      throw new Error('Fetched PDF is empty');
    }

    const extracted = await extractPdfFromBuffer(raw);
    const text = normalizeWhitespace(extracted.text);
    if (!text) {
      throw new Error('Could not extract readable text from the PDF');
    }

    return {
      title: extracted.metadata.title || fallbackTitleFromUrl(url),
      text,
      url,
    };
  }

  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error('Fetched page is empty');
  }

  if (contentKind === 'text') {
    return {
      title: fallbackTitleFromUrl(url),
      text: normalizeWhitespace(raw),
      url,
    };
  }

  const extracted = htmlToText(raw);
  if (!extracted.text) {
    throw new Error('Could not extract readable text from the page');
  }

  return {
    title: extractTitle(raw, url),
    text: extracted.text,
    url,
  };
}
