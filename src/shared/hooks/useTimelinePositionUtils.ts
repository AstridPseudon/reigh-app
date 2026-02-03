/**
 * Timeline Position Management Utilities
 *
 * Provides utilities for managing timeline frame positions without fetching data.
 * This is the "enrichment layer" that adds position management capabilities
 * to already-fetched generation data from useShotImages.
 *
 * Used primarily for the preloaded images path (share views, etc.)
 * For the main path, use useTimelineCore instead.
 *
 * Composed from:
 * - timelineFrameCalculators: pure position math (gaps, distribution, normalization)
 * - useTimelineFrameUpdates: DB update operations (single, batch, moveItems)
 * - useTimelineInitialization: first-time frame assignment
 * - useSegmentPromptMetadata: pair prompt CRUD
 */

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GenerationRow } from '@/types/shots';
import type { ShotGeneration, PositionMetadata } from './useTimelineCore';
import { isVideoGeneration } from '@/shared/lib/typeGuards';
import { useInvalidateGenerations } from '@/shared/hooks/invalidation';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getGenerationId } from '@/shared/lib/mediaTypeHelpers';

// Extracted modules
import { useTimelineFrameUpdates } from './timeline/useTimelineFrameUpdates';
import { useTimelineInitialization } from './timeline/useTimelineInitialization';
import { useSegmentPromptMetadata, extractPairPrompts } from './timeline/useSegmentPromptMetadata';

// Re-export types for convenience
export type { ShotGeneration, PositionMetadata };

// Re-export sub-modules for direct access
export { normalizePositions, findGeneration, calculateDistributedFrames, deduplicateUpdates, buildAndNormalizeFinalPositions } from './timeline/timelineFrameCalculators';
export type { FrameUpdate } from './timeline/timelineFrameCalculators';
export { useTimelineFrameUpdates } from './timeline/useTimelineFrameUpdates';
export { useTimelineInitialization } from './timeline/useTimelineInitialization';
export { useSegmentPromptMetadata, extractPairPrompts } from './timeline/useSegmentPromptMetadata';

interface UseTimelinePositionUtilsOptions {
  shotId: string | null;
  generations: GenerationRow[];
  projectId?: string | null;
}

export function useTimelinePositionUtils({ shotId, generations, projectId }: UseTimelinePositionUtilsOptions) {
  const queryClient = useQueryClient();
  const invalidateGenerations = useInvalidateGenerations();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  console.log('[SWAP_OPTIMISTIC] useTimelinePositionUtils initialized:', {
    shotId: shotId?.substring(0, 8),
    projectId: projectId?.substring(0, 8),
    generationsCount: generations.length
  });

  console.log('[TimelinePositionUtils] Hook state:', {
    shotId: shotId?.substring(0, 8),
    generationsCount: generations.length,
    isLoading,
    hasError: !!error,
  });

  // Convert GenerationRow[] to ShotGeneration[] format for backward compatibility
  // NOTE: Include both positioned and unpositioned items
  // CRITICAL: Filter out videos at the source level using canonical function
  const shotGenerations: ShotGeneration[] = generations
    .filter(gen => !isVideoGeneration(gen))
    .map(gen => ({
      id: gen.id || '',
      shot_id: shotId || '',
      generation_id: getGenerationId(gen),
      timeline_frame: gen.timeline_frame ?? -1,
      metadata: gen.metadata as PositionMetadata | undefined,
      generation: {
        id: gen.id,
        location: gen.imageUrl || gen.location || undefined,
        type: gen.type || undefined,
        created_at: gen.createdAt || new Date().toISOString(),
        starred: gen.starred ?? undefined,
      }
    }));

  console.log('[TimelinePositionUtils] Converted shotGenerations:', {
    shotId: shotId?.substring(0, 8),
    total: shotGenerations.length,
    positioned: shotGenerations.filter(sg => sg.timeline_frame >= 0).length,
    unpositioned: shotGenerations.filter(sg => sg.timeline_frame === -1).length,
  });

  // Extract pair prompts from metadata
  const pairPrompts = extractPairPrompts(shotGenerations);

  // No-op: Let database trigger handle shot_data sync
  const syncShotData = useCallback(async (_generationId: string, _targetShotId: string, _frame: number) => {
    return;
  }, []);

  // Load positions from database (refresh)
  const loadPositions = useCallback(async (opts?: { silent?: boolean; reason?: string }) => {
    if (!shotId) return;

    if (!opts?.silent) setIsLoading(true);
    setError(null);

    try {
      await queryClient.refetchQueries({ queryKey: queryKeys.generations.byShot(shotId) });

      invalidateGenerations(shotId, {
        reason: 'timeline-position-utils-reload',
        scope: 'all',
        includeShots: !!projectId,
        projectId: projectId ?? undefined
      });

      setIsLoading(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsLoading(false);
      console.error('[TimelinePositionUtils] Error refreshing positions:', error);
    }
  }, [shotId, queryClient]);

  // Compose extracted hooks
  const { updateTimelineFrame, batchExchangePositions, moveItemsToMidpoint } = useTimelineFrameUpdates({
    shotId,
    projectId,
    shotGenerations,
    syncShotData,
  });

  const { initializeTimelineFrames } = useTimelineInitialization({
    shotId,
    shotGenerations,
    batchExchangePositions,
  });

  const { updatePairPrompts, clearEnhancedPrompt } = useSegmentPromptMetadata({
    shotId,
    projectId,
    shotGenerations,
  });

  return {
    // Data (backward compatibility)
    shotGenerations,
    pairPrompts,
    isLoading,
    error,

    // Utilities
    loadPositions,
    updateTimelineFrame,
    batchExchangePositions,
    initializeTimelineFrames,
    updatePairPrompts,
    clearEnhancedPrompt,
    moveItemsToMidpoint,
  };
}
