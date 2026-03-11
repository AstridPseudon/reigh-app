/**
 * Generation Mutations
 * ====================
 *
 * Mutation hooks for creating, updating, deleting, and starring generations.
 * Extracted from useProjectGenerations.ts to separate query and mutation concerns.
 *
 * ## Exports
 * - `useDeleteGeneration` — Delete a generation
 * - `useDeleteVariant` — Delete a variant from generation_variants
 * - `useUpdateGenerationLocation` — Update a generation's location/thumbnail
 * - `useCreateGeneration` — Create a new generation (external upload)
 * - `useToggleGenerationStar` — Star/unstar with optimistic updates
 *
 * @module useGenerationMutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Json } from '@/integrations/supabase/jsonTypes';
import {
  createExternalUploadGeneration,
  deleteGenerationInProject,
  deleteVariantInProject,
  updateGenerationLocationInProject,
  updateGenerationStarInProject,
  type ExternalUploadGenerationParams,
} from '@/integrations/supabase/repositories/generationMutationsRepository';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { dispatchAppEvent } from '@/shared/lib/typedEvents';
import {
  applyOptimisticGenerationStarUpdate,
  rollbackOptimisticGenerationStarUpdate,
} from '@/shared/hooks/invalidation/generationStarCacheCoordinator';
import type { GenerationRow } from '@/domains/generation/types';
import type { GenerationRowDto } from '@/domains/generation/types/generationRowDto';

// ===== Helper Functions (internal) =====

interface ScopedGenerationInput {
  id: string;
  projectId: string;
}

interface ScopedVariantInput {
  id: string;
  projectId: string;
}

interface CreateGenerationInput {
  imageUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  projectId: string;
  prompt: string;
  thumbnailUrl?: string;
  resolution?: string;
  aspectRatio?: string;
}

function buildExternalUploadGenerationParams(input: CreateGenerationInput): ExternalUploadGenerationParams {
  return {
    prompt: input.prompt,
    extra: {
      source: 'external_upload',
      original_filename: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize,
    },
    ...(input.resolution ? { resolution: input.resolution } : {}),
    ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
  };
}

function mapCreatedGenerationRow(dto: GenerationRowDto & { params?: Json | null }): GenerationRow {
  return {
    id: dto.id,
    generation_id: dto.generation_id,
    location: dto.location ?? null,
    type: dto.type ?? null,
    createdAt: dto.createdAt ?? dto.created_at,
    metadata: dto.metadata ?? null,
    name: dto.name ?? null,
    timeline_frame: dto.timeline_frame ?? null,
    starred: dto.starred,
    based_on: dto.based_on ?? null,
    params: (dto.params ?? undefined) as GenerationRow['params'],
    parent_generation_id: dto.parent_generation_id ?? null,
    is_child: dto.is_child,
    child_order: dto.child_order ?? null,
    pair_shot_generation_id: dto.pair_shot_generation_id ?? null,
    primary_variant_id: dto.primary_variant_id ?? null,
    source_task_id: dto.source_task_id ?? null,
  };
}

/**
 * Update generation location via the scoped repository adapter.
 * @internal Used by useUpdateGenerationLocation hook.
 */
async function updateGenerationLocation(
  params: ScopedGenerationInput & { location: string; thumbUrl?: string },
): Promise<void> {
  await updateGenerationLocationInProject({
    id: params.id,
    projectId: params.projectId,
    location: params.location,
    thumbnailUrl: params.thumbUrl,
  });
}

/**
 * Create a new generation via the repository boundary.
 * @internal Used by useCreateGeneration hook.
 */
async function createGeneration(params: CreateGenerationInput): Promise<GenerationRow> {
  const generationParams = buildExternalUploadGenerationParams(params);

  const data = await createExternalUploadGeneration({
    imageUrl: params.imageUrl,
    thumbnailUrl: params.thumbnailUrl || params.imageUrl,
    fileType: params.fileType || 'image',
    projectId: params.projectId,
    generationParams,
  });

  return mapCreatedGenerationRow(data as GenerationRowDto & { params?: Json | null });
}

/**
 * Star/unstar a generation via the scoped repository adapter.
 * @internal Used by useToggleGenerationStar hook.
 */
async function toggleGenerationStar(params: ScopedGenerationInput & { starred: boolean }): Promise<void> {
  await updateGenerationStarInProject(params);
}

// ===== Mutation Hooks =====

/**
 * Delete a generation with project-scoped verification.
 */
async function deleteGenerationScoped(input: ScopedGenerationInput): Promise<void> {
  await deleteGenerationInProject(input);
}

/**
 * Delete a variant with project-scoped verification via its parent generation.
 */
async function deleteVariantScoped(input: ScopedVariantInput): Promise<void> {
  await deleteVariantInProject(input);
}

export function useDeleteGeneration() {
  return useMutation({
    mutationFn: deleteGenerationScoped,
    onError: (error: Error) => {
      normalizeAndPresentError(error, {
        context: 'useDeleteGeneration',
        toastTitle: 'Failed to delete generation',
      });
    },
  });
}

/**
 * Delete a variant from generation_variants table.
 * Use this for edit tools (edit-images, edit-video, character-animate) that create variants.
 */
export function useDeleteVariant() {
  return useMutation({
    mutationFn: deleteVariantScoped,
    onError: (error: Error) => {
      normalizeAndPresentError(error, {
        context: 'useDeleteVariant',
        toastTitle: 'Failed to delete variant',
      });
    },
  });
}

export function useUpdateGenerationLocation() {
  return useMutation({
    mutationFn: ({ id, location, thumbUrl, projectId }: { id: string; location: string; thumbUrl?: string; projectId: string }) => {
      return updateGenerationLocation({ id, location, thumbUrl, projectId });
    },
    onError: (error: Error) => {
      normalizeAndPresentError(error, { context: 'useUpdateGenerationLocation', toastTitle: 'Failed to update generation' });
    },
  });
}

export function useCreateGeneration() {
  return useMutation({
    mutationFn: createGeneration,
    onError: (error: Error) => {
      normalizeAndPresentError(error, { context: 'useCreateGeneration', toastTitle: 'Failed to create generation' });
    },
  });
}

export function useToggleGenerationStar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, starred, projectId }: { id: string; starred: boolean; projectId: string; shotId?: string }) => {
      return toggleGenerationStar({ id, starred, projectId });
    },
    onMutate: async ({ id, starred, shotId }) => {
      return applyOptimisticGenerationStarUpdate(queryClient, {
        generationId: id,
        starred,
        shotId,
      });
    },
    onError: (error: Error, _variables, context) => {
      rollbackOptimisticGenerationStarUpdate(queryClient, context);
      normalizeAndPresentError(error, { context: 'useToggleGenerationStar', toastTitle: 'Failed to toggle star' });
    },
    onSuccess: (_data, variables) => {
      // Emit custom event so Timeline knows to refetch star data
      if (variables.shotId) {
        dispatchAppEvent('generation-star-updated', {
          generationId: variables.id, shotId: variables.shotId!, starred: variables.starred,
        });
      }
    },
  });
}
