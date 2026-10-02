import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { CHAT_TOOL_INPUT_SCHEMAS, CHAT_TOOL_NAMES, createChatTools } from '@/lib/chat-tools';
import { isToolUnsupportedError, POST } from './route';

const { streamTextMock } = vi.hoisted(() => ({ streamTextMock: vi.fn() }));

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  streamText: streamTextMock,
}));

vi.mock('@/lib/ai-model', () => ({
  resolveApiKey: vi.fn(() => 'test-api-key'),
  resolveModel: vi.fn(() => ({ mocked: true })),
}));

vi.mock('@/lib/platform-provider', () => ({
  enforcePlatformRateLimit: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/lib/provider-resolver', () => ({
  ProviderResolutionError: class ProviderResolutionError extends Error {},
  resolveProviderForCapability: vi.fn(() => ({
    providerId: 'groq',
    modelId: 'mock-model',
    credentialSource: 'platform',
    fallbackApplied: false,
  })),
}));

describe('chat API tool schemas', () => {
  it('all 17 tools are defined', () => {
    const tools = createChatTools();

    expect(Object.keys(tools)).toHaveLength(17);
    expect(Object.keys(tools)).toEqual(CHAT_TOOL_NAMES);
  });

  it('navigate validates supported app paths', () => {
    expect(CHAT_TOOL_INPUT_SCHEMAS.navigate.safeParse({ path: '/settings', reason: 'Open settings' }).success).toBe(true);
    expect(CHAT_TOOL_INPUT_SCHEMAS.navigate.safeParse({ path: '/nope', reason: 'Bad route' }).success).toBe(false);
  });

  it('importYouTube validates url format', () => {
    expect(CHAT_TOOL_INPUT_SCHEMAS.importYouTube.safeParse({ url: 'https://www.youtube.com/watch?v=abc123' }).success).toBe(
      true,
    );
    expect(CHAT_TOOL_INPUT_SCHEMAS.importYouTube.safeParse({ url: 'not-a-url' }).success).toBe(false);
  });

  it('updateProviderConfig validates provider ids', () => {
    expect(
      CHAT_TOOL_INPUT_SCHEMAS.updateProviderConfig.safeParse({ providerId: 'openai', model: 'gpt-4o' }).success,
    ).toBe(true);
    expect(
      CHAT_TOOL_INPUT_SCHEMAS.updateProviderConfig.safeParse({ providerId: 'unknown-provider' }).success,
    ).toBe(false);
  });

  it('tools with no params accept empty objects', () => {
    expect(CHAT_TOOL_INPUT_SCHEMAS.showAnalytics.safeParse({}).success).toBe(true);
    expect(CHAT_TOOL_INPUT_SCHEMAS.showTodaySessions.safeParse({}).success).toBe(true);
    expect(CHAT_TOOL_INPUT_SCHEMAS.showTodayStats.safeParse({}).success).toBe(true);
    expect(CHAT_TOOL_INPUT_SCHEMAS.showDueReviews.safeParse({}).success).toBe(true);
  });
});

describe('chat API tool routing', () => {
  it('recognizes explicit unsupported-tool errors', () => {
    expect(isToolUnsupportedError('No endpoints found that support tool use')).toBe(true);
    expect(isToolUnsupportedError('This model does not support function calling')).toBe(true);
    expect(isToolUnsupportedError('tool_use_failed')).toBe(true);
  });

  it('does not downgrade unrelated provider errors', () => {
    expect(isToolUnsupportedError('User not found')).toBe(false);
    expect(isToolUnsupportedError('Rate limit exceeded')).toBe(false);
    expect(isToolUnsupportedError('Requested 4096 tokens but only 48 available')).toBe(false);
  });
});

describe('chat API placement boundary (W2-G03)', () => {
  const callModel = async (body: Record<string, unknown>) => {
    streamTextMock.mockReset();
    streamTextMock.mockReturnValue({
      toUIMessageStream: () =>
        new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: 't1' });
            controller.close();
          },
        }),
    });
    const response = await POST(
      new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    await response.text(); // drain the stream so execute() reaches streamText
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    const [args] = streamTextMock.mock.calls[0];
    return { system: args.system as string, messages: args.messages as unknown };
  };

  it('a client-supplied userLevel never reaches the model input', async () => {
    const body = {
      provider: 'groq',
      messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Help me practice' }] }],
      context: { module: 'listen', chatMode: 'practice' },
    };

    const withoutLevel = await callModel(body);
    const withLevel = await callModel({ ...body, userLevel: 'C2' });

    expect(withLevel.system).toBe(withoutLevel.system);
    expect(withLevel.messages).toEqual(withoutLevel.messages);
    expect(withLevel.system).not.toContain('CEFR');
  });
});
