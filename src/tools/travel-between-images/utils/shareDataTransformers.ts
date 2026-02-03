/**
 * Utility functions for transforming share page data to match component expectations.
 *
 * These transformers ensure the RPC response data is shaped correctly for
 * components that normally receive data from hooks like useShotImages.
 *
 * IMPORTANT: If hook return shapes change, update these transformers.
 */

import type { GenerationRow } from '@/types/shots';
import { getGenerationId } from '@/shared/lib/mediaTypeHelpers';

/**
 * Transform a shared generation (video) to the GenerationRow format expected by FinalVideoSection.
 *
 * @param generation - The generation data from the share RPC
 * @returns GenerationRow compatible object, or null if no generation
 */
export function transformGenerationToParentRow(
  generation: Record<string, unknown> | null | undefined
): GenerationRow | null {
  if (!generation) return null;

  return {
    id: generation.id || generation.generation_id || 'shared',
    generation_id: getGenerationId(generation as GenerationRow) || 'shared',
    type: 'video',
    location: generation.location,
    imageUrl: generation.location, // FinalVideoSection/VideoItem uses imageUrl
    thumbUrl: generation.thumbUrl || generation.thumbnail_url,
    created_at: generation.created_at,
    params: generation.params,
  } as GenerationRow;
}

/**
 * Calculate the appropriate column count for the image grid based on device type.
 *
 * Uses the same logic as ShotEditor to ensure consistent display.
 *
 * @param mobileColumns - Column count from useDeviceDetection (2-6)
 * @returns Validated column count (2, 3, 4, or 6)
 */
export function calculateColumnsForDevice(
  mobileColumns: number
): 2 | 3 | 4 | 6 {
  // Ensure we return a valid column value
  if (mobileColumns <= 2) return 2;
  if (mobileColumns === 3) return 3;
  if (mobileColumns === 4) return 4;
  return 6;
}

/**
 * Extract structure video configuration from settings.
 *
 * Handles both single structure video (legacy) and multi-video array formats.
 *
 * @param settings - The travel settings object
 * @returns Array of structure video configurations
 */
export function extractStructureVideos(
  settings: Record<string, unknown> | null | undefined
): Array<{
  path: string;
  start_frame: number;
  end_frame: number;
  treatment: 'adjust' | 'clip';
  motion_strength: number;
  structure_type: string;
  metadata: unknown;
}> {
  if (!settings) return [];

  const structureVideo = settings.structureVideo as Record<string, unknown> | undefined;
  const structureVideos = settings.structureVideos;

  // Prefer the array format if present
  if (structureVideos && Array.isArray(structureVideos) && structureVideos.length > 0) {
    return structureVideos;
  }

  // Fall back to single video format
  if (structureVideo && structureVideo.path) {
    return [{
      path: structureVideo.path as string,
      start_frame: (structureVideo.startFrame as number) ?? 0,
      end_frame: (structureVideo.endFrame as number) ?? 300,
      treatment: (structureVideo.treatment as 'adjust' | 'clip') || 'adjust',
      motion_strength: (structureVideo.motionStrength as number) ?? 1.0,
      structure_type: (structureVideo.structureType as string) || 'uni3c',
      metadata: structureVideo.metadata || null,
    }];
  }

  return [];
}
