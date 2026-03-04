import { GenerationRow } from '@/domains/generation/types';
import { ExpectedSegmentData, RawGenerationDbRow } from './segmentOutputTypes';

export function extractExpectedSegmentData(
  parentParams: Record<string, unknown> | null,
): ExpectedSegmentData | null {
  if (!parentParams) {
    return null;
  }

  const orchestratorDetails = parentParams.orchestrator_details as Record<string, unknown> | undefined;
  if (!orchestratorDetails) {
    return null;
  }

  const segmentCount = (orchestratorDetails.num_new_segments_to_generate as number)
    || (orchestratorDetails.segment_frames_expanded as unknown[] | undefined)?.length
    || 0;

  if (segmentCount === 0) {
    return null;
  }

  return {
    count: segmentCount,
    frames: (orchestratorDetails.segment_frames_expanded as number[]) || [],
    prompts: (orchestratorDetails.enhanced_prompts_expanded as string[])
      || (orchestratorDetails.base_prompts_expanded as string[])
      || [],
    inputImages: (orchestratorDetails.input_image_paths_resolved as string[]) || [],
    inputImageGenIds: (orchestratorDetails.input_image_generation_ids as string[]) || [],
    pairShotGenIds: (orchestratorDetails.pair_shot_generation_ids as string[]) || [],
  };
}

export function getPairIdentifiers(
  generation: { pair_shot_generation_id?: string | null } | null,
  params: Record<string, unknown> | null,
): { pairShotGenId?: string; startGenId?: string } {
  const columnValue = generation?.pair_shot_generation_id;
  if (!columnValue) {
    return {};
  }

  const individualParams = params?.individual_segment_params as Record<string, unknown> | undefined;
  return {
    pairShotGenId: columnValue,
    startGenId: (individualParams?.start_image_generation_id || params?.start_image_generation_id) as string | undefined,
  };
}

export function isSegmentGeneration(params: Record<string, unknown> | null): boolean {
  return typeof params?.segment_index === 'number';
}

export function transformToGenerationRow(gen: RawGenerationDbRow): GenerationRow {
  const createdAt = gen.updated_at || gen.created_at || new Date().toISOString();
  const location = gen.location || '';

  return {
    id: gen.id,
    location,
    imageUrl: location,
    thumbUrl: gen.thumbnail_url || location,
    type: gen.type || 'video',
    created_at: createdAt,
    createdAt,
    params: gen.params as GenerationRow['params'],
    parent_generation_id: gen.parent_generation_id,
    child_order: gen.child_order,
    starred: gen.starred,
    pair_shot_generation_id: gen.pair_shot_generation_id,
  };
}
