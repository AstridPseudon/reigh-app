import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCrossfadeJoinTask } from './createCrossfadeJoinTask';

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  ensureShotParentGenerationId: vi.fn(),
  normalizeAndPresentError: vi.fn((error: unknown) => error),
}));

vi.mock('@/shared/lib/taskCreation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/taskCreation')>();
  return {
    ...actual,
    createTask: (...args: unknown[]) => mocks.createTask(...args),
  };
});

vi.mock('./shotParentGeneration', () => ({
  ensureShotParentGenerationId: (...args: unknown[]) => mocks.ensureShotParentGenerationId(...args),
}));

vi.mock('@/shared/lib/errorHandling/runtimeError', () => ({
  normalizeAndPresentError: (...args: unknown[]) => mocks.normalizeAndPresentError(...args),
}));

describe('createCrossfadeJoinTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTask.mockResolvedValue({ task_id: 'task-1', status: 'pending' });
    mocks.ensureShotParentGenerationId.mockResolvedValue('parent-ensured');
  });

  it('creates a travel_stitch task with direct parent routing metadata', async () => {
    await createCrossfadeJoinTask({
      project_id: 'project-1',
      shot_id: 'shot-1',
      clip_urls: ['https://example.com/a.mp4', 'https://example.com/b.mp4'],
      frame_overlap_settings_expanded: [24],
      audio_url: 'https://example.com/audio.mp3',
      tool_type: 'travel-between-images',
    });

    expect(mocks.ensureShotParentGenerationId).toHaveBeenCalledWith({
      projectId: 'project-1',
      shotId: 'shot-1',
      parentGenerationId: undefined,
      context: 'CrossfadeJoin',
    });

    const taskRequest = mocks.createTask.mock.calls[0][0];
    expect(taskRequest.task_type).toBe('travel_stitch');
    expect(taskRequest.params.parent_generation_id).toBe('parent-ensured');
    expect(taskRequest.params.clip_urls).toEqual([
      'https://example.com/a.mp4',
      'https://example.com/b.mp4',
    ]);
    expect(taskRequest.params.frame_overlap_settings_expanded).toEqual([24]);
    expect(taskRequest.params.orchestration_contract.parent_generation_id).toBe('parent-ensured');
    expect(taskRequest.params.orchestration_contract.orchestrator_task_id).toBeUndefined();
    expect(taskRequest.params.full_orchestrator_payload.audio_url).toBe('https://example.com/audio.mp3');
    expect(taskRequest.params.tool_type).toBe('travel-between-images');
  });

  it('rejects invalid boundary counts', async () => {
    await expect(createCrossfadeJoinTask({
      project_id: 'project-1',
      clip_urls: ['https://example.com/a.mp4', 'https://example.com/b.mp4'],
      frame_overlap_settings_expanded: [24, 12],
    })).rejects.toThrow('frame_overlap_settings_expanded must contain one entry per clip boundary');
  });
});
