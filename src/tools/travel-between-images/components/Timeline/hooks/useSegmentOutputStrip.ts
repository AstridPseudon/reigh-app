/**
 * useSegmentOutputStrip - Orchestrator hook for SegmentOutputStrip.
 *
 * Composes sub-hooks for deletion, scrubbing, and lightbox concerns.
 * Pure functions handle display slot computation and source info extraction.
 */

import { useCallback, useMemo, useEffect } from 'react';
import { useSourceImageChanges } from '@/shared/hooks/useSourceImageChanges';
import { useMarkVariantViewed } from '@/shared/hooks/useMarkVariantViewed';
import { TIMELINE_PADDING_OFFSET } from '../constants';
import type { SegmentSlot } from '@/shared/hooks/segments';
import type { PairData } from '@/shared/types/pairData';

import { useSegmentDeletion } from './useSegmentDeletion';
import { useSegmentScrubbing } from './useSegmentScrubbing';
import { useSegmentLightbox } from './useSegmentLightbox';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PairInfo {
  index: number;
  startFrame: number;
  endFrame: number;
  frames: number;
}

interface TrailingSegmentMode {
  imageId: string;
  imageFrame: number;
  endFrame: number;
}

/** A display slot merged with its pixel position — ready for rendering */
interface PositionedSlot {
  slot: SegmentSlot;
  leftPercent: number;
  widthPercent: number;
  isTrailing: boolean;
}

interface UseSegmentOutputStripProps {
  shotId: string;
  projectAspectRatio?: string;
  containerWidth: number;
  fullMin: number;
  fullRange: number;
  pairInfo: PairInfo[];
  rawSegmentSlots: SegmentSlot[];
  trailingSegmentMode?: TrailingSegmentMode;
  pairDataByIndex?: Map<number, PairData>;
  hasPendingTaskProp?: (pairShotGenerationId: string | null | undefined) => boolean;
  readOnly: boolean;
  onTrailingVideoInfo?: (videoUrl: string | null) => void;
  selectedParentId?: string | null;
  onSegmentFrameCountChange?: (pairShotGenerationId: string, frameCount: number) => void;
  isMultiImage?: boolean;
  lastImageFrame?: number;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Build the ordered list of display slots from raw segment slots and pair info.
 *
 * Key design: we TRUST the indices that Layer 1 (useSegmentOutputsForShot)
 * assigned to raw slots. Layer 1 already handles stale pair_shot_generation_id
 * FKs via child_order fallback, so the raw slot's .index is correct. We just
 * index by slot.index, walk the expected indices, and take what's there.
 */
function buildDisplaySlots(
  pairInfo: PairInfo[],
  rawSegmentSlots: SegmentSlot[],
  trailingSegmentMode?: TrailingSegmentMode,
): SegmentSlot[] {
  // Single pass: index raw slots by their assigned index.
  // Prefer child over placeholder when both exist at the same index.
  const slotByIndex = new Map<number, SegmentSlot>();
  for (const slot of rawSegmentSlots) {
    const existing = slotByIndex.get(slot.index);
    if (!existing || (slot.type === 'child' && existing.type !== 'child')) {
      slotByIndex.set(slot.index, slot);
    }
  }

  // Walk pair indices and take the raw slot or build a placeholder
  const trailingIndex = pairInfo.length;
  const slots: SegmentSlot[] = [];

  for (const pair of pairInfo) {
    const raw = slotByIndex.get(pair.index);
    slots.push(raw ?? { type: 'placeholder', index: pair.index });
  }

  // Trailing segment (index after all pairs)
  if (trailingSegmentMode) {
    const raw = slotByIndex.get(trailingIndex);
    slots.push(raw ?? {
      type: 'placeholder',
      index: trailingIndex,
      pairShotGenerationId: trailingSegmentMode.imageId,
      expectedFrames: trailingSegmentMode.endFrame - trailingSegmentMode.imageFrame,
    });
  }

  return slots;
}

/**
 * Extract source image info from child segment slots for mismatch detection.
 * Parses task params to find which generation IDs were used as inputs.
 */
function buildSegmentSourceInfo(rawSegmentSlots: SegmentSlot[]) {
  return rawSegmentSlots
    .filter((slot): slot is SegmentSlot & { type: 'child' } => slot.type === 'child')
    .map(slot => {
      const child = slot.child;
      const params = child.params as Record<string, unknown> | null;
      const individualParams = (params?.individual_segment_params || {}) as Record<string, unknown>;
      const orchDetails = (params?.orchestrator_details || {}) as Record<string, unknown>;
      const childOrder = child.child_order ?? slot.index;
      const orchGenIds = (orchDetails.input_image_generation_ids || []) as string[];
      const startGenId = (individualParams.start_image_generation_id as string)
        || (params?.start_image_generation_id as string)
        || orchGenIds[childOrder]
        || null;
      const endGenId = (individualParams.end_image_generation_id as string)
        || (params?.end_image_generation_id as string)
        || orchGenIds[childOrder + 1]
        || null;
      return { segmentId: child.id, childOrder, params: params || {}, startGenId, endGenId };
    });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSegmentOutputStrip({
  shotId,
  projectAspectRatio,
  containerWidth,
  fullMin,
  fullRange,
  pairInfo,
  rawSegmentSlots,
  trailingSegmentMode,
  pairDataByIndex,
  hasPendingTaskProp,
  readOnly,
  onTrailingVideoInfo,
  selectedParentId,
  onSegmentFrameCountChange,
  isMultiImage,
  lastImageFrame,
}: UseSegmentOutputStripProps) {
  // ===== DISPLAY SLOTS =====
  const displaySlots = useMemo(
    () => buildDisplaySlots(pairInfo, rawSegmentSlots, trailingSegmentMode),
    [pairInfo, rawSegmentSlots, trailingSegmentMode],
  );

  // ===== SUB-HOOKS =====
  const deletion = useSegmentDeletion();
  const scrubbingHook = useSegmentScrubbing({ projectAspectRatio, displaySlots });
  const lightbox = useSegmentLightbox({ displaySlots, pairDataByIndex, selectedParentId });
  const { clearScrubbing } = scrubbingHook;
  const { setLightboxIndex } = lightbox;
  const { markAllViewed } = useMarkVariantViewed();

  // ===== PENDING TASK CHECKER =====
  const hasPendingTask = hasPendingTaskProp ?? (() => false);

  // ===== SOURCE IMAGE CHANGE DETECTION =====
  const segmentSourceInfo = useMemo(() => buildSegmentSourceInfo(rawSegmentSlots), [rawSegmentSlots]);
  const { hasRecentMismatch } = useSourceImageChanges(segmentSourceInfo, !readOnly);

  // ===== SEGMENT CLICK =====
  const handleSegmentClick = useCallback((
    slot: SegmentSlot,
    slotIndex: number,
    onOpenPairSettings?: (pairIndex: number, pairFrameData?: { frames: number; startFrame: number; endFrame: number }) => void,
  ) => {
    clearScrubbing();
    if (slot.type === 'child') {
      markAllViewed(slot.child.id);
    }

    if (onOpenPairSettings) {
      // Route all clicks through pair settings → segmentSlotMode lightbox.
      // This handles both regular pairs and trailing segments uniformly,
      // with proper form-only and video views plus full chevron navigation.
      const pairFrameData = pairInfo.find(p => p.index === slot.index);
      onOpenPairSettings(slot.index, pairFrameData ? {
        frames: pairFrameData.frames,
        startFrame: pairFrameData.startFrame,
        endFrame: pairFrameData.endFrame,
      } : undefined);
    } else if (slot.type === 'child') {
      // No pair settings handler — fall back to inline SegmentOutputStrip lightbox
      setLightboxIndex(slotIndex);
    }
  }, [markAllViewed, pairInfo, clearScrubbing, setLightboxIndex]);

  // ===== TRAILING INDEX (shared by multiple sections) =====
  const trailingIndex = pairInfo.length;

  // ===== TRAILING VIDEO INFO REPORTING =====
  // Find trailing video by index (consistent with buildDisplaySlots — no FK matching)
  useEffect(() => {
    if (!onTrailingVideoInfo || !trailingSegmentMode) {
      onTrailingVideoInfo?.(null);
      return;
    }
    const trailingSlot = displaySlots.find(s => s.index === trailingIndex);
    if (trailingSlot?.type === 'child' && trailingSlot.child.location) {
      onTrailingVideoInfo(trailingSlot.child.location);
    } else {
      onTrailingVideoInfo(null);
    }
  }, [displaySlots, trailingIndex, trailingSegmentMode, onTrailingVideoInfo]);

  // ===== POSITIONED SLOTS (slot + pixel position in single computation) =====
  const positionedSlots = useMemo((): PositionedSlot[] => {
    if (fullRange <= 0 || containerWidth <= 0) return [];
    const effectiveWidth = containerWidth - (TIMELINE_PADDING_OFFSET * 2);
    const pairByIndex = new Map(pairInfo.map(p => [p.index, p]));

    return displaySlots.map(slot => {
      const isTrailing = slot.index === trailingIndex && !!trailingSegmentMode;

      let startFrame: number;
      let endFrame: number;
      if (isTrailing) {
        startFrame = trailingSegmentMode!.imageFrame;
        endFrame = trailingSegmentMode!.endFrame;
      } else {
        const pair = pairByIndex.get(slot.index);
        if (!pair) return { slot, leftPercent: 0, widthPercent: 0, isTrailing: false };
        startFrame = pair.startFrame;
        endFrame = pair.endFrame;
      }

      const startPixel = TIMELINE_PADDING_OFFSET + ((startFrame - fullMin) / fullRange) * effectiveWidth;
      const endPixel = TIMELINE_PADDING_OFFSET + ((endFrame - fullMin) / fullRange) * effectiveWidth;
      const width = endPixel - startPixel;

      return {
        slot,
        leftPercent: (startPixel / containerWidth) * 100,
        widthPercent: (width / containerWidth) * 100,
        isTrailing,
      };
    });
  }, [displaySlots, pairInfo, trailingIndex, fullMin, fullRange, containerWidth, trailingSegmentMode]);

  // ===== ADD TRAILING BUTTON POSITION =====
  const addTrailingButtonLeftPercent = useMemo((): number | null => {
    if (!isMultiImage || lastImageFrame === undefined || fullRange <= 0 || containerWidth <= 0) return null;
    if (displaySlots.some(slot => slot.index === trailingIndex)) return null;
    const effectiveWidth = containerWidth - (TIMELINE_PADDING_OFFSET * 2);
    const lastImagePixel = TIMELINE_PADDING_OFFSET + ((lastImageFrame - fullMin) / fullRange) * effectiveWidth;
    return (lastImagePixel / containerWidth) * 100;
  }, [isMultiImage, lastImageFrame, trailingIndex, displaySlots, fullRange, containerWidth, fullMin]);

  return {
    // Refs
    previewVideoRef: scrubbingHook.previewVideoRef,
    stripContainerRef: scrubbingHook.stripContainerRef,

    // Mobile
    isMobile: scrubbingHook.isMobile,

    // Display data
    positionedSlots,
    addTrailingButtonLeftPercent,
    hasPendingTask,
    hasRecentMismatch,

    // Scrubbing
    activeScrubbingIndex: scrubbingHook.activeScrubbingIndex,
    activeSegmentSlot: scrubbingHook.activeSegmentSlot,
    activeSegmentVideoUrl: scrubbingHook.activeSegmentVideoUrl,
    scrubbing: scrubbingHook.scrubbing,
    previewPosition: scrubbingHook.previewPosition,
    previewDimensions: scrubbingHook.previewDimensions,
    clampedPreviewX: scrubbingHook.clampedPreviewX,
    handleScrubbingStart: scrubbingHook.handleScrubbingStart,

    // Lightbox
    lightboxIndex: lightbox.lightboxIndex,
    lightboxMedia: lightbox.lightboxMedia,
    lightboxCurrentSegmentImages: lightbox.lightboxCurrentSegmentImages,
    lightboxCurrentFrameCount: lightbox.lightboxCurrentFrameCount,
    currentLightboxMedia: lightbox.currentLightboxMedia,
    childSlotIndices: lightbox.childSlotIndices,
    handleSegmentClick,
    handleLightboxNext: lightbox.handleLightboxNext,
    handleLightboxPrev: lightbox.handleLightboxPrev,
    handleLightboxClose: lightbox.handleLightboxClose,

    // Deletion
    deletingSegmentId: deletion.deletingSegmentId,
    handleDeleteSegment: deletion.handleDeleteSegment,

    // Segment frame count change (pass-through)
    onSegmentFrameCountChange,
    shotId,
  };
}
