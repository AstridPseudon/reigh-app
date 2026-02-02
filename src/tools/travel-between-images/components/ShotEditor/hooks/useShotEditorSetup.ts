/**
 * useShotEditorSetup - Initialization and setup logic for ShotEditor
 *
 * Extracts from ShotEditor:
 * - Shot resolution (foundShot, lastValidShotRef, selectedShot)
 * - Effective aspect ratio calculation
 * - Image query and selector hooks
 * - Stability refs for performance optimization
 *
 * @see Phase 3 of shot-settings-context-cleanup.md
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { useProject } from '@/shared/contexts/ProjectContext';
import { useShots } from '@/shared/contexts/ShotsContext';
import { useAllShotGenerations, useTimelineImages, useUnpositionedImages, useVideoOutputs } from '@/shared/hooks/useShotGenerations';
import { Shot, GenerationRow } from '@/types/shots';

export interface UseShotEditorSetupProps {
  selectedShotId: string;
  projectId: string;
  optimisticShotData?: Shot;
  batchVideoFrames: number;
}

export interface UseShotEditorSetupReturn {
  // Shot resolution
  selectedShot: Shot | undefined;
  foundShot: Shot | undefined;
  shots: Shot[] | undefined;

  // Project data
  selectedProjectId: string;
  projects: { id: string; aspectRatio?: string }[];

  // Aspect ratio
  effectiveAspectRatio: string | undefined;

  // Image data (from queries/selectors)
  allShotImages: GenerationRow[];
  timelineImages: GenerationRow[];
  unpositionedImages: GenerationRow[];
  videoOutputs: GenerationRow[];
  contextImages: GenerationRow[];
  isLoadingFullImages: boolean;

  // Initial parent generations (for fast FinalVideoSection render)
  initialParentGenerations: GenerationRow[];

  // Stability refs for callbacks
  refs: {
    selectedShotRef: React.MutableRefObject<Shot | undefined>;
    projectIdRef: React.MutableRefObject<string>;
    allShotImagesRef: React.MutableRefObject<GenerationRow[]>;
    batchVideoFramesRef: React.MutableRefObject<number>;
  };
}

/**
 * Hook that handles ShotEditor setup and initialization.
 * Extracts shot resolution, image queries, and stability refs.
 */
export function useShotEditorSetup({
  selectedShotId,
  projectId,
  optimisticShotData,
  batchVideoFrames,
}: UseShotEditorSetupProps): UseShotEditorSetupReturn {
  const { selectedProjectId, projects } = useProject();
  const { shots } = useShots();

  // ============================================================================
  // SHOT RESOLUTION
  // ============================================================================
  // [FlickerFix] Persist the last valid shot object to prevent UI flickering during refetches
  // When duplicating items, the shots list might briefly refetch, causing selectedShot to be undefined
  const foundShot = useMemo(
    () => shots?.find(shot => shot.id === selectedShotId),
    [shots, selectedShotId]
  );
  const lastValidShotRef = useRef<Shot | undefined>();

  // Update ref if we found the shot
  if (foundShot) {
    lastValidShotRef.current = foundShot;
  }

  // Use found shot if available, otherwise fallback to:
  // 1. Optimistic shot data (for newly created shots not in cache yet)
  // 2. Cached version if shots list is loading/refreshing
  // Only use cache fallback if shots is undefined/null (loading), not if it's an empty array (loaded but missing)
  const selectedShot = foundShot || optimisticShotData || (shots === undefined ? lastValidShotRef.current : undefined);

  // [SelectorDebug] Track shot selection changes
  useEffect(() => {
    console.log('[SelectorDebug] 🎯 Shot selection state:', {
      selectedShotId: selectedShotId?.substring(0, 8),
      foundShotId: foundShot?.id?.substring(0, 8),
      optimisticShotId: optimisticShotData?.id?.substring(0, 8),
      lastValidShotId: lastValidShotRef.current?.id?.substring(0, 8),
      resolvedShotId: selectedShot?.id?.substring(0, 8),
      shotsArrayLength: shots?.length,
      shotsUndefined: shots === undefined,
      foundShotImagesCount: foundShot?.images?.length,
    });
  }, [selectedShotId, foundShot, optimisticShotData, selectedShot, shots]);

  // ============================================================================
  // STABILITY REFS
  // ============================================================================
  // 🎯 PERF FIX: Create refs for values that are used in callbacks but shouldn't cause callback recreation
  // This prevents the cascade of 22+ callback recreations on every shot/settings change
  const selectedShotRef = useRef(selectedShot);
  selectedShotRef.current = selectedShot;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  // ============================================================================
  // ASPECT RATIO
  // ============================================================================
  // Compute effective aspect ratio: prioritize shot-level over project-level
  // This ensures videos in VideoOutputsGallery, items in Timeline, and other components
  // use the shot's aspect ratio when set, otherwise fall back to project aspect ratio
  const effectiveAspectRatio = useMemo(() => {
    const projectAspectRatio = projects.find(p => p.id === projectId)?.aspectRatio;
    return selectedShot?.aspect_ratio || projectAspectRatio;
  }, [selectedShot?.aspect_ratio, projects, projectId]);

  // ============================================================================
  // IMAGE QUERIES AND SELECTORS
  // ============================================================================
  // PERFORMANCE OPTIMIZATION: Use context images when available since they're already loaded
  // Only fall back to detailed query if context data is insufficient
  const contextImages = selectedShot?.images || [];

  // [VideoLoadSpeedIssue] AGGRESSIVE OPTIMIZATION: Use memoized values to prevent re-render loops
  const hasContextData = useMemo(() => contextImages.length > 0, [contextImages.length]);

  // [ShotNavPerf] PERFORMANCE FIX: Always fetch full data in background, but don't block UI
  // We'll use context images immediately while the query runs asynchronously
  const shouldLoadDetailedData = useMemo(
    () => !!selectedShotId, // Always load full data in editor mode for pair prompts, mutations, etc.
    [selectedShotId]
  );

  // Always enable query to get full data (needed for mutations and pair prompts)
  const queryKey = shouldLoadDetailedData ? selectedShotId : null;

  console.log('[VideoLoadSpeedIssue] ShotEditor optimization decision:', {
    selectedShotId,
    contextImagesCount: contextImages.length,
    hasContextData,
    shouldLoadDetailedData,
    queryKey,
    willQueryDatabase: shouldLoadDetailedData,
    timestamp: Date.now(),
  });

  // CRITICAL: Only call useAllShotGenerations when we genuinely need detailed data
  // Using disabled query when context data is available
  console.log('[ShotNavPerf] 🎬 ShotEditor calling useAllShotGenerations', {
    queryKey: queryKey?.substring(0, 8) || 'null',
    selectedShotId: selectedShotId?.substring(0, 8),
    hasContextImages: contextImages.length > 0,
    timestamp: Date.now(),
  });

  // [ShotNavPerf] CRITICAL FIX: Pass disableRefetch during initial load to prevent query storm
  // The query will still run once, but won't refetch on every render
  const fullImagesQueryResult = useAllShotGenerations(queryKey, {
    disableRefetch: false, // Let it fetch normally, we'll use context images as placeholder
  });

  const fullShotImages = fullImagesQueryResult.data || [];
  const isLoadingFullImages = fullImagesQueryResult.isLoading;

  console.log('[ShotNavPerf] ✅ ShotEditor useAllShotGenerations result:', {
    imagesCount: fullShotImages.length,
    isLoading: fullImagesQueryResult.isLoading,
    isFetching: fullImagesQueryResult.isFetching,
    isError: fullImagesQueryResult.isError,
    error: fullImagesQueryResult.error?.message,
    dataUpdatedAt: fullImagesQueryResult.dataUpdatedAt,
    fetchStatus: fullImagesQueryResult.fetchStatus,
    timestamp: Date.now(),
  });

  // [SelectorPattern] Use selector hooks for filtered views of shot data.
  // Cache is primed by VideoTravelToolPage, so selectors have data immediately.
  // Optimistic updates in mutations update the cache; selectors automatically reflect changes.
  const timelineImagesQuery = useTimelineImages(selectedShotId);
  const unpositionedImagesQuery = useUnpositionedImages(selectedShotId);
  const videoOutputsQuery = useVideoOutputs(selectedShotId);

  // All shot images - use query data when available, fall back to context images during transition
  // This prevents the "flash to empty" when navigating between shots
  // PERF: Memoize to prevent ShotImagesEditor re-renders when reference doesn't actually change
  const allShotImages = useMemo(() => {
    return fullShotImages.length > 0 ? fullShotImages : contextImages;
  }, [fullShotImages, contextImages]);

  // Selector data with fallbacks derived from contextImages during transitions
  // This prevents UI flicker when navigating between shots
  const timelineImages = useMemo(() => {
    if (timelineImagesQuery.data && timelineImagesQuery.data.length > 0) {
      return timelineImagesQuery.data;
    }
    // Fallback: filter contextImages the same way the selector does
    return contextImages
      .filter(g => g.timeline_frame != null && g.timeline_frame >= 0 && !g.type?.includes('video'))
      .sort((a, b) => (a.timeline_frame ?? 0) - (b.timeline_frame ?? 0));
  }, [timelineImagesQuery.data, contextImages]);

  const unpositionedImages = useMemo(() => {
    if (unpositionedImagesQuery.data && unpositionedImagesQuery.data.length > 0) {
      return unpositionedImagesQuery.data;
    }
    // Fallback: filter contextImages the same way the selector does
    return contextImages.filter(g => g.timeline_frame == null && !g.type?.includes('video'));
  }, [unpositionedImagesQuery.data, contextImages]);

  const videoOutputs = useMemo(() => {
    if (videoOutputsQuery.data && videoOutputsQuery.data.length > 0) {
      return videoOutputsQuery.data;
    }
    // Fallback: filter contextImages the same way the selector does
    return contextImages.filter(g => g.type?.includes('video'));
  }, [videoOutputsQuery.data, contextImages]);

  // PERF: Derive initial parent generations from fast videoOutputs cache
  // This allows FinalVideoSection to show thumbnail immediately while full segment data loads
  // Parent generations are videos with orchestrator_details (join output parents)
  const initialParentGenerations = useMemo(() => {
    return videoOutputs
      .filter(v => {
        const params = v.params as any;
        return params?.orchestrator_details != null;
      })
      .sort((a, b) => {
        // Sort by created_at descending (most recent first)
        const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
        const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
  }, [videoOutputs]);

  console.log('[SelectorPattern] Shot data from selectors:', {
    shotId: selectedShotId?.substring(0, 8),
    allImages: allShotImages.length,
    fullQueryImages: fullShotImages.length,
    contextImages: contextImages.length,
    sources: {
      all: fullShotImages.length > 0 ? 'query' : 'context',
      timeline: timelineImagesQuery.data?.length ? 'query' : 'context',
      unpositioned: unpositionedImagesQuery.data?.length ? 'query' : 'context',
      videos: videoOutputsQuery.data?.length ? 'query' : 'context',
    },
    counts: {
      timelineImages: timelineImages.length,
      unpositionedImages: unpositionedImages.length,
      videoOutputs: videoOutputs.length,
    },
    cacheStatus: fullImagesQueryResult.isFetching ? 'fetching' : 'ready',
  });

  // Refs for stable access inside callbacks (avoid callback recreation on data changes)
  const allShotImagesRef = useRef<GenerationRow[]>(allShotImages);
  allShotImagesRef.current = allShotImages;
  const batchVideoFramesRef = useRef(batchVideoFrames);
  batchVideoFramesRef.current = batchVideoFrames;

  // [SelectorPattern] Track image data loading progress
  useEffect(() => {
    console.log('[SelectorPattern] ShotEditor image data update:', {
      selectedShotId,
      allShotImagesCount: allShotImages.length,
      timelineImagesCount: timelineImages.length,
      unpositionedImagesCount: unpositionedImages.length,
      videoOutputsCount: videoOutputs.length,
      isLoadingFullImages,
      hasContextData,
      timestamp: Date.now(),
    });
  }, [
    selectedShotId,
    allShotImages.length,
    timelineImages.length,
    unpositionedImages.length,
    videoOutputs.length,
    isLoadingFullImages,
    hasContextData,
  ]);

  return {
    // Shot resolution
    selectedShot,
    foundShot,
    shots,

    // Project data
    selectedProjectId,
    projects,

    // Aspect ratio
    effectiveAspectRatio,

    // Image data
    allShotImages,
    timelineImages,
    unpositionedImages,
    videoOutputs,
    contextImages,
    isLoadingFullImages,
    initialParentGenerations,

    // Stability refs
    refs: {
      selectedShotRef,
      projectIdRef,
      allShotImagesRef,
      batchVideoFramesRef,
    },
  };
}
