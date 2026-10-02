import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { fetchWebPageContent } from './web-page';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

const lookupMock = lookup as unknown as Mock<
  (hostname: string, options?: { all?: boolean }) => Promise<LookupAddress[]>
>;

function textResponse(body: string) {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/plain' } });
}

// Simulates undici's default redirect handling: unless the caller opts into
// redirect:'manual', the stub follows Location headers itself — which is
// exactly how a hostname-only guard gets bypassed.
function autoFollowFetch(handler: (url: string) => Response | Promise<Response>) {
  const visit = async (input: RequestInfo | URL, init?: RequestInit, hops = 0): Promise<Response> => {
    const url = String(input);
    const response = await handler(url);
    if (init?.redirect === 'manual' || response.status < 300 || response.status >= 400) {
      return response;
    }
    const location = response.headers.get('location');
    if (!location || hops >= 10) return response;
    return visit(new URL(location, url), init, hops + 1);
  };
  return vi.fn(visit);
}

describe('fetchWebPageContent SSRF guard', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects a public hostname whose DNS resolves to a private address', async () => {
    lookupMock.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchWebPageContent('https://evil.example.com/notes.txt')).rejects.toThrow(
      'Private or local URLs are not allowed',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects when any round-robin DNS answer is private', async () => {
    lookupMock.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '192.168.1.10', family: 4 },
    ]);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchWebPageContent('https://mixed.example.com/notes.txt')).rejects.toThrow(
      'Private or local URLs are not allowed',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a hostname resolving to IPv6 loopback or link-local', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    lookupMock.mockResolvedValue([{ address: '::1', family: 6 }]);
    await expect(fetchWebPageContent('https://v6.example.com/notes.txt')).rejects.toThrow(
      'Private or local URLs are not allowed',
    );

    lookupMock.mockResolvedValue([{ address: 'fe80::a00:27ff:fe4e:66a1', family: 6 }]);
    await expect(fetchWebPageContent('https://v6.example.com/notes.txt')).rejects.toThrow(
      'Private or local URLs are not allowed',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects literal IPv4-mapped IPv6 loopback addresses', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchWebPageContent('http://[::ffff:127.0.0.1]/admin')).rejects.toThrow(
      'Private or local URLs are not allowed',
    );
    await expect(fetchWebPageContent('http://[::ffff:7f00:1]/admin')).rejects.toThrow(
      'Private or local URLs are not allowed',
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects CGNAT and unspecified literal addresses without DNS', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchWebPageContent('http://100.64.0.1/x.txt')).rejects.toThrow(
      'Private or local URLs are not allowed',
    );
    await expect(fetchWebPageContent('http://0.0.0.0/x.txt')).rejects.toThrow(
      'Private or local URLs are not allowed',
    );
    await expect(fetchWebPageContent('http://[::]/x.txt')).rejects.toThrow(
      'Private or local URLs are not allowed',
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('fails closed when DNS resolution errors', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'));
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchWebPageContent('https://unresolvable.example.com/notes.txt')).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects redirects to cloud metadata and never follows them', async () => {
    const fetcher = autoFollowFetch((url) => {
      if (url === 'http://169.254.169.254/latest/meta-data') return textResponse('SECRET-CREDENTIALS');
      return new Response('', { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } });
    });
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchWebPageContent('https://example.com/redirect.txt')).rejects.toThrow(
      'Private or local URLs are not allowed',
    );
    expect(fetcher).not.toHaveBeenCalledWith('http://169.254.169.254/latest/meta-data', expect.anything());
  });

  it('rejects a redirect chain that ends at a private host', async () => {
    const fetcher = autoFollowFetch((url) => {
      if (url.includes('169.254.169.254')) return textResponse('SECRET');
      if (url === 'https://example.com/a.txt')
        return new Response('', { status: 301, headers: { location: 'https://cdn.example.net/b.txt' } });
      if (url === 'https://cdn.example.net/b.txt')
        return new Response('', { status: 302, headers: { location: 'http://169.254.169.254/x' } });
      return textResponse('unreachable');
    });
    lookupMock.mockImplementation(async (hostname: string) =>
      hostname === 'cdn.example.net' ? [{ address: '8.8.8.8', family: 4 }] : [{ address: '93.184.216.34', family: 4 }],
    );
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchWebPageContent('https://example.com/a.txt')).rejects.toThrow(
      'Private or local URLs are not allowed',
    );
  });

  it('rejects redirects to non-http schemes', async () => {
    const fetcher = autoFollowFetch(
      () => new Response('', { status: 302, headers: { location: 'file:///etc/passwd' } }),
    );
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchWebPageContent('https://example.com/evil.txt')).rejects.toThrow();
  });

  it('rejects redirects to a host that resolves privately', async () => {
    const fetcher = autoFollowFetch((url) => {
      if (url === 'https://internal.example.org/data.txt') return textResponse('SECRET');
      return new Response('', { status: 302, headers: { location: 'https://internal.example.org/data.txt' } });
    });
    lookupMock.mockImplementation(async (hostname: string) =>
      hostname === 'internal.example.org'
        ? [{ address: '172.16.0.9', family: 4 }]
        : [{ address: '93.184.216.34', family: 4 }],
    );
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchWebPageContent('https://example.com/start.txt')).rejects.toThrow(
      'Private or local URLs are not allowed',
    );
  });

  it('still allows safe public URLs and follows safe redirects', async () => {
    const fetcher = autoFollowFetch((url) => {
      if (url === 'https://example.com/old.txt')
        return new Response('', { status: 301, headers: { location: '/new.txt' } });
      return textResponse('Redirected content');
    });
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchWebPageContent('https://example.com/old.txt')).resolves.toMatchObject({
      text: 'Redirected content',
    });
    expect(fetcher).toHaveBeenCalledWith('https://example.com/new.txt', expect.anything());
  });

  it('caps redirect chains instead of looping forever', async () => {
    const fetcher = autoFollowFetch(
      () => new Response('', { status: 302, headers: { location: 'https://example.com/loop.txt' } }),
    );
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchWebPageContent('https://example.com/loop.txt')).rejects.toThrow();
  });
});
