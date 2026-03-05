import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __getServeHandler, __resetServeHandler } from '../_tests/mocks/denoHttpServer.ts';
import * as GetTaskStatusEntrypoint from './index.ts';

const mocks = vi.hoisted(() => ({
  withEdgeRequest: vi.fn(),
  authorizeTaskActor: vi.fn(),
}));

vi.mock('../_shared/edgeHandler.ts', () => ({
  withEdgeRequest: (...args: unknown[]) => mocks.withEdgeRequest(...args),
}));

vi.mock('../_shared/taskActorPolicy.ts', () => ({
  authorizeTaskActor: (...args: unknown[]) => mocks.authorizeTaskActor(...args),
}));

vi.mock('../_shared/http.ts', () => ({
  jsonResponse: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

function buildQueryTask(status = 'completed') {
  const single = vi.fn().mockResolvedValue({
    data: { id: 'task-own', status },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, select, eq, single };
}

describe('get-task-status edge entrypoint', () => {
  it('imports entrypoint module directly', () => {
    expect(GetTaskStatusEntrypoint).toBeDefined();
  });

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    __resetServeHandler();
  });

  it('returns status for task owner (JWT/PAT)', async () => {
    const query = buildQueryTask('succeeded');
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
      setDefaultTaskId: vi.fn(),
    };

    mocks.authorizeTaskActor.mockResolvedValue({
      ok: true,
      value: {
        isServiceRole: false,
        callerId: 'user-own',
        taskOwnerVerified: true,
      },
    });

    mocks.withEdgeRequest.mockImplementation(
      async (_req: Request, _options: unknown, handler: (ctx: unknown) => Promise<Response>) => {
        return handler({
          supabaseAdmin: { from: query.from },
          logger,
          body: { task_id: 'task-own' },
          auth: { isServiceRole: false, userId: 'user-own', success: true },
        });
      },
    );

    await import('./index.ts');
    const handler = __getServeHandler();

    const response = await handler(
      new Request('https://edge.test/get-task-status', {
        method: 'POST',
        headers: { authorization: 'Bearer pat-token' },
        body: JSON.stringify({ task_id: 'task-own' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'succeeded' });
    expect(mocks.authorizeTaskActor).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-own',
      logPrefix: '[GET-TASK-STATUS]',
    }));
  });

  it('returns 403 when caller does not own the task', async () => {
    const query = buildQueryTask();
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
      setDefaultTaskId: vi.fn(),
    };

    mocks.authorizeTaskActor.mockResolvedValue({
      ok: false,
      error: 'Forbidden',
      statusCode: 403,
    });

    mocks.withEdgeRequest.mockImplementation(
      async (_req: Request, _options: unknown, handler: (ctx: unknown) => Promise<Response>) => {
        return handler({
          supabaseAdmin: { from: query.from },
          logger,
          body: { task_id: 'task-other' },
          auth: { isServiceRole: false, userId: 'user-own', success: true },
        });
      },
    );

    await import('./index.ts');
    const handler = __getServeHandler();

    const response = await handler(
      new Request('https://edge.test/get-task-status', {
        method: 'POST',
        headers: { authorization: 'Bearer jwt-token' },
        body: JSON.stringify({ task_id: 'task-other' }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(query.from).not.toHaveBeenCalled();
  });
});
