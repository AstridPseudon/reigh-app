import {
  createTask,
  generateRunId,
  validateRequiredFields,
  validateNonEmptyString,
  type TaskCreationResult,
  TaskValidationError,
} from '@/shared/lib/taskCreation';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { buildOrchestrationContract } from './orchestrationContract';
import { ensureShotParentGenerationId } from './shotParentGeneration';

interface CrossfadeJoinTaskInput {
  project_id: string;
  shot_id?: string;
  parent_generation_id?: string;
  clip_urls: string[];
  frame_overlap_settings_expanded: number[];
  audio_url?: string;
  tool_type?: string;
}

export async function createCrossfadeJoinTask(
  params: CrossfadeJoinTaskInput,
): Promise<TaskCreationResult> {
  try {
    validateRequiredFields(params, ['project_id', 'clip_urls', 'frame_overlap_settings_expanded']);

    if (params.clip_urls.length < 2) {
      throw new TaskValidationError('At least two clips are required to create a crossfade join', 'clip_urls');
    }

    if (params.frame_overlap_settings_expanded.length !== params.clip_urls.length - 1) {
      throw new TaskValidationError(
        'frame_overlap_settings_expanded must contain one entry per clip boundary',
        'frame_overlap_settings_expanded',
      );
    }

    params.clip_urls.forEach((clipUrl, index) => {
      validateNonEmptyString(clipUrl, `clip_urls[${index}]`, `Clip ${index + 1} URL`);
    });

    params.frame_overlap_settings_expanded.forEach((overlap, index) => {
      if (!Number.isFinite(overlap) || overlap <= 0) {
        throw new TaskValidationError(
          `Overlap at boundary ${index} must be a positive number`,
          'frame_overlap_settings_expanded',
        );
      }
    });

    const parentGenerationId = await ensureShotParentGenerationId({
      projectId: params.project_id,
      shotId: params.shot_id,
      parentGenerationId: params.parent_generation_id,
      context: 'CrossfadeJoin',
    });

    const runId = generateRunId();
    const orchestrationContract = buildOrchestrationContract({
      taskFamily: 'join_clips',
      runId,
      parentGenerationId,
      shotId: params.shot_id,
      generationRouting: 'variant_parent',
    });

    const fullOrchestratorPayload: Record<string, unknown> = {
      run_id: runId,
      shot_id: params.shot_id,
      parent_generation_id: parentGenerationId,
      clip_urls: params.clip_urls,
      frame_overlap_settings_expanded: params.frame_overlap_settings_expanded,
      ...(params.audio_url ? { audio_url: params.audio_url } : {}),
      ...(params.tool_type ? { tool_type: params.tool_type } : {}),
    };

    return await createTask({
      project_id: params.project_id,
      task_type: 'travel_stitch',
      params: {
        shot_id: params.shot_id,
        parent_generation_id: parentGenerationId,
        clip_urls: params.clip_urls,
        frame_overlap_settings_expanded: params.frame_overlap_settings_expanded,
        full_orchestrator_payload: fullOrchestratorPayload,
        orchestration_contract: orchestrationContract,
        ...(params.audio_url ? { audio_url: params.audio_url } : {}),
        ...(params.tool_type ? { tool_type: params.tool_type } : {}),
      },
    });
  } catch (error) {
    throw normalizeAndPresentError(error, { context: 'CrossfadeJoin', showToast: false });
  }
}

export type { CrossfadeJoinTaskInput };
