import { describe, expect, it, vi } from 'vitest';

import { parseCompleteTaskRequest, validateStoragePathSecurity } from './request.ts';

function createTaskLookupClient(result: { data: { task_type: string } | null; error: { message: string } | null }) {
  const single = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return {
    client: { from },
    spies: { from, select, eq, single },
  };
}

describe('complete_task/request parseCompleteTaskRequest', () => {
  it('rejects multipart uploads', async () => {
    const request = new Request('https://edge.test/complete-task', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=abc' },
      body: '--abc--',
    });

    const result = await parseCompleteTaskRequest(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toMatchObject({
        errorCode: 'multipart_not_supported',
      });
    }
  });

  it('parses base64 mode payloads', async () => {
    const request = new Request('https://edge.test/complete-task', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        task_id: 'task-1',
        file_data: 'aGVsbG8=',
        filename: 'output.png',
      }),
    });

    const result = await parseCompleteTaskRequest(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('base64');
      expect(result.data.taskId).toBe('task-1');
      expect(result.data.filename).toBe('output.png');
      expect(result.data.fileData).toBeInstanceOf(Uint8Array);
      expect(Array.from(result.data.fileData ?? [])).toEqual([104, 101, 108, 108, 111]);
    }
  });

  it('parses presigned storage path payloads and marks orchestrator check when task ids differ', async () => {
    const request = new Request('https://edge.test/complete-task', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        task_id: 'task-target',
        storage_path: 'user-1/tasks/task-source/out.png',
      }),
    });

    const result = await parseCompleteTaskRequest(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('presigned');
      expect(result.data.taskId).toBe('task-target');
      expect(result.data.storagePathTaskId).toBe('task-source');
      expect(result.data.requiresOrchestratorCheck).toBe(true);
    }
  });
});

describe('complete_task/request validateStoragePathSecurity', () => {
  it('allows matching task ids without database lookup', async () => {
    const lookup = createTaskLookupClient({
      data: { task_type: 'image_generation' },
      error: null,
    });

    const result = await validateStoragePathSecurity(
      lookup.client as never,
      'task-1',
      'user-1/tasks/task-1/out.png',
      'task-1',
    );

    expect(result).toEqual({ allowed: true });
    expect(lookup.spies.from).not.toHaveBeenCalled();
  });

  it('allows mismatched task ids for orchestrator tasks', async () => {
    const lookup = createTaskLookupClient({
      data: { task_type: 'image_orchestrator' },
      error: null,
    });

    const result = await validateStoragePathSecurity(
      lookup.client as never,
      'task-target',
      'user-1/tasks/task-source/out.png',
      'task-source',
    );

    expect(result).toEqual({ allowed: true });
    expect(lookup.spies.from).toHaveBeenCalledWith('tasks');
  });

  it('rejects mismatched task ids for non-orchestrator tasks', async () => {
    const lookup = createTaskLookupClient({
      data: { task_type: 'image_generation' },
      error: null,
    });

    const result = await validateStoragePathSecurity(
      lookup.client as never,
      'task-target',
      'user-1/tasks/task-source/out.png',
      'task-source',
    );

    expect(result.allowed).toBe(false);
    expect(result.error).toContain('storage_path does not match task_id');
  });

  it('rejects when task lookup fails', async () => {
    const lookup = createTaskLookupClient({
      data: null,
      error: { message: 'db unavailable' },
    });

    const result = await validateStoragePathSecurity(
      lookup.client as never,
      'task-target',
      'user-1/tasks/task-source/out.png',
      'task-source',
    );

    expect(result.allowed).toBe(false);
    expect(result.error).toContain('storage_path does not match task_id');
  });
});
