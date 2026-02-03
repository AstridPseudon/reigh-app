/**
 * Timeline Initialization
 *
 * Hook for first-time positioning logic: assigning frames to unpositioned images.
 * Delegates the actual DB update to batchExchangePositions.
 */

import { useCallback } from 'react';
import type { ShotGeneration } from '@/shared/hooks/useTimelineCore';

// ============================================================================
// Types
// ============================================================================

interface UseTimelineInitializationOptions {
  shotId: string | null;
  shotGenerations: ShotGeneration[];
  batchExchangePositions: (
    exchanges: Array<{ id: string; newFrame: number } | { shotGenerationIdA: string; shotGenerationIdB: string }>
  ) => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useTimelineInitialization({
  shotId,
  shotGenerations,
  batchExchangePositions,
}: UseTimelineInitializationOptions) {
  /**
   * Initialize timeline frames for unpositioned images
   */
  const initializeTimelineFrames = useCallback(async (
    frameSpacing: number
  ) => {
    if (!shotId) {
      throw new Error('No shotId provided');
    }

    console.log('[TimelinePositionUtils] Initializing timeline frames', {
      shotId: shotId.substring(0, 8),
      frameSpacing
    });

    // Find unpositioned generations
    const unpositioned = shotGenerations.filter(sg => sg.timeline_frame === null);

    if (unpositioned.length === 0) {
      console.log('[TimelinePositionUtils] No unpositioned generations to initialize');
      return;
    }

    // Assign sequential frames
    const updates = unpositioned.map((sg, index) => ({
      id: sg.generation_id,
      newFrame: index * frameSpacing
    }));

    await batchExchangePositions(updates);
  }, [shotId, shotGenerations, batchExchangePositions]);

  return {
    initializeTimelineFrames,
  };
}
