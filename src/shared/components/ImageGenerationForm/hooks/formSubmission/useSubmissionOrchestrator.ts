import { useCallback } from 'react';
import type { FormSubmissionEffects, FormSubmissionFormState, GetTaskParams } from './types';
import type { RunIncomingTask } from './useIncomingTaskRunner';
import { sanitizePrompts } from './promptSubmissionTransforms';
import type { SubmissionRuntimeContext } from './submissionContext';
import { useAutomatedPromptSubmission } from './useAutomatedPromptSubmission';
import { usePromptQueueSubmission } from './usePromptQueueSubmission';
import { queuePromptGenerationTask } from './queuePromptGenerationTask';

interface SubmissionOrchestratorEffects {
  automatedSubmitButton: FormSubmissionEffects['automatedSubmitButton'];
  aiGeneratePrompts: FormSubmissionEffects['aiGeneratePrompts'];
  onGenerate: FormSubmissionEffects['onGenerate'];
  setPrompts: FormSubmissionEffects['setPrompts'];
  getTaskParams: GetTaskParams;
  runIncomingTask: RunIncomingTask;
}

interface UseSubmissionOrchestratorInput {
  context: SubmissionRuntimeContext;
  effects: SubmissionOrchestratorEffects;
}

export interface SubmissionOrchestratorCommands {
  submitManaged: () => void;
  submitAutomated: () => void;
  queueExisting: () => void;
  queueLikeExisting: () => void;
  generateAndSubmit: (updatedPrompts: FormSubmissionFormState['prompts']) => void;
}

export function useSubmissionOrchestrator(
  input: UseSubmissionOrchestratorInput,
): SubmissionOrchestratorCommands {
  const { context, effects } = input;
  const {
    prompts,
    actionablePromptsCount,
    formStateRef,
  } = context;
  const {
    automatedSubmitButton,
    aiGeneratePrompts,
    onGenerate,
    setPrompts,
    getTaskParams,
    runIncomingTask,
  } = effects;

  const queueIncomingTask = useCallback((options: Parameters<RunIncomingTask>[0]) => {
    automatedSubmitButton.trigger();
    runIncomingTask(options);
  }, [automatedSubmitButton, runIncomingTask]);

  const generateAndSubmit = useCallback((updatedPrompts: FormSubmissionFormState['prompts']) => {
    const sanitizedPrompts = sanitizePrompts(updatedPrompts);
    setPrompts(sanitizedPrompts);

    const taskParams = getTaskParams(sanitizedPrompts);
    if (!taskParams) {
      return;
    }

    void onGenerate(taskParams);
  }, [getTaskParams, onGenerate, setPrompts]);

  const submitManaged = useCallback(() => {
    const state = formStateRef.current;
    if (!state) {
      return;
    }

    queuePromptGenerationTask({
      prompts,
      expectedCount: actionablePromptsCount * state.imagesPerPrompt,
      context: 'useFormSubmission.submitManaged',
      toastTitle: 'Failed to create tasks. Please try again.',
      getTaskParams,
      onGenerate,
      queueIncomingTask,
    });
  }, [
    actionablePromptsCount,
    formStateRef,
    getTaskParams,
    onGenerate,
    prompts,
    queueIncomingTask,
  ]);

  const submitAutomated = useAutomatedPromptSubmission({
    context,
    aiGeneratePrompts,
    onGenerate,
    setPrompts,
    queueIncomingTask,
  });

  const {
    queueExisting,
    queueLikeExisting,
  } = usePromptQueueSubmission({
    context,
    getTaskParams,
    aiGeneratePrompts,
    onGenerate,
    setPrompts,
    queueIncomingTask,
  });

  return {
    submitManaged,
    submitAutomated,
    queueExisting,
    queueLikeExisting,
    generateAndSubmit,
  };
}
