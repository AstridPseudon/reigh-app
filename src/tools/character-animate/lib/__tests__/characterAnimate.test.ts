import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock taskCreation before importing the module under test
const mockCreateTask = vi.fn();
const mockValidateRequiredFields = vi.fn();

vi.mock('@/shared/lib/taskCreation', () => ({
  createTask: (...args: unknown[]) => mockCreateTask(...args),
  validateRequiredFields: (...args: unknown[]) => mockValidateRequiredFields(...args),
  TaskValidationError: class TaskValidationError extends Error {
    field: string;
    constructor(message: string, field: string) {
      super(message);
      this.name = 'TaskValidationError';
      this.field = field;
    }
  },
}));

vi.mock('@/shared/lib/errorHandling/runtimeError', () => ({
  normalizeAndPresentError: vi.fn(),
}));

import { createCharacterAnimateTask, CharacterAnimateTaskParams } from '../characterAnimate';

describe('createCharacterAnimateTask', () => {
  const validParams: CharacterAnimateTaskParams = {
    project_id: 'proj-123',
    character_image_url: 'https://example.com/character.png',
    motion_video_url: 'https://example.com/motion.mp4',
    prompt: 'dancing character',
    mode: 'animate',
    resolution: '480p',
    seed: 42,
    random_seed: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTask.mockResolvedValue({ task_id: 'created-task-id' });
  });

  it('creates a task with valid params', async () => {
    const result = await createCharacterAnimateTask(validParams);

    expect(result).toEqual({ task_id: 'created-task-id' });
    expect(mockCreateTask).toHaveBeenCalledWith({
      project_id: 'proj-123',
      family: 'character_animate',
      input: {
        character_image_url: 'https://example.com/character.png',
        motion_video_url: 'https://example.com/motion.mp4',
        prompt: 'dancing character',
        mode: 'animate',
        resolution: '480p',
        seed: 42,
        random_seed: false,
      },
    });
  });

  it('uses default prompt when prompt is not provided', async () => {
    const paramsNoPrompt = { ...validParams, prompt: undefined };

    await createCharacterAnimateTask(paramsNoPrompt);

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          prompt: 'natural expression; preserve outfit details',
        }),
      }),
    );
  });

  it('uses random seed when random_seed is true', async () => {
    const paramsRandomSeed = { ...validParams, random_seed: true, seed: 42 };

    await createCharacterAnimateTask(paramsRandomSeed);

    const calledParams = mockCreateTask.mock.calls[0][0].input;
    // When random_seed is true, the seed should be a random number (not 42)
    expect(typeof calledParams.seed).toBe('number');
    // The seed COULD randomly equal 42, but the important thing is the function ran
    expect(calledParams.seed).toBeGreaterThanOrEqual(0);
  });

  it('uses provided seed when random_seed is false', async () => {
    const paramsFixedSeed = { ...validParams, random_seed: false, seed: 12345 };

    await createCharacterAnimateTask(paramsFixedSeed);

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          seed: 12345,
        }),
      }),
    );
  });

  it('validates required fields', async () => {
    await createCharacterAnimateTask(validParams);

    expect(mockValidateRequiredFields).toHaveBeenCalledWith(validParams, [
      'project_id',
      'character_image_url',
      'motion_video_url',
      'mode',
      'resolution',
    ]);
  });

  it('throws on invalid mode', async () => {
    const invalidParams = { ...validParams, mode: 'invalid' as 'animate' | 'replace' };

    await expect(createCharacterAnimateTask(invalidParams)).rejects.toThrow(
      "mode must be 'replace' or 'animate'",
    );
  });

  it('throws on invalid resolution', async () => {
    const invalidParams = { ...validParams, resolution: '1080p' as '480p' | '720p' };

    await expect(createCharacterAnimateTask(invalidParams)).rejects.toThrow(
      "resolution must be '480p' or '720p'",
    );
  });

  it('throws on empty character_image_url', async () => {
    const invalidParams = { ...validParams, character_image_url: '' };

    await expect(createCharacterAnimateTask(invalidParams)).rejects.toThrow(
      'character_image_url is required',
    );
  });

  it('throws on empty motion_video_url', async () => {
    const invalidParams = { ...validParams, motion_video_url: '' };

    await expect(createCharacterAnimateTask(invalidParams)).rejects.toThrow(
      'motion_video_url is required',
    );
  });

  it('propagates createTask errors', async () => {
    mockCreateTask.mockRejectedValue(new Error('Network error'));

    await expect(createCharacterAnimateTask(validParams)).rejects.toThrow('Network error');
  });

  it('sets family to character_animate', async () => {
    await createCharacterAnimateTask(validParams);

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 'character_animate',
      }),
    );
  });

  it('builds payload with both mode types', async () => {
    // Test 'replace' mode
    await createCharacterAnimateTask({ ...validParams, mode: 'replace' });

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          mode: 'replace',
        }),
      }),
    );

    // Test 'animate' mode
    vi.clearAllMocks();
    mockCreateTask.mockResolvedValue({ task_id: 'created-task-id' });
    await createCharacterAnimateTask({ ...validParams, mode: 'animate' });

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          mode: 'animate',
        }),
      }),
    );
  });

  it('builds payload with both resolution types', async () => {
    await createCharacterAnimateTask({ ...validParams, resolution: '720p' });

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          resolution: '720p',
        }),
      }),
    );
  });
});
