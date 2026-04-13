import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePromptQueueSubmission } from './usePromptQueueSubmission';
import { toast } from '@/shared/components/ui/runtime/sonner';

vi.mock('@/shared/components/ui/runtime/sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('usePromptQueueSubmission', () => {
  it('queues existing prompts using task params from the current prompt list', () => {
    const queueIncomingTask = vi.fn();
    const getTaskParams = vi.fn(() => ({ task_type: 'single_image' }));

    const { result } = renderHook(() =>
      usePromptQueueSubmission({
        context: {
          prompts: [{ id: 'p1', fullPrompt: 'A very long prompt', shortPrompt: 'short' }],
          promptMultiplier: 2,
          imagesPerPrompt: 1,
          actionablePromptsCount: 1,
          styleReferenceImageGeneration: null,
          generationSourceRef: { current: 'standard' },
          selectedTextModelRef: { current: 'gpt-5-mini' },
          formStateRef: { current: undefined },
        } as never,
        getTaskParams,
        aiGeneratePrompts: vi.fn(),
        onGenerate: vi.fn(),
        setPrompts: vi.fn(),
        queueIncomingTask,
      }),
    );

    act(() => {
      result.current.queueExisting();
    });

    expect(getTaskParams).toHaveBeenCalled();
    expect(queueIncomingTask).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'useFormSubmission.queueExisting',
        expectedCount: 2,
      }),
    );
  });

  it('shows an error toast when queueLikeExisting has no actionable prompts', () => {
    const queueIncomingTask = vi.fn();

    const { result } = renderHook(() =>
      usePromptQueueSubmission({
        context: {
          prompts: [{ id: 'p1', fullPrompt: '   ', shortPrompt: '' }],
          promptMultiplier: 1,
          imagesPerPrompt: 2,
          actionablePromptsCount: 0,
          styleReferenceImageGeneration: null,
          generationSourceRef: { current: 'standard' },
          selectedTextModelRef: { current: 'gpt-5-mini' },
          formStateRef: { current: undefined },
        } as never,
        getTaskParams: vi.fn(),
        aiGeneratePrompts: vi.fn(),
        onGenerate: vi.fn(),
        setPrompts: vi.fn(),
        queueIncomingTask,
      }),
    );

    act(() => {
      result.current.queueLikeExisting();
    });

    expect(toast.error).toHaveBeenCalledWith('No prompts available. Please add prompts first.');
    expect(queueIncomingTask).not.toHaveBeenCalled();
  });

  it('queues more-like-existing generation and passes the derived prompts through getTaskParams', async () => {
    const queueIncomingTask = vi.fn();
    const getTaskParams = vi.fn(() => ({ task_type: 'single_image', reference_mode: 'style' }));
    const aiGeneratePrompts = vi.fn().mockResolvedValue([
      { id: 'p2', text: 'Generated prompt', shortText: 'generated' },
    ]);
    const onGenerate = vi.fn().mockResolvedValue({ taskId: 'task-1' });
    const setPrompts = vi.fn();

    const { result } = renderHook(() =>
      usePromptQueueSubmission({
        context: {
          prompts: [{ id: 'p1', fullPrompt: 'Keep this prompt', shortPrompt: 'keep this' }],
          promptMultiplier: 2,
          imagesPerPrompt: 1,
          actionablePromptsCount: 1,
          styleReferenceImageGeneration: 'https://cdn.example.com/reference.png',
          generationSourceRef: { current: 'by-reference' },
          selectedTextModelRef: { current: 'gpt-5-mini' },
          formStateRef: { current: undefined },
        } as never,
        getTaskParams,
        aiGeneratePrompts,
        onGenerate,
        setPrompts,
        queueIncomingTask,
      }),
    );

    act(() => {
      result.current.queueLikeExisting();
    });

    const queuedTask = queueIncomingTask.mock.calls[0]?.[0];
    expect(queuedTask).toBeDefined();

    await act(async () => {
      await queuedTask.execute();
    });

    expect(aiGeneratePrompts).toHaveBeenCalled();
    expect(setPrompts).toHaveBeenCalledWith([
      { id: 'p2', fullPrompt: 'Generated prompt', shortPrompt: 'generated' },
    ]);
    expect(getTaskParams).toHaveBeenCalledWith(
      [{ id: 'p2', fullPrompt: 'Generated prompt', shortPrompt: 'generated' }],
      { imagesPerPromptOverride: 2 },
    );
    expect(onGenerate).toHaveBeenCalledWith({ task_type: 'single_image', reference_mode: 'style' });
  });
});
