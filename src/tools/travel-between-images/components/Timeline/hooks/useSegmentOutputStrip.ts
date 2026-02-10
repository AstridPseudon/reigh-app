/**
 * useSegmentOutputStrip - Extracted hook for SegmentOutputStrip logic.
 *
 * Consolidates: display slot computation, segment deletion, lightbox navigation,
 * scrubbing preview state, and segment position calculation.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useSourceImageChanges } from '@/shared/hooks/useSourceImageChanges';
import { useVideoScrubbing } from '@/shared/hooks/useVideoScrubbing';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/shared/lib/errorHandler';
import { getPreviewDimensions } from '@/shared/lib/aspectRatios';
import { TIMELINE_PADDING_OFFSET } from '../constants';
import type { SegmentSlot } from '@/shared/hooks/segments';
import type { GenerationRow } from '@/types/shots';
import type { PairData } from '../TimelineContainer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PairInfo {
  index: number;
  startFrame: number;
  endFrame: number;
  frames: number;
}

interface UseSegmentOutputStripProps {
  shotId: string;
  projectAspectRatio?: string;
  pairInfo: PairInfo[];
  fullMin: number;
  fullRange: number;
  containerWidth: number;
  rawSegmentSlots: SegmentSlot[];
  hasPendingTaskProp?: (pairShotGenerationId: string | null | undefined) => boolean;
  pairDataByIndex?: Map<number, PairData>;
  lastImageId?: string;
  trailingSegmentMode?: {
    imageId: string;
    imageFrame: number;
    endFrame: number;
  };
  readOnly: boolean;
  onTrailingVideoInfo?: (videoUrl: string | null) => void;
  selectedParentId?: string | null;
  onSegmentFrameCountChange?: (pairShotGenerationId: string, frameCount: number) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSegmentOutputStrip({
  shotId,
  projectAspectRatio,
  pairInfo,
  fullMin,
  fullRange,
  containerWidth,
  rawSegmentSlots,
  hasPendingTaskProp,
  pairDataByIndex,
  lastImageId,
  trailingSegmentMode,
  readOnly,
  onTrailingVideoInfo,
  selectedParentId,
  onSegmentFrameCountChange,
}: UseSegmentOutputStripProps) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // ===== LIGHTBOX STATE =====
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // ===== DELETION STATE =====
  const [deletingSegmentId, setDeletingSegmentId] = useState<string | null>(null);

  // ===== SCRUBBING PREVIEW STATE =====
  const [activeScrubbingIndex, setActiveScrubbingIndex] = useState<number | null>(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const stripContainerRef = useRef<HTMLDivElement>(null);

  const scrubbing = useVideoScrubbing({
    enabled: !isMobile && activeScrubbingIndex !== null,
    playOnStopScrubbing: true,
    playDelay: 400,
    resetOnLeave: true,
    onHoverEnd: () => setActiveScrubbingIndex(null),
  });

  // When active scrubbing index changes, manually trigger onMouseEnter
  useEffect(() => {
    if (activeScrubbingIndex !== null) {
      scrubbing.containerProps.onMouseEnter();
    }
  }, [activeScrubbingIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear scrubbing preview on scroll
  useEffect(() => {
    if (activeScrubbingIndex === null) return;
    const handleScroll = () => {
      setActiveScrubbingIndex(null);
      scrubbing.reset();
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeScrubbingIndex, scrubbing]);

  // ===== SEGMENT LOOKUP =====
  const segmentByPairShotGenId = useMemo(() => {
    const map = new Map<string, typeof rawSegmentSlots[number]>();
    for (const slot of rawSegmentSlots) {
      if (!slot.pairShotGenerationId) continue;
      const existing = map.get(slot.pairShotGenerationId);
      if (!existing || (slot.type === 'child' && existing.type !== 'child')) {
        map.set(slot.pairShotGenerationId, slot);
      }
    }
    return map;
  }, [rawSegmentSlots]);

  // ===== DISPLAY SLOTS =====
  const displaySlots = useMemo(() => {
    const children: typeof rawSegmentSlots = [];

    for (const pair of pairInfo) {
      const pairData = pairDataByIndex?.get(pair.index);
      const startImageId = pairData?.startImage?.id;
      const segment = startImageId ? segmentByPairShotGenId.get(startImageId) : undefined;
      if (segment?.type === 'child') {
        children.push({ ...segment, index: pair.index });
      }
    }

    // Trailing video
    const trailingIndex = pairInfo.length;
    if (lastImageId) {
      const trailingSegment = segmentByPairShotGenId.get(lastImageId);
      const isTrailingVideo = trailingSegment?.type === 'child'
        && (!pairDataByIndex || ![...pairDataByIndex.values()].some(pd => pd.startImage?.id === lastImageId));
      if (isTrailingVideo && trailingSegment) {
        children.push({ ...trailingSegment, index: trailingIndex, isTrailingSegment: true } as typeof rawSegmentSlots[number]);
      }
    }

    if (children.length > 0) {
      if (trailingSegmentMode && !children.some(s => 'isTrailingSegment' in s)) {
        children.push({
          type: 'placeholder' as const,
          index: pairInfo.length === 0 ? 0 : trailingIndex,
          pairShotGenerationId: trailingSegmentMode.imageId,
          expectedFrames: trailingSegmentMode.endFrame - trailingSegmentMode.imageFrame,
          expectedPrompt: undefined,
          startImage: undefined,
          endImage: undefined,
          isTrailingSegment: true,
        } as typeof rawSegmentSlots[number]);
      }
      return children;
    }

    // No videos - first-time experience: show placeholders
    const placeholders: typeof rawSegmentSlots = [];

    if (trailingSegmentMode && pairInfo.length === 0) {
      return [{
        type: 'placeholder' as const,
        index: 0,
        pairShotGenerationId: trailingSegmentMode.imageId,
        expectedFrames: trailingSegmentMode.endFrame - trailingSegmentMode.imageFrame,
        expectedPrompt: undefined,
        startImage: undefined,
        endImage: undefined,
      }];
    }

    for (const pair of pairInfo) {
      const pairData = pairDataByIndex?.get(pair.index);
      const startImageId = pairData?.startImage?.id;
      const hookSlot = startImageId ? segmentByPairShotGenId.get(startImageId) : undefined;
      placeholders.push({
        type: 'placeholder' as const,
        index: pair.index,
        pairShotGenerationId: startImageId,
        expectedFrames: hookSlot?.type === 'placeholder' ? hookSlot.expectedFrames : undefined,
        expectedPrompt: hookSlot?.type === 'placeholder' ? hookSlot.expectedPrompt : undefined,
        startImage: hookSlot?.type === 'placeholder' ? hookSlot.startImage : undefined,
        endImage: hookSlot?.type === 'placeholder' ? hookSlot.endImage : undefined,
      });
    }

    if (trailingSegmentMode && pairInfo.length > 0) {
      placeholders.push({
        type: 'placeholder' as const,
        index: trailingIndex,
        pairShotGenerationId: trailingSegmentMode.imageId,
        expectedFrames: trailingSegmentMode.endFrame - trailingSegmentMode.imageFrame,
        expectedPrompt: undefined,
        startImage: undefined,
        endImage: undefined,
        isTrailingSegment: true,
      } as typeof rawSegmentSlots[number]);
    }

    return placeholders;
  }, [pairDataByIndex, pairInfo, segmentByPairShotGenId, trailingSegmentMode, lastImageId]);

  // ===== ACTIVE SCRUBBING VIDEO =====
  const activeSegmentSlot = activeScrubbingIndex !== null ? displaySlots[activeScrubbingIndex] : null;
  const activeSegmentVideoUrl = activeSegmentSlot?.type === 'child' ? activeSegmentSlot.child.location : null;

  useEffect(() => {
    if (previewVideoRef.current && activeScrubbingIndex !== null) {
      scrubbing.setVideoElement(previewVideoRef.current);
    }
  }, [activeScrubbingIndex, activeSegmentVideoUrl, scrubbing.setVideoElement]);

  // ===== PENDING TASK CHECKER =====
  const hasPendingTask = hasPendingTaskProp ?? (() => false);

  // ===== SOURCE IMAGE CHANGE DETECTION =====
  const segmentSourceInfo = useMemo(() => {
    return rawSegmentSlots
      .filter(slot => slot.type === 'child')
      .map(slot => {
        if (slot.type !== 'child') return null;
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
        return {
          segmentId: child.id,
          childOrder,
          params: params || {},
          startGenId,
          endGenId,
        };
      })
      .filter((info): info is NonNullable<typeof info> => info !== null);
  }, [rawSegmentSlots]);

  const { hasRecentMismatch } = useSourceImageChanges(segmentSourceInfo, !readOnly);

  // ===== MARK GENERATION VIEWED =====
  const markGenerationViewed = useCallback(async (generationId: string) => {
    try {
      const { data: variants, error: checkError } = await supabase
        .from('generation_variants')
        .select('id, viewed_at')
        .eq('generation_id', generationId)
        .eq('is_primary', true);
      if (checkError) {
        handleError(checkError, { context: 'SegmentOutputStrip', showToast: false });
        return;
      }
      if (!variants || variants.length === 0) return;
      const { error } = await supabase
        .from('generation_variants')
        .update({ viewed_at: new Date().toISOString() })
        .eq('generation_id', generationId)
        .eq('is_primary', true)
        .is('viewed_at', null);
      if (error) {
        handleError(error, { context: 'SegmentOutputStrip', showToast: false });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.generations.variantBadges });
      }
    } catch (error) {
      handleError(error, { context: 'SegmentOutputStrip', showToast: false });
    }
  }, [queryClient]);

  // ===== SEGMENT CLICK =====
  const handleSegmentClick = useCallback((
    slot: typeof displaySlots[number],
    slotIndex: number,
    onOpenPairSettings?: (pairIndex: number, pairFrameData?: { frames: number; startFrame: number; endFrame: number }) => void,
  ) => {
    setActiveScrubbingIndex(null);
    scrubbing.reset();
    if (slot?.type === 'child') {
      markGenerationViewed(slot.child.id);
    }
    if (onOpenPairSettings && slot) {
      const pairFrameData = pairInfo.find(p => p.index === slot.index);
      onOpenPairSettings(slot.index, pairFrameData ? {
        frames: pairFrameData.frames,
        startFrame: pairFrameData.startFrame,
        endFrame: pairFrameData.endFrame,
      } : undefined);
    } else {
      setLightboxIndex(slotIndex);
    }
  }, [markGenerationViewed, pairInfo, scrubbing]);

  // ===== LIGHTBOX NAVIGATION =====
  const childSlotIndices = useMemo(() =>
    displaySlots
      .map((slot, idx) => slot.type === 'child' && slot.child.location ? idx : null)
      .filter((idx): idx is number => idx !== null),
    [displaySlots]
  );

  const handleLightboxNext = useCallback(() => {
    if (lightboxIndex === null || childSlotIndices.length === 0) return;
    const currentPos = childSlotIndices.indexOf(lightboxIndex);
    const nextPos = (currentPos + 1) % childSlotIndices.length;
    setLightboxIndex(childSlotIndices[nextPos]);
  }, [lightboxIndex, childSlotIndices]);

  const handleLightboxPrev = useCallback(() => {
    if (lightboxIndex === null || childSlotIndices.length === 0) return;
    const currentPos = childSlotIndices.indexOf(lightboxIndex);
    const prevPos = (currentPos - 1 + childSlotIndices.length) % childSlotIndices.length;
    setLightboxIndex(childSlotIndices[prevPos]);
  }, [lightboxIndex, childSlotIndices]);

  const handleLightboxClose = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  // ===== SEGMENT DELETION =====
  const getPairShotGenIdFromParams = useCallback((params: Record<string, unknown> | null | undefined) => {
    if (!params) return null;
    const individualParams = (params.individual_segment_params || {}) as Record<string, unknown>;
    return (individualParams.pair_shot_generation_id as string) || (params.pair_shot_generation_id as string) || null;
  }, []);

  const handleDeleteSegment = useCallback(async (generationId: string) => {
    setDeletingSegmentId(generationId);
    try {
      const { data: beforeData } = await supabase
        .from('generations')
        .select('id, type, parent_generation_id, location, params, primary_variant_id, pair_shot_generation_id')
        .eq('id', generationId)
        .single();

      if (!beforeData) return;

      const pairShotGenId = beforeData.pair_shot_generation_id || getPairShotGenIdFromParams(beforeData.params as Record<string, unknown> | null);
      const parentId = beforeData.parent_generation_id;

      let idsToDelete = [generationId];
      if (pairShotGenId && parentId) {
        const { data: siblings } = await supabase
          .from('generations')
          .select('id, pair_shot_generation_id, params')
          .eq('parent_generation_id', parentId);
        idsToDelete = (siblings || [])
          .filter(child => {
            const childPairId = child.pair_shot_generation_id || getPairShotGenIdFromParams(child.params as Record<string, unknown> | null);
            return childPairId === pairShotGenId;
          })
          .map(child => child.id);
      }

      const { error: deleteError } = await supabase
        .from('generations')
        .delete()
        .in('id', idsToDelete);
      if (deleteError) throw new Error(`Failed to delete: ${deleteError.message}`);

      // Optimistic cache update
      queryClient.setQueriesData(
        { predicate: (query) => query.queryKey[0] === queryKeys.segments.childrenAll[0] },
        (oldData: unknown) => {
          if (!oldData || !Array.isArray(oldData)) return oldData;
          return (oldData as Array<{ id: string }>).filter((item) => !idsToDelete.includes(item.id));
        }
      );

      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === queryKeys.segments.childrenAll[0],
        refetchType: 'all'
      });
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === queryKeys.segments.parentsAll[0],
        refetchType: 'all'
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.unified.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.generations.all });
    } catch (error) {
      handleError(error, { context: 'SegmentDelete', toastTitle: 'Failed to delete segment' });
    } finally {
      setDeletingSegmentId(null);
    }
  }, [getPairShotGenIdFromParams, queryClient]);

  // ===== TRAILING VIDEO INFO REPORTING =====
  useEffect(() => {
    if (!onTrailingVideoInfo || !lastImageId) {
      if (onTrailingVideoInfo) onTrailingVideoInfo(null);
      return;
    }
    const trailingVideoSlot = rawSegmentSlots.find((slot) => {
      if (slot.type !== 'child') return false;
      return slot.pairShotGenerationId === lastImageId;
    });
    if (trailingVideoSlot && trailingVideoSlot.type === 'child' && trailingVideoSlot.child.location) {
      onTrailingVideoInfo(trailingVideoSlot.child.location);
    } else {
      onTrailingVideoInfo(null);
    }
  }, [rawSegmentSlots, lastImageId, onTrailingVideoInfo]);

  // ===== LIGHTBOX MEDIA PROPS (memoized) =====
  const currentLightboxSlot = useMemo(() =>
    lightboxIndex !== null ? displaySlots[lightboxIndex] : null,
    [lightboxIndex, displaySlots]
  );
  const currentLightboxMedia = useMemo(() =>
    currentLightboxSlot?.type === 'child' ? currentLightboxSlot.child : null,
    [currentLightboxSlot]
  );

  const lightboxMedia = useMemo(() => {
    if (!currentLightboxMedia) return null;
    return {
      ...currentLightboxMedia,
      ...(selectedParentId ? { parent_generation_id: selectedParentId } : {}),
    } as GenerationRow;
  }, [currentLightboxMedia, selectedParentId]);

  const lightboxCurrentSegmentImages = useMemo(() => {
    const pairData = currentLightboxSlot ? pairDataByIndex?.get(currentLightboxSlot.index) : undefined;
    const slotChildId = currentLightboxSlot?.type === 'child' ? currentLightboxSlot.child.id : undefined;
    return {
      startShotGenerationId: pairData?.startImage?.id || currentLightboxSlot?.pairShotGenerationId,
      activeChildGenerationId: slotChildId,
      startUrl: pairData?.startImage?.url,
      endUrl: pairData?.endImage?.url,
      startGenerationId: pairData?.startImage?.generationId,
      endGenerationId: pairData?.endImage?.generationId,
      startVariantId: pairData?.startImage?.primaryVariantId,
      endVariantId: pairData?.endImage?.primaryVariantId,
    };
  }, [currentLightboxSlot, pairDataByIndex]);

  const lightboxCurrentFrameCount = useMemo(() => {
    const pairData = currentLightboxSlot ? pairDataByIndex?.get(currentLightboxSlot.index) : undefined;
    return pairData?.frames;
  }, [currentLightboxSlot, pairDataByIndex]);

  // ===== SEGMENT POSITIONS =====
  const segmentPositions = useMemo(() => {
    if (fullRange <= 0 || containerWidth <= 0) return [];
    const effectiveWidth = containerWidth - (TIMELINE_PADDING_OFFSET * 2);

    if (trailingSegmentMode && pairInfo.length === 0) {
      const startPixel = TIMELINE_PADDING_OFFSET + ((trailingSegmentMode.imageFrame - fullMin) / fullRange) * effectiveWidth;
      const endPixel = TIMELINE_PADDING_OFFSET + ((trailingSegmentMode.endFrame - fullMin) / fullRange) * effectiveWidth;
      const width = endPixel - startPixel;
      return [{
        pairIndex: 0,
        leftPercent: (startPixel / containerWidth) * 100,
        widthPercent: (width / containerWidth) * 100,
      }];
    }

    if (!pairInfo.length) return [];

    const positions = pairInfo.map((pair) => {
      const startPixel = TIMELINE_PADDING_OFFSET + ((pair.startFrame - fullMin) / fullRange) * effectiveWidth;
      const endPixel = TIMELINE_PADDING_OFFSET + ((pair.endFrame - fullMin) / fullRange) * effectiveWidth;
      const width = endPixel - startPixel;
      return {
        pairIndex: pair.index,
        leftPercent: (startPixel / containerWidth) * 100,
        widthPercent: (width / containerWidth) * 100,
      };
    });

    if (trailingSegmentMode && pairInfo.length > 0) {
      const startPixel = TIMELINE_PADDING_OFFSET + ((trailingSegmentMode.imageFrame - fullMin) / fullRange) * effectiveWidth;
      const endPixel = TIMELINE_PADDING_OFFSET + ((trailingSegmentMode.endFrame - fullMin) / fullRange) * effectiveWidth;
      const width = endPixel - startPixel;
      positions.push({
        pairIndex: pairInfo.length,
        leftPercent: (startPixel / containerWidth) * 100,
        widthPercent: (width / containerWidth) * 100,
      });
    }

    return positions;
  }, [pairInfo, fullMin, fullRange, containerWidth, trailingSegmentMode]);

  // ===== PREVIEW DIMENSIONS =====
  const previewDimensions = useMemo(() => getPreviewDimensions(projectAspectRatio), [projectAspectRatio]);

  const handleScrubbingStart = useCallback((index: number, segmentRect: DOMRect) => {
    setActiveScrubbingIndex(index);
    setPreviewPosition({
      x: segmentRect.left + segmentRect.width / 2,
      y: segmentRect.top,
    });
  }, []);

  const clampedPreviewX = useMemo(() => {
    const padding = 16;
    const halfWidth = previewDimensions.width / 2;
    const minX = padding + halfWidth;
    const maxX = (typeof window !== 'undefined' ? window.innerWidth : 1920) - padding - halfWidth;
    return Math.max(minX, Math.min(maxX, previewPosition.x));
  }, [previewPosition.x, previewDimensions.width]);

  return {
    // Refs
    previewVideoRef,
    stripContainerRef,

    // Mobile
    isMobile,

    // Display data
    displaySlots,
    segmentPositions,
    hasPendingTask,
    hasRecentMismatch,

    // Scrubbing
    activeScrubbingIndex,
    activeSegmentSlot,
    activeSegmentVideoUrl,
    scrubbing,
    previewPosition,
    previewDimensions,
    clampedPreviewX,
    handleScrubbingStart,

    // Lightbox
    lightboxIndex,
    lightboxMedia,
    lightboxCurrentSegmentImages,
    lightboxCurrentFrameCount,
    currentLightboxMedia,
    childSlotIndices,
    handleSegmentClick,
    handleLightboxNext,
    handleLightboxPrev,
    handleLightboxClose,

    // Deletion
    deletingSegmentId,
    handleDeleteSegment,

    // Segment frame count change (pass-through)
    onSegmentFrameCountChange,
    shotId,
  };
}
