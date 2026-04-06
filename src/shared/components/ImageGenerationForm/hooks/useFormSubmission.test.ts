import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFormSubmission } from './useFormSubmission';
import type { UseFormSubmissionProps } from './formSubmission/types';
import { DEFAULT_HIRES_FIX_CONFIG } from '../types';

const mocks = vi.hoisted(() => ({
  runTaskPlaceholder: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/shared/hooks/tasks/useTaskPlaceholder', () => ({
  useTaskPlaceholder: () => (...args: unknown[]) => mocks.runTaskPlaceholder(...args),
}));

vi.mock('@/shared/components/ui/runtime/sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}));

function buildProps(
  overrides: Partial<UseFormSubmissionProps['formState']> = {},
  promptOverrides: Partial<UseFormSubmissionProps['promptConfig']> = {},
): UseFormSubmissionProps {
  return {
    formState: {
      selectedProjectId: 'project-1',
      prompts: [{ id: 'prompt-1', fullPrompt: 'A cinematic shot', shortPrompt: 'cinematic shot' }],
      imagesPerPrompt: 2,
      promptMultiplier: 3,
      associatedShotId: 'shot-1',
      currentBeforePromptText: 'before',
      currentAfterPromptText: 'after',
      styleBoostTerms: 'dramatic lighting',
      isLocalGenerationEnabled: false,
      hiresFixConfig: DEFAULT_HIRES_FIX_CONFIG,
      effectivePromptMode: 'manual',
      masterPromptText: 'Master prompt',
      actionablePromptsCount: 1,
      ...overrides,
    },
    promptConfig: {
      generationSourceRef: { current: 'just-text' },
      selectedTextModelRef: { current: 'qwen-image' },
      selectedLoras: [],
      styleReferenceImageGeneration: 'style-ref-1',
      styleReferenceStrength: 1.1,
      subjectStrength: 0.4,
      effectiveSubjectDescription: 'Subject description',
      inThisScene: true,
      inThisSceneStrength: 0.8,
      referenceMode: 'style',
      ...promptOverrides,
    },
    effects: {
      aiGeneratePrompts: vi.fn(),
      onGenerate: vi.fn().mockResolvedValue(['task-1']),
      setPrompts: vi.fn(),
      automatedSubmitButton: {
        trigger: vi.fn(),
        isSubmitting: false,
        isSuccess: false,
      },
    },
  };
}

describe('useFormSubmission', () => {
  beforeEach(() => {
    mocks.runTaskPlaceholder.mockReset();
    mocks.toastError.mockReset();
    mocks.runTaskPlaceholder.mockImplementation(async (options: {
      create: () => Promise<unknown>;
    }) => {
      await options.create();
    });
  });

  it('uses the managed submission branch to queue incoming work and call onGenerate', async () => {
    const props = buildProps();
    const event = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    const { result } = renderHook(() => useFormSubmission(props));

    await act(async () => {
      await result.current.handleSubmit(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();

    await waitFor(() => {
      expect(mocks.runTaskPlaceholder).toHaveBeenCalledTimes(1);
      expect(props.effects.onGenerate).toHaveBeenCalledTimes(1);
    });

    expect(mocks.runTaskPlaceholder).toHaveBeenCalledWith(expect.objectContaining({
      taskType: 'image_generation',
      label: 'A cinematic shot',
      expectedCount: 2,
      context: 'useFormSubmission.submitManaged',
      toastTitle: 'Failed to create tasks. Please try again.',
    }));
    expect(props.effects.onGenerate).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 'project-1',
      imagesPerPrompt: 2,
      shot_id: 'shot-1',
      model_name: 'qwen-image',
      prompts: [
        expect.objectContaining({
          id: 'prompt-1',
          fullPrompt: 'before, A cinematic shot, after',
        }),
      ],
    }));
  });

  it('carries by-reference inputs through the managed submission workflow', async () => {
    const props = buildProps(
      {},
      {
        generationSourceRef: { current: 'by-reference' },
        selectedTextModelRef: { current: 'flux-dev' },
        styleReferenceImageGeneration: 'https://cdn.example.com/reference.png',
        styleReferenceStrength: 0.75,
        subjectStrength: 0.25,
        effectiveSubjectDescription: 'Lead character',
        inThisScene: false,
        inThisSceneStrength: 0.15,
        referenceMode: 'style',
      },
    );
    const event = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    const { result } = renderHook(() => useFormSubmission(props));

    await act(async () => {
      await result.current.handleSubmit(event);
    });

    await waitFor(() => {
      expect(props.effects.onGenerate).toHaveBeenCalledTimes(1);
    });

    expect(mocks.runTaskPlaceholder).toHaveBeenCalledWith(expect.objectContaining({
      context: 'useFormSubmission.submitManaged',
      expectedCount: 2,
    }));
    expect(props.effects.onGenerate).toHaveBeenCalledWith(expect.objectContaining({
      model_name: 'qwen-image',
      style_reference_image: 'https://cdn.example.com/reference.png',
      subject_reference_image: 'https://cdn.example.com/reference.png',
      style_reference_strength: 0.75,
      subject_strength: 0.25,
      subject_description: 'Lead character',
      in_this_scene: false,
      in_this_scene_strength: 0.15,
      reference_mode: 'style',
      prompts: [
        expect.objectContaining({
          fullPrompt: 'before, A cinematic shot, after, dramatic lighting',
        }),
      ],
    }));
  });

  it('uses the automated submission branch to generate prompts, update prompts, and create tasks', async () => {
    const props = buildProps({
      effectivePromptMode: 'automated',
      prompts: [{ id: 'prompt-1', fullPrompt: '', shortPrompt: '' }],
    });
    props.effects.aiGeneratePrompts = vi.fn().mockResolvedValue([
      { id: 'ai-1', text: 'Generated skyline prompt', shortText: 'skyline prompt' },
    ]);

    const event = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    const { result } = renderHook(() => useFormSubmission(props));

    await act(async () => {
      await result.current.handleSubmit(event);
    });

    await waitFor(() => {
      expect(mocks.runTaskPlaceholder).toHaveBeenCalledTimes(1);
      expect(props.effects.setPrompts).toHaveBeenCalledWith([
        {
          id: 'ai-1',
          fullPrompt: 'Generated skyline prompt',
          shortPrompt: 'skyline prompt',
        },
      ]);
      expect(props.effects.onGenerate).toHaveBeenCalledTimes(1);
    });

    expect(mocks.runTaskPlaceholder).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Master prompt',
      expectedCount: 6,
      context: 'useFormSubmission.submitAutomated',
      toastTitle: 'Failed to generate prompts. Please try again.',
    }));
    expect(props.effects.aiGeneratePrompts).toHaveBeenCalledWith(expect.objectContaining({
      overallPromptText: 'Master prompt',
      numberToGenerate: 2,
    }));
    expect(props.effects.onGenerate).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 'project-1',
      imagesPerPrompt: 3,
      shot_id: 'shot-1',
      prompts: [
        expect.objectContaining({
          id: 'ai-1',
          fullPrompt: 'before, Generated skyline prompt, after',
        }),
      ],
    }));
  });

  it('queues existing prompts and generates more-like-existing prompts through the shared prompt queue stack', async () => {
    const props = buildProps(
      {},
      {
        generationSourceRef: { current: 'by-reference' },
        styleReferenceImageGeneration: 'https://cdn.example.com/reference.png',
      },
    );
    props.effects.aiGeneratePrompts = vi.fn().mockResolvedValue([
      { id: 'ai-2', text: 'Generated follow-up prompt', shortText: 'follow-up prompt' },
    ]);

    const { result } = renderHook(() => useFormSubmission(props));

    await act(async () => {
      await result.current.handleUseExistingPrompts();
    });

    await waitFor(() => {
      expect(props.effects.onGenerate).toHaveBeenCalledTimes(1);
    });

    expect(mocks.runTaskPlaceholder).toHaveBeenNthCalledWith(1, expect.objectContaining({
      context: 'useFormSubmission.queueExisting',
      expectedCount: 3,
      label: 'A cinematic shot',
    }));
    expect(props.effects.onGenerate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      imagesPerPrompt: 3,
      style_reference_image: 'https://cdn.example.com/reference.png',
      reference_mode: 'style',
    }));

    await act(async () => {
      await result.current.handleNewPromptsLikeExisting();
    });

    await waitFor(() => {
      expect(props.effects.setPrompts).toHaveBeenCalledWith([
        {
          id: 'ai-2',
          fullPrompt: 'Generated follow-up prompt',
          shortPrompt: 'follow-up prompt',
        },
      ]);
      expect(props.effects.onGenerate).toHaveBeenCalledTimes(2);
    });

    expect(mocks.runTaskPlaceholder).toHaveBeenNthCalledWith(2, expect.objectContaining({
      context: 'useFormSubmission.queueLikeExisting',
      expectedCount: 6,
      label: 'More like existing...',
    }));
    expect(props.effects.aiGeneratePrompts).toHaveBeenCalledWith(expect.objectContaining({
      overallPromptText: 'Make me more prompts like this.',
      numberToGenerate: 2,
      existingPrompts: [
        expect.objectContaining({
          id: 'prompt-1',
          text: 'A cinematic shot',
        }),
      ],
    }));
    expect(props.effects.onGenerate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      imagesPerPrompt: 3,
      style_reference_image: 'https://cdn.example.com/reference.png',
      prompts: [
        expect.objectContaining({
          fullPrompt: 'before, Generated follow-up prompt, after, dramatic lighting',
        }),
      ],
    }));
  });

  it('shows the automated validation toast when the master prompt is empty', async () => {
    const props = buildProps({
      effectivePromptMode: 'automated',
      masterPromptText: '   ',
    });
    const event = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    const { result } = renderHook(() => useFormSubmission(props));

    await act(async () => {
      await result.current.handleSubmit(event);
    });

    expect(mocks.toastError).toHaveBeenCalledWith('Please enter a master prompt.');
    expect(mocks.runTaskPlaceholder).not.toHaveBeenCalled();
    expect(props.effects.aiGeneratePrompts).not.toHaveBeenCalled();
    expect(props.effects.onGenerate).not.toHaveBeenCalled();
  });
});
