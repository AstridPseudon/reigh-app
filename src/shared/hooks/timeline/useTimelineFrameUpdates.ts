/**
 * Timeline Frame Updates
 *
 * Hook-based DB update operations for timeline frames:
 * - Single frame update (updateTimelineFrame)
 * - Batch exchange positions (batchExchangePositions) - absolute and pair-swap
 * - Move items to distributed positions (moveItemsToMidpoint)
 *
 * Depends on timelineFrameCalculators for pure computation.
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ShotGeneration } from '@/shared/hooks/useTimelineCore';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  findGeneration,
  calculateDistributedFrames,
  deduplicateUpdates,
  buildAndNormalizeFinalPositions,
} from './timelineFrameCalculators';

// ============================================================================
// Types
// ============================================================================

interface UseTimelineFrameUpdatesOptions {
  shotId: string | null;
  projectId?: string | null;
  shotGenerations: ShotGeneration[];
  syncShotData: (generationId: string, targetShotId: string, frame: number) => Promise<void>;
}

// ============================================================================
// Cache refetch helper
// ============================================================================

function refetchRelatedCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  shotId: string,
  projectId?: string | null
) {
  queryClient.refetchQueries({ queryKey: queryKeys.generations.byShot(shotId) });
  queryClient.refetchQueries({ queryKey: queryKeys.generations.meta(shotId) });
  if (projectId) {
    queryClient.refetchQueries({ queryKey: queryKeys.shots.list(projectId!) });
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useTimelineFrameUpdates({
  shotId,
  projectId,
  shotGenerations,
  syncShotData,
}: UseTimelineFrameUpdatesOptions) {
  const queryClient = useQueryClient();

  /**
   * Update timeline frame for a single generation
   */
  const updateTimelineFrame = useCallback(async (generationId: string, frame: number) => {
    if (!shotId) {
      throw new Error('No shotId provided');
    }

    console.log('[TimelinePositionUtils] Updating timeline frame', {
      shotId: shotId.substring(0, 8),
      generationId: generationId.substring(0, 8),
      frame,
      totalGenerations: shotGenerations.length,
    });

    // Find the shot_generation record - try multiple lookup strategies
    let shotGen = shotGenerations.find(sg => sg.generation_id === generationId);

    // Fallback: maybe the passed ID is actually the shot_generation ID
    if (!shotGen) {
      shotGen = shotGenerations.find(sg => sg.id === generationId);
      if (shotGen) {
        console.log('[TimelinePositionUtils] Used fallback lookup by shot_generation ID (should not happen with allGenerations prop)');
      }
    }

    // If still not found, this is a data consistency error
    if (!shotGen?.id) {
      console.error('[TimelinePositionUtils] Generation not found in provided data:', {
        lookingFor: generationId.substring(0, 8),
        availableGenIds: shotGenerations.map(sg => sg.generation_id?.substring(0, 8)),
        availableShotGenIds: shotGenerations.map(sg => sg.id?.substring(0, 8)),
      });
      throw new Error(`Shot generation not found for generation ${generationId} - this indicates a data flow issue`);
    }

    const { error } = await supabase
      .from('shot_generations')
      .update({ timeline_frame: frame })
      .eq('id', shotGen.id)
      .eq('shot_id', shotId);

    if (error) {
      throw error;
    }

    // Sync shot_data in background for fast loading stability (Phase 1)
    if (shotGen.generation_id) {
      await syncShotData(shotGen.generation_id, shotId, frame);
    }

    // Refetch instead of invalidate to preserve data
    refetchRelatedCaches(queryClient, shotId, projectId);
  }, [shotId, shotGenerations, queryClient, projectId, syncShotData]);

  /**
   * Batch exchange positions between generations.
   * Supports both absolute frame updates and pair swaps.
   */
  const batchExchangePositions = useCallback(async (
    exchanges: Array<{ id: string; newFrame: number } | { shotGenerationIdA: string; shotGenerationIdB: string }>
  ) => {
    if (!shotId) {
      throw new Error('No shotId provided');
    }

    console.log('[TimelinePositionUtils] Batch exchanging positions', {
      shotId: shotId.substring(0, 8),
      exchangeCount: exchanges.length,
      exchangeType: 'id' in exchanges[0] ? 'absolute' : 'pair-swap'
    });

    // Handle pair swaps (from drag reorder)
    if (exchanges.length > 0 && 'shotGenerationIdA' in exchanges[0]) {
      const pairSwaps = exchanges as Array<{ shotGenerationIdA: string; shotGenerationIdB: string }>;

      console.log('[TimelinePositionUtils] Processing pair swaps', {
        swapCount: pairSwaps.length
      });

      const swapUpdates = pairSwaps.map(async (swap) => {
        let sgA = shotGenerations.find(sg => sg.id === swap.shotGenerationIdA);
        if (!sgA) {
          sgA = shotGenerations.find(sg => sg.generation_id === swap.shotGenerationIdA);
        }

        let sgB = shotGenerations.find(sg => sg.id === swap.shotGenerationIdB);
        if (!sgB) {
          sgB = shotGenerations.find(sg => sg.generation_id === swap.shotGenerationIdB);
        }

        if (!sgA || !sgB) {
          console.warn('[TimelinePositionUtils] Shot generation not found for swap:', {
            swapA: swap.shotGenerationIdA.substring(0, 8),
            swapB: swap.shotGenerationIdB.substring(0, 8),
            foundA: !!sgA,
            foundB: !!sgB,
          });
          return;
        }

        const frameA = sgA.timeline_frame;
        const frameB = sgB.timeline_frame;

        console.log('[TimelinePositionUtils] Swapping frames:', {
          sgA: sgA.id.substring(0, 8),
          sgB: sgB.id.substring(0, 8),
          frameA, frameB,
        });

        const updateA = supabase
          .from('shot_generations')
          .update({ timeline_frame: frameB })
          .eq('id', sgA.id)
          .eq('shot_id', shotId);

        const updateB = supabase
          .from('shot_generations')
          .update({ timeline_frame: frameA })
          .eq('id', sgB.id)
          .eq('shot_id', shotId);

        const syncPromises: Promise<void>[] = [];
        if (sgA.generation_id) syncPromises.push(syncShotData(sgA.generation_id, shotId, frameB));
        if (sgB.generation_id) syncPromises.push(syncShotData(sgB.generation_id, shotId, frameA));

        const [resA, resB] = await Promise.all([updateA, updateB, ...syncPromises]);

        if (resA.error) throw resA.error;
        if (resB.error) throw resB.error;
      });

      await Promise.all(swapUpdates);

      console.log('[TimelinePositionUtils] All swaps complete, refetching in background');
      refetchRelatedCaches(queryClient, shotId, projectId);
      return;
    }

    // Handle absolute frame updates (from timeline drag)
    const absoluteUpdates = exchanges as Array<{ id: string; newFrame: number }>;
    const updates = absoluteUpdates.map(async ({ id, newFrame }) => {
      let shotGen = shotGenerations.find(sg => sg.generation_id === id);

      if (!shotGen) {
        shotGen = shotGenerations.find(sg => sg.id === id);
        if (shotGen) {
          console.log('[TimelinePositionUtils] Used fallback lookup for batch update');
        }
      }

      if (!shotGen?.id) {
        console.error('[TimelinePositionUtils] Shot generation not found for batch update:', id.substring(0, 8));
        return;
      }

      const syncPromise = shotGen.generation_id
        ? syncShotData(shotGen.generation_id, shotId, newFrame)
        : Promise.resolve();

      const { error } = await supabase
        .from('shot_generations')
        .update({ timeline_frame: newFrame })
        .eq('id', shotGen.id)
        .eq('shot_id', shotId);

      await syncPromise;

      if (error) {
        console.error('[TimelinePositionUtils] Error updating position:', error);
        throw error;
      }
    });

    await Promise.all(updates);

    console.log('[TimelinePositionUtils] All absolute updates complete, refetching in background');
    refetchRelatedCaches(queryClient, shotId, projectId);
  }, [shotId, shotGenerations, queryClient, projectId, syncShotData]);

  /**
   * Move items to distributed positions between neighbors (for batch mode drag).
   * Supports both single and multi-item moves.
   */
  const moveItemsToMidpoint = useCallback(async (
    draggedItemIds: string[],
    newStartIndex: number,
    allItems: Array<{ id: string; timeline_frame: number | null }>
  ) => {
    if (!shotId) {
      throw new Error('No shotId provided');
    }

    console.log('[DataTrace] moveItemsToMidpoint:', {
      draggedItemIds: draggedItemIds.map(id => id.substring(0, 8)),
      newStartIndex,
      totalItems: allItems.length,
      numDragged: draggedItemIds.length,
    });

    // Find shot_generation records for all dragged items
    const draggedShotGens = draggedItemIds.map(id => {
      const sg = findGeneration(shotGenerations, id);
      if (!sg?.id) {
        throw new Error(`Shot generation not found for ${id}`);
      }
      return sg;
    });

    // Calculate distributed frames (pure computation)
    const rawUpdates = calculateDistributedFrames({
      draggedShotGens,
      draggedItemIds,
      newStartIndex,
      allItems,
      shotGenerations,
    });

    // Deduplicate
    let uniqueUpdates = deduplicateUpdates(rawUpdates);

    // Normalize (start at 0, compress gaps)
    uniqueUpdates = buildAndNormalizeFinalPositions(uniqueUpdates, shotGenerations);

    // Execute all updates in parallel
    const updatePromises = Array.from(uniqueUpdates.entries()).map(async ([id, payload]) => {
      console.log('[DataTrace] Updating timeline_frame:', {
        shotGenId: id.substring(0, 8),
        targetFrame: payload.newFrame,
        reason: payload.reason,
      });

      const { error } = await supabase
        .from('shot_generations')
        .update({ timeline_frame: payload.newFrame })
        .eq('id', id)
        .eq('shot_id', shotId);

      if (error) {
        console.error('[DataTrace] Update failed:', error);
        throw error;
      }
    });

    await Promise.all(updatePromises);

    console.log('[DataTrace] All distribution updates complete, refetching in background');
    refetchRelatedCaches(queryClient, shotId, projectId);
    // CRITICAL: Also refetch segment-live-timeline so segment videos update positions
    queryClient.refetchQueries({ queryKey: queryKeys.segments.liveTimeline(shotId) });
  }, [shotId, shotGenerations, queryClient, projectId]);

  return {
    updateTimelineFrame,
    batchExchangePositions,
    moveItemsToMidpoint,
  };
}
