import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';

const agentConstructs: { connect?: { lookup?: unknown } }[] = [];

vi.mock('undici', () => ({
  Agent: vi.fn(function MockAgent(this: { opts: unknown }, opts: { connect?: { lookup?: unknown } }) {
    this.opts = opts;
    agentConstructs.push(opts);
    return {
      close: vi.fn(async () => {}),
    };
  }),
}));

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

const lookupMock = lookup as unknown as Mock<
  (hostname: string, options?: { all?: boolean }) => Promise<LookupAddress[]>
>;

const { fetchEgress, createPinnedLookup, EgressPolicyError } = await import('./egress');

function textResponse(body: string) {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/plain' } });
}

function lastPinnedLookup() {
  const opts = agentConstructs.at(-1);
  if (!opts?.connect?.lookup) throw new Error('no pinned lookup captured');
  return opts.connect.lookup as (
    hostname: string,
    options: { all?: boolean },
    callback: (err: null | Error, address?: unknown, family?: number) => void,
  ) => void;
}

function lookupAll(fn: ReturnType<typeof lastPinnedLookup>, hostname: string): Promise<LookupAddress[]> {
  return new Promise((resolve, reject) =>
    fn(hostname, { all: true }, (err, addresses) => (err ? reject(err) : resolve(addresses as LookupAddress[]))),
  );
}

describe('fetchEgress', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    agentConstructs.length = 0;
    vi.stubEnv('FLASHDAY_SELF_HOST', '');
    vi.stubEnv('FLASHDAY_LOCAL_PROVIDERS', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('pins the connection to the DNS-validated addresses — rebinding after validation cannot redirect the socket', async () => {
    // Validation answer is public; if the socket performed a second system
    // resolution it could observe a private answer instead.
    lookupMock
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

    const fetcher = vi.fn(async () => textResponse('ok'));
    vi.stubGlobal('fetch', fetcher);

    const res = await fetchEgress('https://attacker.example.com/x');
    expect(res.status).toBe(200);

    // Exactly one real DNS resolution — the validating one. The connection's
    // lookup is the pinned callback, never the system resolver.
    expect(lookupMock).toHaveBeenCalledTimes(1);

    const connectLookup = lastPinnedLookup();
    const used = await lookupAll(connectLookup, 'attacker.example.com');
    expect(used).toEqual([{ address: '93.184.216.34', family: 4 }]);

    // fetch was invoked with a dispatcher — the socket cannot re-resolve freely.
    expect(fetcher).toHaveBeenCalledWith(
      'https://attacker.example.com/x',
      expect.objectContaining({ redirect: 'manual', dispatcher: expect.anything() }),
    );
  });

  it('pinned lookup answers every undici query shape with only validated addresses', () => {
    const pinned = createPinnedLookup([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ]);

    const single = vi.fn();
    pinned('anything.example', {}, single);
    expect(single).toHaveBeenCalledWith(null, '93.184.216.34', 4);

    const all = vi.fn();
    pinned('anything.example', { all: true }, all);
    expect(all).toHaveBeenCalledWith(null, [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ]);
  });

  it('rejects private literal IPs without touching DNS or fetch', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    for (const url of [
      'http://127.0.0.1:11434/api/tags',
      'http://169.254.169.254/latest/meta-data',
      'http://10.0.0.4/internal',
      'http://192.168.1.20:8880/v1',
      'http://100.64.0.1/cgnat',
      'http://[::1]/v6',
      'http://[::ffff:127.0.0.1]/mapped',
      'http://[64:ff9b::a9fe:a9fe]/nat64',
      'http://[2002:a9fe:a9fe::]/6to4',
    ]) {
      await expect(fetchEgress(url)).rejects.toThrow(EgressPolicyError);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects localhost-style hostnames without DNS', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    for (const url of ['http://localhost:1234/v1/models', 'http://printer.internal/', 'http://nas.local:8080/']) {
      await expect(fetchEgress(url)).rejects.toThrow(EgressPolicyError);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects a hostname whose DNS answer is private and never fetches', async () => {
    lookupMock.mockResolvedValue([{ address: '172.16.0.9', family: 4 }]);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchEgress('https://internal.example.org/data')).rejects.toThrow(EgressPolicyError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fails closed when DNS resolution errors', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'));
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchEgress('https://unresolvable.example.com/')).rejects.toThrow(EgressPolicyError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects non-http(s) protocols', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchEgress('file:///etc/passwd')).rejects.toThrow(EgressPolicyError);
    await expect(fetchEgress('ftp://example.com/file')).rejects.toThrow(EgressPolicyError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('follows redirects only to revalidated destinations and stops at private hops', async () => {
    const fetcher = vi.fn(async (input: string) => {
      if (input === 'https://example.com/start') {
        return new Response('', { status: 302, headers: { location: 'http://169.254.169.254/latest' } });
      }
      if (input === 'http://169.254.169.254/latest') return textResponse('SECRET');
      return textResponse('unexpected');
    });
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchEgress('https://example.com/start')).rejects.toThrow(EgressPolicyError);
    expect(fetcher).not.toHaveBeenCalledWith('http://169.254.169.254/latest', expect.anything());
  });

  it('returns the final response for a fully public redirect chain', async () => {
    lookupMock.mockImplementation(async (hostname: string) =>
      hostname === 'cdn.example.net' ? [{ address: '8.8.8.8', family: 4 }] : [{ address: '93.184.216.34', family: 4 }],
    );
    const fetcher = vi.fn(async (input: string) => {
      if (input === 'https://example.com/a') {
        return new Response('', { status: 301, headers: { location: 'https://cdn.example.net/b' } });
      }
      return textResponse('final');
    });
    vi.stubGlobal('fetch', fetcher);

    const res = await fetchEgress('https://example.com/a');
    expect(await res.text()).toBe('final');
    // Both hops pinned: two dispatcher constructions, two DNS validations.
    expect(agentConstructs).toHaveLength(2);
  });

  it('caps internal redirect following', async () => {
    const fetcher = vi.fn(
      async () => new Response('', { status: 302, headers: { location: 'https://example.com/loop' } }),
    );
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchEgress('https://example.com/loop')).rejects.toThrow(EgressPolicyError);
  });

  it('strips credentials when a redirect crosses origins', async () => {
    lookupMock.mockImplementation(async (hostname: string) =>
      hostname === 'other.example.net' ? [{ address: '8.8.4.4', family: 4 }] : [{ address: '93.184.216.34', family: 4 }],
    );
    const fetcher = vi.fn(async (input: string, _init?: RequestInit) => {
      if (input === 'https://example.com/a') {
        return new Response('', { status: 303, headers: { location: 'https://other.example.net/b' } });
      }
      return textResponse('final');
    });
    vi.stubGlobal('fetch', fetcher);

    await fetchEgress('https://example.com/a', {
      method: 'POST',
      headers: { authorization: 'Bearer secret', 'x-api-key': 'k', 'content-type': 'application/json' },
      body: '{}',
    });

    const secondCall = fetcher.mock.calls[1]!;
    expect(secondCall[0]).toBe('https://other.example.net/b');
    const headers = new Headers(secondCall[1]?.headers);
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-api-key')).toBeNull();
  });

  it('redirect: manual performs a single validated hop and returns 3xx untouched', async () => {
    const fetcher = vi.fn(
      async () => new Response('', { status: 302, headers: { location: 'http://127.0.0.1/secret' } }),
    );
    vi.stubGlobal('fetch', fetcher);

    const res = await fetchEgress('https://example.com/r', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  describe('local/self-host destinations', () => {
    it('rejects private destinations on hosted deployments by default', async () => {
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);

      await expect(fetchEgress('http://localhost:11434/api/tags')).rejects.toThrow(EgressPolicyError);
      await expect(fetchEgress('http://192.168.1.20:8880/v1/audio/voices')).rejects.toThrow(EgressPolicyError);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('allows private destinations when FLASHDAY_SELF_HOST=1', async () => {
      vi.stubEnv('FLASHDAY_SELF_HOST', '1');
      const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => textResponse('{"models":[]}'));
      vi.stubGlobal('fetch', fetcher);

      const res = await fetchEgress('http://localhost:11434/api/tags');
      expect(res.status).toBe(200);
      // Local mode: plain fetch — no pinned dispatcher needed for operator trust.
      const init = fetcher.mock.calls[0]?.[1] as (RequestInit & { dispatcher?: unknown }) | undefined;
      expect(init?.dispatcher).toBeUndefined();
    });

    it('allows only exact allowlisted origins via FLASHDAY_LOCAL_PROVIDERS', async () => {
      vi.stubEnv('FLASHDAY_LOCAL_PROVIDERS', 'http://localhost:11434, http://nas.lan:8880');
      const fetcher = vi.fn(async () => textResponse('ok'));
      vi.stubGlobal('fetch', fetcher);

      // Allowlisted origin works.
      const res = await fetchEgress('http://localhost:11434/api/tags');
      expect(res.status).toBe(200);

      // Different port on same host is a different origin → still blocked.
      await expect(fetchEgress('http://localhost:9999/api/tags')).rejects.toThrow(EgressPolicyError);
      // Non-allowlisted private destination → blocked.
      await expect(fetchEgress('http://10.0.0.9/')).rejects.toThrow(EgressPolicyError);
    });

    it('allowlisted local fetches still revalidate redirect hops', async () => {
      vi.stubEnv('FLASHDAY_LOCAL_PROVIDERS', 'http://localhost:11434');
      const fetcher = vi.fn(async (input: string, _init?: RequestInit) => {
        if (input === 'http://localhost:11434/go') {
          return new Response('', { status: 302, headers: { location: 'http://169.254.169.254/latest' } });
        }
        if (input === 'http://169.254.169.254/latest') return textResponse('SECRET');
        return textResponse('ok');
      });
      vi.stubGlobal('fetch', fetcher);

      await expect(fetchEgress('http://localhost:11434/go')).rejects.toThrow(EgressPolicyError);
      expect(fetcher).not.toHaveBeenCalledWith('http://169.254.169.254/latest', expect.anything());
    });
  });
});
