import {
  resolveProjectResolution,
  generateTaskId,
  generateRunId,
  createTask,
} from "../../taskCreation";
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/shared/lib/errorHandler';
import type { TravelBetweenImagesTaskParams, TravelBetweenImagesTaskResult } from './types';
import { DEFAULT_TRAVEL_BETWEEN_IMAGES_VALUES } from './defaults';
import { validateTravelBetweenImagesParams, buildTravelBetweenImagesPayload } from './payloadBuilder';

/**
 * Creates a travel between images task using the unified approach.
 * This replaces the direct call to the steerable-motion edge function.
 *
 * @param params - Travel between images task parameters
 * @returns Promise resolving to the created task and parent generation ID
 */
export async function createTravelBetweenImagesTask(params: TravelBetweenImagesTaskParams): Promise<TravelBetweenImagesTaskResult> {
  console.log("[EnhancePromptDebug] Creating task with params:", params);
  console.log("[EnhancePromptDebug] enhance_prompt parameter received:", {
    enhance_prompt: params.enhance_prompt,
    default_enhance_prompt: DEFAULT_TRAVEL_BETWEEN_IMAGES_VALUES.enhance_prompt,
    will_be_set_to: params.enhance_prompt ?? DEFAULT_TRAVEL_BETWEEN_IMAGES_VALUES.enhance_prompt
  });

  try {
    // 1. Validate parameters
    validateTravelBetweenImagesParams(params);

    // 2. Resolve project resolution
    const { resolution: finalResolution } = await resolveProjectResolution(
      params.project_id,
      params.resolution
    );

    // 3. Generate IDs for orchestrator payload (not for database)
    const orchestratorTaskId = generateTaskId("sm_travel_orchestrator");
    const runId = generateRunId();

    // 4. Ensure we have a parent_generation_id (create placeholder if needed)
    // This ensures the parent generation exists BEFORE segments start completing
    let effectiveParentGenerationId = params.parent_generation_id;

    // [ParentReuseDebug] Log parent ID handling
    console.log('[ParentReuseDebug] === createTravelBetweenImagesTask ===');
    console.log('[ParentReuseDebug] params.parent_generation_id:', params.parent_generation_id?.substring(0, 8) || 'undefined');
    console.log('[ParentReuseDebug] params.shot_id:', params.shot_id?.substring(0, 8) || 'undefined');

    if (!effectiveParentGenerationId && params.shot_id) {
      console.log("[ParentReuseDebug] No parent_generation_id provided, WILL CREATE NEW placeholder parent");

      // Create a placeholder parent generation
      const newParentId = crypto.randomUUID();
      const placeholderParams = {
        tool_type: 'travel-between-images',
        created_from: 'travel_orchestrator_upfront',
        // Include basic orchestrator_details structure so it shows in segment outputs
        orchestrator_details: {
          num_new_segments_to_generate: Math.max(1, params.image_urls.length - 1),
          input_image_paths_resolved: params.image_urls,
          shot_id: params.shot_id,
        },
        // Include generation name if provided
        ...(params.generation_name ? { generation_name: params.generation_name } : {}),
      };

      const { data: newParent, error: parentError } = await supabase
        .from('generations')
        .insert({
          id: newParentId,
          project_id: params.project_id,
          type: 'video',
          is_child: false,
          location: null, // Placeholder - no video yet
          params: placeholderParams,
          name: params.generation_name || null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (parentError) {
        console.error("[createTravelBetweenImagesTask] Error creating placeholder parent:", parentError);
        throw new Error(`Failed to create placeholder parent generation: ${parentError.message}`);
      }

      console.log("[ParentReuseDebug] Created NEW placeholder parent:", newParentId.substring(0, 8));
      effectiveParentGenerationId = newParentId;

      // Link the parent to the shot using the RPC
      try {
        const { error: linkError } = await supabase.rpc('add_generation_to_shot', {
          p_shot_id: params.shot_id,
          p_generation_id: newParentId,
          p_with_position: false // Parent videos don't get timeline positions
        });

        if (linkError) {
          console.error("[createTravelBetweenImagesTask] Error linking parent to shot:", linkError);
          // Don't throw - the generation was created, just not linked
        } else {
          console.log("[createTravelBetweenImagesTask] Linked parent to shot:", params.shot_id);
        }
      } catch (linkErr) {
        console.error("[createTravelBetweenImagesTask] Exception linking parent to shot:", linkErr);
        // Don't throw - the generation was created, just not linked
      }
    } else if (effectiveParentGenerationId) {
      console.log("[ParentReuseDebug] REUSING existing parent_generation_id:", effectiveParentGenerationId.substring(0, 8));
    } else {
      console.log("[ParentReuseDebug] No parent_generation_id and no shot_id - segments will not have parent");
    }

    // [ParentReuseDebug] Summary
    console.log('[ParentReuseDebug] FINAL effectiveParentGenerationId:', effectiveParentGenerationId?.substring(0, 8) || 'undefined');

    // 5. Build orchestrator payload (now includes parent_generation_id)
    const orchestratorPayload = buildTravelBetweenImagesPayload(
      params,
      finalResolution,
      orchestratorTaskId,
      runId,
      effectiveParentGenerationId
    );

    // 6. Determine task type based on turbo mode
    const isTurboMode = params.turbo_mode === true;
    const taskType = isTurboMode ? 'wan_2_2_i2v' : 'travel_orchestrator';

    console.log("[createTravelBetweenImagesTask] Task type determination:", {
      modelName: params.model_name,
      turboMode: isTurboMode,
      taskType,
      parentGenerationId: effectiveParentGenerationId?.substring(0, 8)
    });

    // Create task using unified create-task function (no task_id - let DB auto-generate)
    const result = await createTask({
      project_id: params.project_id,
      task_type: taskType,
      params: {
        tool_type: 'travel-between-images', // Override tool_type for proper generation tagging
        orchestrator_details: orchestratorPayload,
        // Also store parent_generation_id at top level for easy access
        ...(effectiveParentGenerationId ? { parent_generation_id: effectiveParentGenerationId } : {}),
        // Also store at top level for direct access by worker (not just in orchestrator_details)
        ...(params.generation_name ? { generation_name: params.generation_name } : {}),
      }
    });

    console.log("[createTravelBetweenImagesTask] Task created successfully:", result);
    console.log('[ParentReuseDebug] === createTravelBetweenImagesTask RETURN ===');
    console.log('[ParentReuseDebug] Returning parentGenerationId:', effectiveParentGenerationId?.substring(0, 8) || 'undefined');
    return {
      task: result,
      parentGenerationId: effectiveParentGenerationId,
    };

  } catch (error) {
    handleError(error, { context: 'TravelBetweenImages', showToast: false });
    throw error;
  }
}
