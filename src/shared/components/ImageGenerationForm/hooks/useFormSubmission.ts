/**
 * useFormSubmission - Handles form submission and task creation
 *
 * Handles:
 * - Building task params from form state
 * - Automated mode (AI prompt generation → task creation)
 * - Managed mode (direct task creation)
 * - Fire-and-forget background operations
 */

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/components/ui/sonner';
import { handleError } from '@/shared/lib/errorHandler';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useIncomingTasks } from '@/shared/contexts/IncomingTasksContext';
import { BatchImageGenerationTaskParams } from '@/shared/lib/tasks/imageGeneration';
import {
  PromptEntry,
  HiresFixConfig,
  ReferenceApiParams,
  ReferenceMode,
  PromptMode,
  GenerationSource,
  TextToImageModel,
} from '../types';
import { buildBatchTaskParams } from './buildBatchTaskParams';

// ============================================================================
// Types
// ============================================================================

/** Snapshot of form state values needed for fire-and-forget async operations */
interface FormStateSnapshot {
  masterPromptText: string;
  imagesPerPrompt: number;
  promptMultiplier: number;
  selectedProjectId: string | undefined;
  associatedShotId: string | null;
  styleReferenceImageGeneration: string | null;
  styleReferenceStrength: number;
  subjectStrength: number;
  effectiveSubjectDescription: string;
  inThisScene: boolean;
  inThisSceneStrength: number;
  referenceMode: ReferenceMode;
  beforePromptText: string;
  afterPromptText: string;
  styleBoostTerms: string;
  isLocalGenerationEnabled: boolean;
  hiresFixConfig: HiresFixConfig;
}

// ============================================================================
// Helpers
// ============================================================================

/** Build reference params for by-reference mode, or empty object for just-text */
function buildReferenceParams(
  generationSource: GenerationSource,
  state: Pick<FormStateSnapshot, 'styleReferenceImageGeneration' | 'styleReferenceStrength' | 'subjectStrength' | 'effectiveSubjectDescription' | 'inThisScene' | 'inThisSceneStrength' | 'referenceMode'>,
): ReferenceApiParams {
  if (generationSource !== 'by-reference') return {};
  return {
    style_reference_image: state.styleReferenceImageGeneration ?? undefined,
    style_reference_strength: state.styleReferenceStrength,
    subject_strength: state.subjectStrength,
    subject_description: state.effectiveSubjectDescription,
    in_this_scene: state.inThisScene,
    in_this_scene_strength: state.inThisSceneStrength,
    reference_mode: state.referenceMode,
  };
}

interface UseFormSubmissionProps {
  // Project context
  selectedProjectId: string | undefined;

  // Form state
  prompts: PromptEntry[];
  imagesPerPrompt: number;
  promptMultiplier: number;
  associatedShotId: string | null;
  currentBeforePromptText: string;
  currentAfterPromptText: string;
  styleBoostTerms: string;
  isLocalGenerationEnabled: boolean;
  hiresFixConfig: HiresFixConfig;
  effectivePromptMode: PromptMode;
  masterPromptText: string;
  actionablePromptsCount: number;

  // Generation source
  generationSourceRef: React.MutableRefObject<GenerationSource>;
  selectedTextModelRef: React.MutableRefObject<TextToImageModel>;
  styleReferenceImageGeneration: string | null;

  // Reference settings
  styleReferenceStrength: number;
  subjectStrength: number;
  effectiveSubjectDescription: string;
  inThisScene: boolean;
  inThisSceneStrength: number;
  referenceMode: ReferenceMode;

  // AI prompt generation
  aiGeneratePrompts: (params: {
    overallPromptText: string;
    numberToGenerate: number;
    existingPrompts?: Array<{ id: string; text: string; shortText?: string }>;
    includeExistingContext?: boolean;
    addSummaryForNewPrompts?: boolean;
    replaceCurrentPrompts?: boolean;
    temperature?: number;
    rulesToRememberText?: string;
  }) => Promise<Array<{ id: string; text: string; shortText?: string }>>;

  // Callbacks
  onGenerate: (params: BatchImageGenerationTaskParams) => Promise<string[]> | string[] | void;
  setPrompts: (prompts: PromptEntry[] | ((prev: PromptEntry[]) => PromptEntry[])) => void;

  // Submit button state
  automatedSubmitButton: {
    trigger: () => void;
    isSubmitting: boolean;
    isSuccess: boolean;
  };
}

interface UseFormSubmissionReturn {
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleGenerateAndQueue: (updatedPrompts: PromptEntry[]) => void;
  handleUseExistingPrompts: () => Promise<void>;
  handleNewPromptsLikeExisting: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useFormSubmission(props: UseFormSubmissionProps): UseFormSubmissionReturn {
  const {
    selectedProjectId,
    prompts,
    imagesPerPrompt,
    promptMultiplier,
    associatedShotId,
    currentBeforePromptText,
    currentAfterPromptText,
    styleBoostTerms,
    isLocalGenerationEnabled,
    hiresFixConfig,
    effectivePromptMode,
    masterPromptText,
    actionablePromptsCount,
    generationSourceRef,
    selectedTextModelRef,
    styleReferenceImageGeneration,
    styleReferenceStrength,
    subjectStrength,
    effectiveSubjectDescription,
    inThisScene,
    inThisSceneStrength,
    referenceMode,
    aiGeneratePrompts,
    onGenerate,
    setPrompts,
    automatedSubmitButton,
  } = props;

  const queryClient = useQueryClient();
  const { addIncomingTask, completeIncomingTask } = useIncomingTasks();

  // Always-current ref for async access (avoids 18+ individual variable captures)
  const formStateRef = useRef<FormStateSnapshot>();
  useEffect(() => {
    formStateRef.current = {
      masterPromptText, imagesPerPrompt, promptMultiplier, selectedProjectId,
      associatedShotId, styleReferenceImageGeneration, styleReferenceStrength,
      subjectStrength, effectiveSubjectDescription, inThisScene,
      inThisSceneStrength, referenceMode, beforePromptText: currentBeforePromptText,
      afterPromptText: currentAfterPromptText, styleBoostTerms,
      isLocalGenerationEnabled, hiresFixConfig,
    };
  });

  // ============================================================================
  // Build Task Params
  // ============================================================================

  const getTaskParams = useCallback((
    promptsToUse: PromptEntry[],
    options?: { imagesPerPromptOverride?: number }
  ): BatchImageGenerationTaskParams | null => {
    const activePrompts = promptsToUse.filter(p => p.fullPrompt.trim() !== "");

    if (activePrompts.length === 0) {
      toast.error("Please enter at least one valid prompt.");
      return null;
    }

    const currentGenerationSource = generationSourceRef.current;
    const currentTextModel = selectedTextModelRef.current;

    // Validate: require style reference for by-reference mode
    if (currentGenerationSource === 'by-reference' && !styleReferenceImageGeneration) {
      toast.error("Please upload a style reference image for by-reference mode.");
      return null;
    }

    const referenceParams = buildReferenceParams(currentGenerationSource, {
      styleReferenceImageGeneration,
      styleReferenceStrength,
      subjectStrength,
      effectiveSubjectDescription,
      inThisScene,
      inThisSceneStrength,
      referenceMode,
    });

    return buildBatchTaskParams({
      projectId: selectedProjectId!,
      prompts: activePrompts,
      imagesPerPrompt: options?.imagesPerPromptOverride ?? imagesPerPrompt,
      shotId: associatedShotId,
      beforePromptText: currentBeforePromptText,
      afterPromptText: currentAfterPromptText,
      styleBoostTerms: styleBoostTerms,
      isLocalGenerationEnabled,
      hiresFixConfig,
      modelName: currentGenerationSource === 'just-text' ? currentTextModel : 'qwen-image',
      referenceParams,
    });
  }, [
    styleReferenceImageGeneration,
    styleReferenceStrength,
    subjectStrength,
    effectiveSubjectDescription,
    inThisScene,
    inThisSceneStrength,
    referenceMode,
    selectedProjectId,
    imagesPerPrompt,
    associatedShotId,
    currentBeforePromptText,
    currentAfterPromptText,
    styleBoostTerms,
    isLocalGenerationEnabled,
    hiresFixConfig,
    generationSourceRef,
    selectedTextModelRef,
  ]);

  // ============================================================================
  // Handle Submit
  // ============================================================================

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Snapshot form state from ref (always current, avoids stale captures)
    const state = formStateRef.current;
    if (!state) return;
    const currentGenerationSource = generationSourceRef.current;
    const currentTextModel = selectedTextModelRef.current;

    // Handle automated mode: generate prompts first, then images
    if (effectivePromptMode === 'automated') {
      if (!state.masterPromptText.trim()) {
        toast.error("Please enter a master prompt.");
        return;
      }

      // Validate early
      if (currentGenerationSource === 'by-reference' && !state.styleReferenceImageGeneration) {
        toast.error("Please upload a style reference image for by-reference mode.");
        return;
      }

      const modelName = currentGenerationSource === 'just-text' ? currentTextModel : 'qwen-image';

      // Trigger button state
      automatedSubmitButton.trigger();

      // Add incoming task filler
      const truncatedPrompt = state.masterPromptText.length > 50
        ? state.masterPromptText.substring(0, 50) + '...'
        : state.masterPromptText;
      const incomingTaskId = addIncomingTask({
        taskType: 'image_generation',
        label: truncatedPrompt,
        expectedCount: state.imagesPerPrompt * state.promptMultiplier,
        baselineCount: 0,
      });

      // Fire-and-forget background operation
      (async () => {
        try {
          const rawResults = await aiGeneratePrompts({
            overallPromptText: state.masterPromptText,
            numberToGenerate: state.imagesPerPrompt,
            includeExistingContext: false,
            addSummaryForNewPrompts: true,
            replaceCurrentPrompts: true,
            temperature: 0.8,
            rulesToRememberText: '',
          });

          const newPrompts: PromptEntry[] = rawResults.map(item => ({
            id: item.id,
            fullPrompt: item.text,
            shortPrompt: item.shortText || item.text.substring(0, 30) + (item.text.length > 30 ? "..." : ""),
          }));

          setPrompts(newPrompts);

          const referenceParams = buildReferenceParams(currentGenerationSource, state);

          const taskParams = buildBatchTaskParams({
            projectId: state.selectedProjectId!,
            prompts: newPrompts,
            imagesPerPrompt: state.promptMultiplier,
            shotId: state.associatedShotId,
            beforePromptText: state.beforePromptText,
            afterPromptText: state.afterPromptText,
            styleBoostTerms: state.styleBoostTerms,
            isLocalGenerationEnabled: state.isLocalGenerationEnabled,
            hiresFixConfig: state.hiresFixConfig,
            modelName,
            referenceParams,
          });

          await onGenerate(taskParams);
        } catch (error) {
          handleError(error, { context: 'useFormSubmission.handleSubmit.automatedMode', toastTitle: 'Failed to generate prompts. Please try again.' });
        } finally {
          await queryClient.refetchQueries({ queryKey: queryKeys.tasks.paginatedAll });
          await queryClient.refetchQueries({ queryKey: queryKeys.tasks.statusCountsAll });
          const newCount = queryClient.getQueryData<{ processing: number }>(queryKeys.tasks.statusCounts(state.selectedProjectId))?.processing ?? 0;
          completeIncomingTask(incomingTaskId, newCount);
        }
      })();

      return;
    }

    // Managed mode: use getTaskParams
    const taskParams = getTaskParams(prompts);
    if (!taskParams) return;

    automatedSubmitButton.trigger();

    // Add incoming task filler
    const firstPrompt = prompts.find(p => p.fullPrompt.trim())?.fullPrompt || 'Generating...';
    const truncatedPrompt = firstPrompt.length > 50
      ? firstPrompt.substring(0, 50) + '...'
      : firstPrompt;
    const incomingTaskId = addIncomingTask({
      taskType: 'image_generation',
      label: truncatedPrompt,
      expectedCount: actionablePromptsCount * state.imagesPerPrompt,
      baselineCount: 0,
    });

    // Fire-and-forget
    (async () => {
      try {
        await onGenerate(taskParams);
      } catch (error) {
        handleError(error, { context: 'useFormSubmission.handleSubmit.managedMode', toastTitle: 'Failed to create tasks. Please try again.' });
      } finally {
        await queryClient.refetchQueries({ queryKey: queryKeys.tasks.paginatedAll });
        await queryClient.refetchQueries({ queryKey: queryKeys.tasks.statusCountsAll });
        const newCount = queryClient.getQueryData<{ processing: number }>(queryKeys.tasks.statusCounts(state.selectedProjectId))?.processing ?? 0;
        completeIncomingTask(incomingTaskId, newCount);
      }
    })();
  }, [
    effectivePromptMode,
    automatedSubmitButton,
    addIncomingTask,
    aiGeneratePrompts,
    setPrompts,
    onGenerate,
    queryClient,
    completeIncomingTask,
    getTaskParams,
    prompts,
    actionablePromptsCount,
    generationSourceRef,
    selectedTextModelRef,
  ]);

  // ============================================================================
  // Handle Generate And Queue
  // ============================================================================

  const handleGenerateAndQueue = useCallback((updatedPrompts: PromptEntry[]) => {

    // Save prompts to state
    const seenIds = new Set<string>();
    const sanitizedPrompts = updatedPrompts.map(original => {
      let id = original.id && !seenIds.has(original.id) ? original.id : "";
      if (!id) {
        id = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      seenIds.add(id);
      return {
        ...original,
        id,
        shortPrompt: original.shortPrompt || (original.fullPrompt.substring(0, 30) + (original.fullPrompt.length > 30 ? "..." : "")),
      };
    });

    setPrompts(sanitizedPrompts);

    // Build task params
    const taskParams = getTaskParams(updatedPrompts);
    if (!taskParams) return;

    onGenerate(taskParams);
  }, [setPrompts, getTaskParams, onGenerate]);

  // ============================================================================
  // Handle Use Existing Prompts
  // ============================================================================

  const handleUseExistingPrompts = useCallback(async () => {
    const taskParams = getTaskParams(prompts, { imagesPerPromptOverride: promptMultiplier });
    if (!taskParams) return;
    onGenerate(taskParams);
  }, [prompts, promptMultiplier, getTaskParams, onGenerate]);

  // ============================================================================
  // Handle New Prompts Like Existing
  // ============================================================================

  const handleNewPromptsLikeExisting = useCallback(async () => {
    const activePrompts = prompts.filter(p => p.fullPrompt.trim() !== "");
    if (activePrompts.length === 0) {
      toast.error("No prompts available. Please add prompts first.");
      return;
    }

    if (generationSourceRef.current === 'by-reference' && !styleReferenceImageGeneration) {
      toast.error("Please upload a style reference image for by-reference mode.");
      return;
    }

    try {
      const rawResults = await aiGeneratePrompts({
        overallPromptText: "Make me more prompts like this.",
        numberToGenerate: imagesPerPrompt,
        existingPrompts: activePrompts.map(p => ({ id: p.id, text: p.fullPrompt, shortText: p.shortPrompt })),
        addSummaryForNewPrompts: true,
        replaceCurrentPrompts: true,
        temperature: 0.8,
        rulesToRememberText: '',
      });

      const newPrompts: PromptEntry[] = rawResults.map(item => ({
        id: item.id,
        fullPrompt: item.text,
        shortPrompt: item.shortText || item.text.substring(0, 30) + (item.text.length > 30 ? "..." : ""),
      }));

      setPrompts(newPrompts);

      const taskParams = getTaskParams(newPrompts, { imagesPerPromptOverride: promptMultiplier });
      if (!taskParams) return;

      onGenerate(taskParams);
    } catch (error) {
      handleError(error, { context: 'useFormSubmission.handleNewPromptsLikeExisting', toastTitle: 'Failed to generate prompts. Please try again.' });
    }
  }, [
    prompts,
    styleReferenceImageGeneration,
    generationSourceRef,
    imagesPerPrompt,
    promptMultiplier,
    getTaskParams,
    onGenerate,
    aiGeneratePrompts,
    setPrompts,
  ]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    handleSubmit,
    handleGenerateAndQueue,
    handleUseExistingPrompts,
    handleNewPromptsLikeExisting,
  };
}
