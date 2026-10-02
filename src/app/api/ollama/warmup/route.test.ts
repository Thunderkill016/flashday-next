import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Public provider hosts resolve publicly; local providers need the opt-in.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { POST } = await import('./route');

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/ollama/warmup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ollama/warmup', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubEnv('FLASHDAY_SELF_HOST', '');
    vi.stubEnv('FLASHDAY_LOCAL_PROVIDERS', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('refuses a private baseUrl on hosted deployments — not an arbitrary proxy', async () => {
    const res = await POST(makeRequest({ modelId: 'llama3.2', baseUrl: 'http://localhost:11434' }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('egress_blocked');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses metadata-endpoint baseUrl on hosted deployments', async () => {
    const res = await POST(
      makeRequest({ modelId: 'x', baseUrl: 'http://169.254.169.254', apiPath: '/latest/meta-data' }),
    );
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('permits the warmup against an allowlisted self-host origin', async () => {
    vi.stubEnv('FLASHDAY_LOCAL_PROVIDERS', 'http://localhost:11434');
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    const res = await POST(makeRequest({ modelId: 'llama3.2', baseUrl: 'http://localhost:11434' }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('permits a public https provider endpoint through the pinned fetch', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    const res = await POST(
      makeRequest({ modelId: 'gpt', baseUrl: 'https://provider.example.com', apiPath: '/v1/chat/completions' }),
    );
    expect(res.status).toBe(200);
    const init = fetchMock.mock.calls[0]?.[1] as (RequestInit & { dispatcher?: unknown }) | undefined;
    expect(fetchMock).toHaveBeenCalledWith('https://provider.example.com/v1/chat/completions', expect.anything());
    expect(init?.dispatcher).toBeDefined();
  });
});
