import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __getServeHandler, __resetServeHandler } from '../_tests/mocks/denoHttpServer.ts';
import * as AiPromptEntrypoint from './index.ts';

const mocks = vi.hoisted(() => ({
  bootstrapEdgeHandler: vi.fn(),
  enforceRateLimit: vi.fn(),
  buildGeneratePromptsMessages: vi.fn(),
  buildEditPromptMessages: vi.fn(),
  buildEnhanceSegmentUserPrompt: vi.fn(),
  toErrorMessage: vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
  fireworksFetch: vi.fn(),
}));

vi.mock('../_shared/edgeHandler.ts', () => ({
  bootstrapEdgeHandler: (...args: unknown[]) => mocks.bootstrapEdgeHandler(...args),
  NO_SESSION_RUNTIME_OPTIONS: {},
}));

vi.mock('../_shared/rateLimit.ts', () => ({
  enforceRateLimit: (...args: unknown[]) => mocks.enforceRateLimit(...args),
  RATE_LIMITS: {
    expensive: { maxRequests: 10, windowSeconds: 60 },
  },
}));

vi.mock('../_shared/http.ts', () => ({
  jsonResponse: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

vi.mock('../_shared/errorMessage.ts', () => ({
  toErrorMessage: (...args: unknown[]) => mocks.toErrorMessage(...args),
}));

vi.mock('./templates.ts', () => ({
  buildGeneratePromptsMessages: (...args: unknown[]) => mocks.buildGeneratePromptsMessages(...args),
  buildEditPromptMessages: (...args: unknown[]) => mocks.buildEditPromptMessages(...args),
  buildEnhanceSegmentUserPrompt: (...args: unknown[]) => mocks.buildEnhanceSegmentUserPrompt(...args),
  ENHANCE_SEGMENT_SYSTEM_PROMPT: 'enhance-system',
}));

function stubDenoEnv(): void {
  vi.stubGlobal('Deno', {
    env: {
      get: (key: string) => {
        if (key === 'FIREWORKS_API_KEY') return 'fireworks-test-key';
        if (key === 'OPENAI_API_KEY') return 'openai-test-key';
        return undefined;
      },
    },
  });
}

function stubFireworksFetch(): void {
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    if (typeof url === 'string' && url.startsWith('https://api.fireworks.ai/')) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return Promise.resolve(mocks.fireworksFetch(body));
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

function fireworksOk(payload: { content: string; usage?: unknown; model?: string }): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: payload.content } }],
      usage: payload.usage,
      model: payload.model ?? 'accounts/fireworks/models/kimi-k2p5',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

async function loadHandler() {
  await import('./index.ts');
  return __getServeHandler();
}

describe('ai-prompt edge entrypoint', () => {
  it('imports entrypoint module directly', () => {
    expect(AiPromptEntrypoint).toBeDefined();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    __resetServeHandler();
    stubDenoEnv();
    stubFireworksFetch();

    mocks.enforceRateLimit.mockResolvedValue(null);

    mocks.buildGeneratePromptsMessages.mockReturnValue({
      systemMsg: 'system message',
      userMsg: 'user message',
    });
    mocks.buildEditPromptMessages.mockReturnValue({
      systemMsg: 'edit system',
      userMsg: 'edit user',
    });
    mocks.buildEnhanceSegmentUserPrompt.mockReturnValue('enhance user');

    mocks.fireworksFetch.mockReturnValue(
      fireworksOk({ content: 'first\nsecond\nthird', usage: { total_tokens: 123 } }),
    );

    mocks.bootstrapEdgeHandler.mockResolvedValue({
      ok: true,
      value: {
        supabaseAdmin: {},
        logger: { info: vi.fn() },
        auth: { userId: 'user-1' },
        body: {
          task: 'generate_prompts',
          overallPromptText: 'main prompt',
          rulesToRememberText: '',
          numberToGenerate: 2,
          existingPrompts: [],
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns bootstrap failure response untouched', async () => {
    mocks.bootstrapEdgeHandler.mockResolvedValue({
      ok: false,
      response: new Response('blocked', { status: 418 }),
    });

    const handler = await loadHandler();
    const response = await handler(new Request('https://edge.test/ai-prompt', { method: 'POST' }));

    expect(response.status).toBe(418);
    await expect(response.text()).resolves.toBe('blocked');
  });

  it('returns 401 when auth user is missing', async () => {
    mocks.bootstrapEdgeHandler.mockResolvedValue({
      ok: true,
      value: {
        supabaseAdmin: {},
        logger: { info: vi.fn() },
        auth: { userId: '' },
        body: { task: 'generate_prompts' },
      },
    });

    const handler = await loadHandler();
    const response = await handler(new Request('https://edge.test/ai-prompt', { method: 'POST' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authentication failed' });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it('returns 503 when rate limit service is unavailable', async () => {
    mocks.enforceRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Rate limit service unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const handler = await loadHandler();
    const response = await handler(new Request('https://edge.test/ai-prompt', { method: 'POST' }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'Rate limit service unavailable' });
  });

  it('generates prompts and trims extra lines to requested count', async () => {
    const handler = await loadHandler();
    const response = await handler(new Request('https://edge.test/ai-prompt', { method: 'POST' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      prompts: ['first', 'second'],
      usage: { total_tokens: 123 },
    });
    expect(mocks.fireworksFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'accounts/fireworks/models/kimi-k2p5',
      }),
    );
  });

  it('retries at temperature 1.0 when primary returns duplicates', async () => {
    mocks.bootstrapEdgeHandler.mockResolvedValue({
      ok: true,
      value: {
        supabaseAdmin: {},
        logger: { info: vi.fn() },
        auth: { userId: 'user-1' },
        body: {
          task: 'generate_prompts',
          overallPromptText: 'main prompt',
          rulesToRememberText: '',
          numberToGenerate: 3,
          existingPrompts: [],
        },
      },
    });

    mocks.fireworksFetch
      .mockReturnValueOnce(fireworksOk({ content: 'same\nsame\nsame', usage: { total_tokens: 10 } }))
      .mockReturnValueOnce(fireworksOk({ content: 'one\ntwo\nthree', usage: { total_tokens: 50 } }));

    const handler = await loadHandler();
    const response = await handler(new Request('https://edge.test/ai-prompt', { method: 'POST' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      prompts: ['one', 'two', 'three'],
      usage: { total_tokens: 50 },
    });
    expect(mocks.fireworksFetch).toHaveBeenCalledTimes(2);
    expect(mocks.fireworksFetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        model: 'accounts/fireworks/models/kimi-k2p5',
        temperature: 1.0,
      }),
    );
  });
});
