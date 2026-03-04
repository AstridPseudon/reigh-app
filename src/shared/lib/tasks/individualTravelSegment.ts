import {
  TaskValidationError,
  resolveProjectResolution,
} from '../taskCreation';
import type { TaskCreationResult } from '../taskCreation';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { ensureShotParentGenerationId } from './shotParentGeneration';
import { composeTaskRequest } from './taskRequestComposer';
import { runTaskCreationPipeline } from './taskCreatorPipeline';
import { asString, toRecordOrEmpty } from './taskParamParsers';
import { buildIndividualTravelSegmentParams } from './segmentTaskPayload';
import { MAX_SEGMENT_FRAMES } from './segmentStateResolvers';
import type { IndividualTravelSegmentParams } from './individualTravelSegmentTypes';

export type { IndividualTravelSegmentParams } from './individualTravelSegmentTypes';

/**
 * Validates individual travel segment parameters
 */
function validateIndividualTravelSegmentParams(params: IndividualTravelSegmentParams): void {
  const errors: string[] = [];

  if (!params.project_id) {
    errors.push('project_id is required');
  }

  if (!params.parent_generation_id && !params.shot_id) {
    errors.push('Either parent_generation_id or shot_id is required');
  }

  if (typeof params.segment_index !== 'number' || params.segment_index < 0) {
    errors.push('segment_index must be a non-negative number');
  }

  if (!params.start_image_url) {
    errors.push('start_image_url is required');
  }

  const numFrames = (
    typeof params.num_frames === 'number'
      ? params.num_frames
      : (typeof params.originalParams?.num_frames === 'number' ? params.originalParams.num_frames : undefined)
  ) ?? 49;

  if (numFrames > MAX_SEGMENT_FRAMES) {
    errors.push(`num_frames (${numFrames}) exceeds maximum of ${MAX_SEGMENT_FRAMES} frames per segment`);
  }

  if (errors.length > 0) {
    throw new TaskValidationError(errors.join(', '));
  }
}

/**
 * Creates an individual travel segment regeneration task
 */
export async function createIndividualTravelSegmentTask(
  params: IndividualTravelSegmentParams,
): Promise<TaskCreationResult> {
  return runTaskCreationPipeline({
    params,
    context: 'IndividualTravelSegment',
    validate: validateIndividualTravelSegmentParams,
    buildTaskRequest: async (requestParams) => {
      const supabase = getSupabaseClient();

      const effectiveParentGenerationId = await ensureShotParentGenerationId({
        projectId: requestParams.project_id,
        shotId: requestParams.shot_id,
        parentGenerationId: requestParams.parent_generation_id,
        context: 'IndividualTravelSegment',
      });

      let effectiveChildGenerationId = requestParams.child_generation_id;

      if (!effectiveChildGenerationId && effectiveParentGenerationId) {
        if (requestParams.pair_shot_generation_id) {
          const { data: childByPairId, error: pairIdError } = await supabase
            .from('generations')
            .select('id')
            .eq('parent_generation_id', effectiveParentGenerationId)
            .eq('pair_shot_generation_id', requestParams.pair_shot_generation_id)
            .limit(1)
            .maybeSingle();

          if (pairIdError) {
            throw new Error(
              `IndividualTravelSegment.lookupChildByPairId failed: ${pairIdError.message}`,
            );
          }

          if (childByPairId) {
            effectiveChildGenerationId = childByPairId.id;
          }
        }

        if (!effectiveChildGenerationId && requestParams.segment_index !== undefined && !requestParams.pair_shot_generation_id) {
          const { data: childByOrder, error: orderError } = await supabase
            .from('generations')
            .select('id')
            .eq('parent_generation_id', effectiveParentGenerationId)
            .eq('child_order', requestParams.segment_index)
            .limit(1)
            .maybeSingle();

          if (orderError) {
            throw new Error(
              `IndividualTravelSegment.lookupChildByOrder failed: ${orderError.message}`,
            );
          }

          if (childByOrder) {
            effectiveChildGenerationId = childByOrder.id;
          }
        }
      }

      const paramsWithIds = {
        ...requestParams,
        parent_generation_id: effectiveParentGenerationId,
        child_generation_id: effectiveChildGenerationId,
      };

      const directResolution = asString(requestParams.parsed_resolution_wh);
      const originalParams = toRecordOrEmpty(requestParams.originalParams);
      const originalOrchestratorDetails = toRecordOrEmpty(originalParams.orchestrator_details);
      const origResolutionValue =
        originalParams.parsed_resolution_wh ?? originalOrchestratorDetails.parsed_resolution_wh;
      const origResolution = directResolution
        ?? (typeof origResolutionValue === 'string' ? origResolutionValue : undefined);
      const { resolution: finalResolution } = await resolveProjectResolution(
        requestParams.project_id,
        origResolution,
      );

      const taskParams = buildIndividualTravelSegmentParams(paramsWithIds, finalResolution);

      return composeTaskRequest({
        source: requestParams,
        taskType: 'individual_travel_segment',
        params: taskParams,
      });
    },
  });
}
