/**
 * Hook for computing pair data from shot generations.
 * Pure computation - no side effects, no state management.
 */

import { useMemo } from 'react';
import type { PairData } from '../../Timeline/TimelineContainer';
import type { GenerationRow } from '@/types/shots';
import { isVideoAny } from '@/shared/lib/typeGuards';
import { readSegmentOverrides } from '@/shared/utils/settingsMigration';

export interface UsePairDataProps {
  /** Shot generations (images) */
  shotGenerations: GenerationRow[];
  /** Current generation mode */
  generationMode: 'batch' | 'timeline';
  /** Frame spacing for batch mode */
  batchVideoFrames: number;
  /** End frame for single-image mode */
  singleImageEndFrame?: number;
}

export interface UsePairDataReturn {
  /** Map of pair index to pair data */
  pairDataByIndex: Map<number, PairData>;
}

/**
 * Computes pair data from shot generations.
 * Each pair represents two consecutive images that can generate a video segment.
 */
export function usePairData({
  shotGenerations,
  generationMode,
  batchVideoFrames,
  singleImageEndFrame,
}: UsePairDataProps): UsePairDataReturn {
  return useMemo(() => {
    const dataMap = new Map<number, PairData>();

    // Filter and sort images
    const sortedImages = [...(shotGenerations || [])]
      .filter((img) => img.timeline_frame != null && img.timeline_frame >= 0 && !isVideoAny(img))
      .sort((a, b) => (a.timeline_frame ?? 0) - (b.timeline_frame ?? 0));

    // Handle single-image mode: create a pseudo-pair with just the start image
    if (sortedImages.length === 1 && singleImageEndFrame !== undefined) {
      const startImage = sortedImages[0];
      const startFrame = startImage.timeline_frame ?? 0;
      dataMap.set(0, {
        index: 0,
        frames: singleImageEndFrame - startFrame,
        startFrame,
        endFrame: singleImageEndFrame,
        startImage: {
          id: startImage.id,
          generationId: startImage.generation_id,
          url: startImage.imageUrl || startImage.location,
          thumbUrl: startImage.thumbUrl || startImage.location,
          position: 1,
        },
        endImage: undefined,
      });
      return { pairDataByIndex: dataMap };
    }

    // Build pairs from consecutive images
    const isBatchMode = generationMode === 'batch';

    for (let pairIndex = 0; pairIndex < sortedImages.length - 1; pairIndex++) {
      const startImage = sortedImages[pairIndex];
      const endImage = sortedImages[pairIndex + 1];

      // Read per-segment overrides from metadata
      const startImageOverrides = readSegmentOverrides(startImage.metadata as Record<string, unknown> | null);
      const pairNumFramesFromMetadata = startImageOverrides.numFrames;

      // Calculate frame positions based on mode
      const startFrame = isBatchMode
        ? pairIndex * batchVideoFrames
        : (startImage.timeline_frame ?? 0);
      const endFrame = isBatchMode
        ? (pairIndex + 1) * batchVideoFrames
        : (endImage.timeline_frame ?? 0);
      const frames = isBatchMode
        ? (pairNumFramesFromMetadata ?? batchVideoFrames)
        : endFrame - startFrame;

      dataMap.set(pairIndex, {
        index: pairIndex,
        frames,
        startFrame,
        endFrame,
        startImage: {
          id: startImage.id,
          generationId: startImage.generation_id,
          url: startImage.imageUrl || startImage.location,
          thumbUrl: startImage.thumbUrl || startImage.location,
          position: pairIndex + 1,
        },
        endImage: {
          id: endImage.id,
          generationId: endImage.generation_id,
          url: endImage.imageUrl || endImage.location,
          thumbUrl: endImage.thumbUrl || endImage.location,
          position: pairIndex + 2,
        },
      });
    }

    return { pairDataByIndex: dataMap };
  }, [shotGenerations, generationMode, batchVideoFrames, singleImageEndFrame]);
}
