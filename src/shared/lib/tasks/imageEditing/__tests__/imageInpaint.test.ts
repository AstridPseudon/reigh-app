import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createImageInpaintTask } from '../imageInpaint';

const mockCreateTask = vi.fn();

vi.mock('../../../taskCreation', () => ({
  createTask: (...args: unknown[]) => mockCreateTask(...args),
}));

describe('createImageInpaintTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTask.mockResolvedValue({ task_id: 'task-1', status: 'pending' });
  });

  it('creates a single inpaint task with correct shape', async () => {
    const result = await createImageInpaintTask({
      project_id: 'proj-1',
      image_url: 'https://example.com/image.jpg',
      mask_url: 'https://example.com/mask.png',
      prompt: 'remove the car',
      num_generations: 1,
    });

    expect(result).toBe('task-1');
    expect(mockCreateTask).toHaveBeenCalledOnce();

    const call = mockCreateTask.mock.calls[0][0];
    expect(call.project_id).toBe('proj-1');
    expect(call.family).toBe('masked_edit');
    expect(call.input.task_type).toBe('image_inpaint');
    expect(call.input.image_url).toBe('https://example.com/image.jpg');
    expect(call.input.mask_url).toBe('https://example.com/mask.png');
    expect(call.input.prompt).toBe('remove the car');
    expect(call.input.num_generations).toBe(1);
  });

  it('passes generation_id in input when provided', async () => {
    await createImageInpaintTask({
      project_id: 'proj-1',
      image_url: 'https://example.com/image.jpg',
      mask_url: 'https://example.com/mask.png',
      prompt: 'fix this',
      num_generations: 1,
      generation_id: 'gen-100',
    });

    const input = mockCreateTask.mock.calls[0][0].input;
    expect(input.generation_id).toBe('gen-100');
  });

  it('includes optional fields when provided', async () => {
    await createImageInpaintTask({
      project_id: 'proj-1',
      image_url: 'https://example.com/image.jpg',
      mask_url: 'https://example.com/mask.png',
      prompt: 'edit',
      num_generations: 1,
      shot_id: 'shot-1',
      tool_type: 'inpaint',
      loras: [{ path: 'lora-path', scale: 0.8 }],
      create_as_generation: true,
      source_variant_id: 'var-1',
      qwen_edit_model: 'qwen-edit-2511',
    });

    const input = mockCreateTask.mock.calls[0][0].input;
    expect(input.shot_id).toBe('shot-1');
    expect(input.tool_type).toBe('inpaint');
    expect(input.loras).toEqual([{ path: 'lora-path', scale: 0.8 }]);
    expect(input.create_as_generation).toBe(true);
    expect(input.source_variant_id).toBe('var-1');
    expect(input.qwen_edit_model).toBe('qwen-edit-2511');
  });

  it('omits optional fields when not provided', async () => {
    await createImageInpaintTask({
      project_id: 'proj-1',
      image_url: 'https://example.com/image.jpg',
      mask_url: 'https://example.com/mask.png',
      prompt: 'edit',
      num_generations: 1,
    });

    const input = mockCreateTask.mock.calls[0][0].input;
    expect(input.shot_id).toBeUndefined();
    expect(input.tool_type).toBeUndefined();
    expect(input.loras).toBeUndefined();
    expect(input.create_as_generation).toBeUndefined();
    expect(input.source_variant_id).toBeUndefined();
    expect(input.qwen_edit_model).toBeUndefined();
  });

  it('makes a single createTask call even when num_generations > 1', async () => {
    const result = await createImageInpaintTask({
      project_id: 'proj-1',
      image_url: 'https://example.com/image.jpg',
      mask_url: 'https://example.com/mask.png',
      prompt: 'batch edit',
      num_generations: 3,
    });

    // Backend handles batching — only one createTask call is made
    expect(mockCreateTask).toHaveBeenCalledOnce();
    expect(mockCreateTask.mock.calls[0][0].input.num_generations).toBe(3);
    expect(result).toBe('task-1');
  });

  it('passes hires_fix directly in input', async () => {
    const hiresConfig = { hires_scale: 2, hires_steps: 10 };

    await createImageInpaintTask({
      project_id: 'proj-1',
      image_url: 'https://example.com/image.jpg',
      mask_url: 'https://example.com/mask.png',
      prompt: 'edit',
      num_generations: 1,
      hires_fix: hiresConfig,
    });

    const input = mockCreateTask.mock.calls[0][0].input;
    expect(input.hires_fix).toEqual({ hires_scale: 2, hires_steps: 10 });
  });
});
