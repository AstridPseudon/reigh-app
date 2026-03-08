import { useCallback } from 'react';
import { toast } from '@/shared/components/ui/runtime/sonner';
import type { FormSubmissionEffects, GetTaskParams } from './types';
import type { RunIncomingTask } from './useIncomingTaskRunner';
import { toPromptEntries } from './promptSubmissionTransforms';
import type { SubmissionRuntimeContext } from './submissionContext';
import { queuePromptGenerationTask } from './queuePromptGenerationTask';

interface UsePromptQueueSubmissionInput {
  context: SubmissionRuntimeContext;
  getTaskParams: GetTaskParams;
  aiGeneratePrompts: FormSubmissionEffects['aiGeneratePrompts'];
  onGenerate: FormSubmissionEffects['onGenerate'];
  setPrompts: FormSubmissionEffects['setPrompts'];
  queueIncomingTask: (options: Parameters<RunIncomingTask>[0]) => void;
}

interface PromptQueueSubmissionCommands {
  queueExisting: () => void;
  queueLikeExisting: () => void;
}

export function usePromptQueueSubmission(
  input: UsePromptQueueSubmissionInput,
): PromptQueueSubmissionCommands {
  const { context, getTaskParams, aiGeneratePrompts, onGenerate, setPrompts, queueIncomingTask } = input;
  const {
    prompts,
    promptMultiplier,
    imagesPerPrompt,
    actionablePromptsCount,
    styleReferenceImageGeneration,
    generationSourceRef,
  } = context;

  const queueExisting = useCallback(() => {
    queuePromptGenerationTask({
      prompts,
      expectedCount: actionablePromptsCount * promptMultiplier,
      context: 'useFormSubmission.queueExisting',
      toastTitle: 'Failed to create tasks. Please try again.',
      getTaskParams,
      onGenerate,
      queueIncomingTask,
      imagesPerPromptOverride: promptMultiplier,
    });
  }, [
    actionablePromptsCount,
    getTaskParams,
    onGenerate,
    promptMultiplier,
    prompts,
    queueIncomingTask,
  ]);

  const queueLikeExisting = useCallback(() => {
    const activePrompts = prompts.filter((prompt) => prompt.fullPrompt.trim() !== '');
    if (activePrompts.length === 0) {
      toast.error('No prompts available. Please add prompts first.');
      return;
    }

    if (generationSourceRef.current === 'by-reference' && !styleReferenceImageGeneration) {
      toast.error('Please upload a style reference image for by-reference mode.');
      return;
    }

    queueIncomingTask({
      label: 'More like existing...',
      expectedCount: imagesPerPrompt * promptMultiplier,
      context: 'useFormSubmission.queueLikeExisting',
      toastTitle: 'Failed to generate prompts. Please try again.',
      execute: async () => {
        const rawResults = await aiGeneratePrompts({
          overallPromptText: 'Make me more prompts like this.',
          numberToGenerate: imagesPerPrompt,
          existingPrompts: activePrompts.map((prompt) => ({
            id: prompt.id,
            text: prompt.fullPrompt,
            shortText: prompt.shortPrompt,
            hidden: false,
          })),
          addSummaryForNewPrompts: true,
          replaceCurrentPrompts: true,
          temperature: 0.8,
          rulesToRememberText: '',
        });

        const newPrompts = toPromptEntries(rawResults);
        setPrompts(newPrompts);

        const taskParams = getTaskParams(newPrompts, { imagesPerPromptOverride: promptMultiplier });
        if (!taskParams) {
          return;
        }

        const result = await onGenerate(taskParams);
        return result || undefined;
      },
    });
  }, [
    aiGeneratePrompts,
    generationSourceRef,
    getTaskParams,
    imagesPerPrompt,
    onGenerate,
    promptMultiplier,
    prompts,
    queueIncomingTask,
    setPrompts,
    styleReferenceImageGeneration,
  ]);

  return {
    queueExisting,
    queueLikeExisting,
  };
}
