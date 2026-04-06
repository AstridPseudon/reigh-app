import type { ShotCreationResult } from './shotCreationTypes';
import type {
  CreateShotWithGenerationsRpcShotGeneration,
  CreateEmptyShotPathInput,
  CreateShotWithFilesPathInput,
  CreateShotWithGenerationPathInput,
  CreateShotWithGenerationsPathInput,
} from './shotCreationTypes';
import type { GenerationRow, Shot } from '@/domains/generation/types';
import { getSupabaseClient as supabase } from '@/integrations/supabase/client';
import { enqueueGenerationsInvalidation } from '@/shared/hooks/invalidation/useGenerationInvalidation';
import { getGenerationId } from '@/shared/lib/media/mediaTypeHelpers';
import { invalidateShotsQueries, upsertShotInCache } from '@/shared/hooks/shots/cacheUtils';

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function mapRpcShotGenerationToRow(
  shotGeneration: CreateShotWithGenerationsRpcShotGeneration,
): GenerationRow {
  const location = shotGeneration.location;
  const thumbnailUrl = shotGeneration.thumbnail_url ?? shotGeneration.location;

  return {
    id: shotGeneration.id,
    generation_id: shotGeneration.generation_id,
    shotImageEntryId: shotGeneration.id,
    shot_generation_id: shotGeneration.id,
    location,
    imageUrl: location ?? undefined,
    thumbUrl: thumbnailUrl ?? undefined,
    type: shotGeneration.type || 'image',
    created_at: shotGeneration.created_at,
    createdAt: shotGeneration.created_at,
    starred: shotGeneration.starred || false,
    name: shotGeneration.name,
    based_on: shotGeneration.based_on,
    params: toRecord(shotGeneration.params),
    timeline_frame: shotGeneration.timeline_frame,
    metadata: {},
    primary_variant_id: shotGeneration.primary_variant_id,
    position: Math.floor(shotGeneration.timeline_frame / 50),
  } as GenerationRow;
}

interface JoinedShotGenerationRecord {
  id: string;
  generation_id: string;
  timeline_frame: number | null;
  generations: {
    location: string | null;
    thumbnail_url: string | null;
    type: string | null;
    created_at: string;
    starred: boolean | null;
    name: string | null;
    based_on: string | null;
    params: unknown;
    primary_variant_id: string | null;
  } | Array<{
    location: string | null;
    thumbnail_url: string | null;
    type: string | null;
    created_at: string;
    starred: boolean | null;
    name: string | null;
    based_on: string | null;
    params: unknown;
    primary_variant_id: string | null;
  }> | null;
}

function mapJoinedShotGenerationToRow(
  shotGeneration: JoinedShotGenerationRecord,
): GenerationRow {
  const generation = Array.isArray(shotGeneration.generations)
    ? shotGeneration.generations[0]
    : shotGeneration.generations;

  if (!generation) {
    throw new Error('Shot creation hydration failed - missing joined generation');
  }

  const location = generation.location;
  const thumbnailUrl = generation.thumbnail_url ?? generation.location;

  return {
    id: shotGeneration.id,
    generation_id: shotGeneration.generation_id,
    shotImageEntryId: shotGeneration.id,
    shot_generation_id: shotGeneration.id,
    location,
    imageUrl: location ?? undefined,
    thumbUrl: thumbnailUrl ?? undefined,
    type: generation.type || 'image',
    created_at: generation.created_at,
    createdAt: generation.created_at,
    starred: generation.starred || false,
    name: generation.name,
    based_on: generation.based_on,
    params: toRecord(generation.params),
    timeline_frame: shotGeneration.timeline_frame,
    metadata: {},
    primary_variant_id: generation.primary_variant_id,
    position: shotGeneration.timeline_frame == null ? undefined : Math.floor(shotGeneration.timeline_frame / 50),
  } as GenerationRow;
}

function buildShotStats(images: GenerationRow[]) {
  const uniqueGenIds = new Set<string>();
  const unpositionedGenIds = new Set<string>();

  images.forEach((image) => {
    const generationId = getGenerationId(image);
    if (!generationId) {
      return;
    }

    uniqueGenIds.add(generationId);
    if (image.timeline_frame == null) {
      unpositionedGenIds.add(generationId);
    }
  });

  const unpositionedCount = unpositionedGenIds.size;

  return {
    imageCount: uniqueGenIds.size,
    positionedImageCount: uniqueGenIds.size - unpositionedCount,
    unpositionedImageCount: unpositionedCount,
    hasUnpositionedImages: unpositionedCount > 0,
  };
}

export async function createShotWithGenerationPath(
  input: CreateShotWithGenerationPathInput,
): Promise<ShotCreationResult> {
  const {
    selectedProjectId,
    shotName,
    generationId,
    queryClient,
    createShotWithGenerations,
  } = input;

  return createShotWithGenerationsPath({
    selectedProjectId,
    shotName,
    generationIds: [generationId],
    queryClient,
    createShotWithGenerations,
  });
}

export async function createShotWithFilesPath(
  input: CreateShotWithFilesPathInput,
): Promise<ShotCreationResult> {
  const {
    selectedProjectId,
    shotName,
    files,
    aspectRatio,
    shots,
    queryClient,
    onProgress,
    createShot,
    uploadToShot,
  } = input;

  const created = await createShot({
    name: shotName,
    projectId: selectedProjectId,
    aspectRatio: aspectRatio || undefined,
    shouldSelectAfterCreation: false,
  });

  const newShotId = created?.shot?.id;
  if (!newShotId) {
    throw new Error('Shot creation failed - no ID returned');
  }

  const uploadResult = await uploadToShot({
    imageFiles: files,
    targetShotId: newShotId,
    currentProjectQueryKey: selectedProjectId,
    currentShotCount: shots?.length ?? 0,
    onProgress,
  });

  if (!uploadResult?.shotId) {
    throw new Error('File upload failed - no images processed');
  }

  if (queryClient) {
    const { data: hydratedRows, error: hydratedRowsError } = await supabase().from('shot_generations')
      .select(`
        id,
        generation_id,
        timeline_frame,
        generations!inner(
          location,
          thumbnail_url,
          type,
          created_at,
          starred,
          name,
          based_on,
          params,
          primary_variant_id
        )
      `)
      .eq('shot_id', newShotId)
      .order('timeline_frame', { ascending: true });

    if (hydratedRowsError) {
      throw new Error(`Shot creation hydration failed: ${hydratedRowsError.message}`);
    }

    if (!hydratedRows?.length) {
      throw new Error('Shot creation hydration failed - no shot generations returned');
    }

    const images = hydratedRows.map((row) => mapJoinedShotGenerationToRow(row as JoinedShotGenerationRecord));
    const stats = buildShotStats(images);
    const shot: Shot = {
      ...created.shot,
      id: newShotId,
      name: created.shot?.name || shotName,
      project_id: created.shot?.project_id ?? selectedProjectId,
      position: created.shot?.position ?? shots?.length ?? 0,
      images,
      ...stats,
    };

    upsertShotInCache(queryClient, selectedProjectId, shot);

    enqueueGenerationsInvalidation(queryClient, newShotId, {
      reason: 'create-shot-with-files',
      scope: 'all',
      includeShots: false,
      projectId: selectedProjectId,
      includeProjectUnified: true,
    });

    invalidateShotsQueries(queryClient, selectedProjectId, { refetchType: 'inactive' });

    return {
      shotId: newShotId,
      shotName: shot.name,
      shot,
      generationIds: uploadResult.generationIds,
    };
  }

  return {
    shotId: newShotId,
    shotName: created.shot?.name || shotName,
    shot: created.shot,
    generationIds: uploadResult.generationIds,
  };
}

export async function createShotWithGenerationsPath(
  input: CreateShotWithGenerationsPathInput,
): Promise<ShotCreationResult> {
  const {
    selectedProjectId,
    shotName,
    generationIds,
    queryClient,
    createShotWithGenerations,
  } = input;

  const rpcResult = await createShotWithGenerations({
    projectId: selectedProjectId,
    shotName,
    generationIds,
  });

  if (!rpcResult?.shot_id) {
    throw new Error('Shot creation failed - no ID returned');
  }

  const images = rpcResult.shot_generations.map(mapRpcShotGenerationToRow);
  const stats = buildShotStats(images);
  const shot: Shot = {
    id: rpcResult.shot_id,
    name: rpcResult.shot_name,
    project_id: selectedProjectId,
    position: rpcResult.shot_position,
    images,
    ...stats,
  };

  upsertShotInCache(queryClient, selectedProjectId, shot);

  enqueueGenerationsInvalidation(queryClient, rpcResult.shot_id, {
    reason: 'create-shot-with-generations',
    scope: 'all',
    includeShots: false,
    projectId: selectedProjectId,
    includeProjectUnified: true,
  });

  invalidateShotsQueries(queryClient, selectedProjectId, { refetchType: 'inactive' });

  return {
    shotId: rpcResult.shot_id,
    shotName: rpcResult.shot_name || shotName,
    shot,
    generationIds,
  };
}

export async function createEmptyShotPath(
  input: CreateEmptyShotPathInput,
): Promise<ShotCreationResult> {
  const { selectedProjectId, shotName, aspectRatio, createShot } = input;

  const createResult = await createShot({
    name: shotName,
    projectId: selectedProjectId,
    aspectRatio: aspectRatio || undefined,
    shouldSelectAfterCreation: false,
  });

  if (!createResult?.shot?.id) {
    throw new Error('Shot creation failed - no ID returned');
  }

  return {
    shotId: createResult.shot.id,
    shotName: createResult.shot.name || shotName,
    shot: createResult.shot,
  };
}
