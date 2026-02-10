/**
 * submitSegmentTask - Shared segment task submission logic
 *
 * Extracts the duplicated ~200-line handleSubmit pattern from
 * SegmentRegenerateForm and SegmentSlotFormView into a single function.
 *
 * Both callers follow the same pattern:
 *   1. Validate inputs
 *   2. Add incoming task placeholder (for optimistic UI)
 *   3. Optionally enhance prompt via edge function
 *   4. Save enhanced prompt metadata
 *   5. Build task params
 *   6. Create the task
 *   7. Cleanup (refetch, remove placeholder)
 */

import { QueryClient } from '@tanstack/react-query';
import { handleError } from '@/shared/lib/errorHandler';
import { buildTaskParams } from '@/shared/components/segmentSettingsUtils';
import { createIndividualTravelSegmentTask } from '@/shared/lib/tasks/individualTravelSegment';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/shared/lib/queryKeys';
import type { StructureVideoConfig } from '@/shared/lib/tasks/travelBetweenImages';

// ============================================================================
// Structure Video Config Builder (shared between SegmentRegenerateForm & SegmentSlotFormView)
// ============================================================================

interface StructureVideoInputs {
  structureVideoUrl?: string;
  structureVideoType?: 'uni3c' | 'flow' | 'canny' | 'depth' | null;
  structureVideoFrameRange?: {
    segmentStart: number;
    segmentEnd: number;
    videoTotalFrames: number;
    videoFps: number;
  };
  structureVideoDefaults?: {
    motionStrength: number;
    treatment: 'adjust' | 'clip';
    uni3cEndPercent: number;
  } | null;
}

/**
 * Build a StructureVideoConfig from structure video props + effective settings.
 * Returns null when required fields are missing.
 */
export function buildStructureVideoForTask(
  inputs: StructureVideoInputs,
  getSettingsForTaskCreation: () => { structureTreatment?: string; structureMotionStrength?: number; structureUni3cEndPercent?: number; [key: string]: unknown },
): StructureVideoConfig | null {
  const { structureVideoUrl, structureVideoType, structureVideoFrameRange, structureVideoDefaults } = inputs;
  if (!structureVideoUrl || !structureVideoType || !structureVideoFrameRange) {
    return null;
  }

  const effectiveSettings = getSettingsForTaskCreation();
  return {
    path: structureVideoUrl,
    start_frame: structureVideoFrameRange.segmentStart,
    end_frame: structureVideoFrameRange.segmentEnd,
    structure_type: structureVideoType,
    treatment: effectiveSettings.structureTreatment ?? structureVideoDefaults?.treatment ?? 'adjust',
    motion_strength: effectiveSettings.structureMotionStrength ?? structureVideoDefaults?.motionStrength ?? 1.2,
    uni3c_end_percent: effectiveSettings.structureUni3cEndPercent ?? structureVideoDefaults?.uni3cEndPercent ?? 0.1,
  };
}

// ============================================================================
// Segment Task Submission
// ============================================================================

/** Settings from getSettingsForTaskCreation() */
interface EffectiveSettings {
  prompt?: string;
  negativePrompt?: string;
  numFrames?: number;
  textBeforePrompts?: string;
  textAfterPrompts?: string;
  structureTreatment?: string;
  structureMotionStrength?: number;
  structureUni3cEndPercent?: number;
  makePrimaryVariant?: boolean;
  [key: string]: unknown;
}

/** Image context for the segment task */
interface SegmentTaskImageContext {
  startImageUrl?: string;
  endImageUrl?: string;
  startImageGenerationId?: string;
  endImageGenerationId?: string;
  startImageVariantId?: string;
  endImageVariantId?: string;
}

/** Task creation context */
interface SegmentTaskContext {
  projectId: string;
  shotId?: string;
  generationId?: string;
  childGenerationId?: string;
  segmentIndex: number;
  pairShotGenerationId?: string;
  projectResolution?: string;
  structureVideo: StructureVideoConfig | null;
}

/** Submission configuration */
interface SubmitSegmentTaskInput {
  /** Label for the incoming task placeholder (e.g. "Segment 3") */
  taskLabel: string;
  /** Component name for error context (e.g. "SegmentRegenerateForm") */
  errorContext: string;
  /** Get effective settings from the form hook */
  getSettings: () => EffectiveSettings;
  /** Save persisted settings before task creation */
  saveSettings: () => Promise<void>;
  /** Whether to save settings (requires pairShotGenerationId) */
  shouldSaveSettings: boolean;
  /** Current enhance prompt ref value */
  shouldEnhance: boolean;
  /** Enhanced prompt already available from the form */
  enhancedPrompt?: string;
  /** Default num frames for enhancement */
  defaultNumFrames: number;
  /** Image context */
  images: SegmentTaskImageContext;
  /** Task context */
  task: SegmentTaskContext;
  /** Incoming tasks API */
  addIncomingTask: (opts: { taskType: string; label: string }) => string;
  removeIncomingTask: (id: string) => void;
  /** React Query client for invalidation */
  queryClient: QueryClient;
  /** Optional callback when generation starts (for optimistic UI) */
  onGenerateStarted?: () => void;
}

/**
 * Submit a segment task, handling both enhanced and standard prompt paths.
 * Returns immediately after adding the incoming task placeholder.
 * The actual task creation runs in the background (fire-and-forget).
 */
export function submitSegmentTask(input: SubmitSegmentTaskInput): void {
  const {
    taskLabel,
    errorContext,
    getSettings,
    saveSettings,
    shouldSaveSettings,
    shouldEnhance,
    enhancedPrompt,
    defaultNumFrames,
    images,
    task,
    addIncomingTask,
    removeIncomingTask,
    queryClient,
    onGenerateStarted,
  } = input;

  const effectiveSettings = getSettings();
  const promptToEnhance = enhancedPrompt?.trim() || effectiveSettings.prompt?.trim() || '';

  // Add placeholder for immediate feedback
  const incomingTaskId = addIncomingTask({
    taskType: 'individual_travel_segment',
    label: taskLabel,
  });

  // Notify parent for optimistic UI
  onGenerateStarted?.();

  // Build the task params builder closure (shared between both paths)
  const buildParams = (prompt: string, enhancedPromptParam?: string) => {
    return buildTaskParams(
      { ...effectiveSettings, prompt },
      {
        projectId: task.projectId,
        shotId: task.shotId,
        generationId: task.generationId,
        childGenerationId: task.childGenerationId,
        segmentIndex: task.segmentIndex,
        startImageUrl: images.startImageUrl,
        endImageUrl: images.endImageUrl,
        startImageGenerationId: images.startImageGenerationId,
        endImageGenerationId: images.endImageGenerationId,
        startImageVariantId: images.startImageVariantId,
        endImageVariantId: images.endImageVariantId,
        pairShotGenerationId: task.pairShotGenerationId,
        projectResolution: task.projectResolution,
        ...(enhancedPromptParam ? { enhancedPrompt: enhancedPromptParam } : {}),
        structureVideo: task.structureVideo,
      }
    );
  };

  const cleanup = async () => {
    await queryClient.refetchQueries({ queryKey: queryKeys.tasks.paginatedAll });
    await queryClient.refetchQueries({ queryKey: queryKeys.tasks.statusCountsAll });
    removeIncomingTask(incomingTaskId);
  };

  // Fire and forget - run in background
  if (shouldEnhance && promptToEnhance) {
    // Enhanced prompt path
    (async () => {
      try {
        if (shouldSaveSettings) await saveSettings();

        // 1. Enhance prompt via edge function
        const { data: enhanceResult, error: enhanceError } = await supabase.functions.invoke('ai-prompt', {
          body: {
            task: 'enhance_segment_prompt',
            prompt: promptToEnhance,
            temperature: 0.7,
            numFrames: effectiveSettings.numFrames || defaultNumFrames,
          },
        });

        if (enhanceError) {
          handleError(enhanceError, { context: errorContext });
        }

        const enhancedPromptResult = enhanceResult?.enhanced_prompt?.trim() || promptToEnhance;

        // 2. Apply before/after text
        const beforeText = effectiveSettings.textBeforePrompts?.trim() || '';
        const afterText = effectiveSettings.textAfterPrompts?.trim() || '';
        const originalPromptWithPrefixes = [beforeText, effectiveSettings.prompt?.trim() || '', afterText].filter(Boolean).join(' ');
        const enhancedPromptWithPrefixes = [beforeText, enhancedPromptResult, afterText].filter(Boolean).join(' ');

        // 3. Store enhanced prompt in metadata
        if (task.pairShotGenerationId && enhancedPromptResult !== promptToEnhance) {
          const { data: current, error: fetchError } = await supabase
            .from('shot_generations')
            .select('metadata')
            .eq('id', task.pairShotGenerationId)
            .single();

          if (!fetchError) {
            const currentMetadata = (current?.metadata as Record<string, unknown>) || {};
            const { error: updateError } = await supabase
              .from('shot_generations')
              .update({
                metadata: {
                  ...currentMetadata,
                  enhanced_prompt: enhancedPromptResult,
                  base_prompt_for_enhancement: effectiveSettings.prompt?.trim() || '',
                },
              })
              .eq('id', task.pairShotGenerationId);

            if (updateError) {
              handleError(updateError, { context: 'submitSegmentTask.saveEnhancedPrompt' });
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.segments.pairMetadata(task.pairShotGenerationId) });
          } else {
            handleError(fetchError, { context: 'submitSegmentTask.fetchMetadata' });
          }
        }

        // 4. Build & create task
        const taskParams = buildParams(originalPromptWithPrefixes, enhancedPromptWithPrefixes);
        const result = await createIndividualTravelSegmentTask(taskParams);
        if (!result.task_id) throw new Error(result.error || 'Failed to create task');

      } catch (error) {
        handleError(error, { context: errorContext, toastTitle: 'Failed to create task' });
      } finally {
        await cleanup();
      }
    })();
  } else {
    // Standard submission (no enhancement)
    (async () => {
      try {
        if (shouldSaveSettings) await saveSettings();

        // Apply before/after text
        const beforeText = effectiveSettings.textBeforePrompts?.trim() || '';
        const afterText = effectiveSettings.textAfterPrompts?.trim() || '';
        const basePrompt = effectiveSettings.prompt?.trim() || '';
        const finalPrompt = [beforeText, basePrompt, afterText].filter(Boolean).join(' ');

        const taskParams = buildParams(finalPrompt);
        const result = await createIndividualTravelSegmentTask(taskParams);
        if (!result.task_id) throw new Error(result.error || 'Failed to create task');

      } catch (error) {
        handleError(error, { context: errorContext, toastTitle: 'Failed to create task' });
      } finally {
        await cleanup();
      }
    })();
  }
}
