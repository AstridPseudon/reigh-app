/**
 * Gallery Filter State (useGalleryFilterState)
 * ==============================================
 *
 * Extracted from useGalleryPageState to manage filter state separately.
 * Handles the filter state map, per-shot persistence, and shot navigation effects.
 *
 * ## What This Hook Provides
 * - **Filter state**: selectedShotFilter, excludePositioned, starredOnly, searchTerm
 * - **Filter setters**: handleShotFilterChange, handleExcludePositionedChange, etc.
 * - **Per-shot persistence**: saves/restores filter preferences when switching shots
 * - **Shot navigation effects**: auto-selects appropriate filter for each shot
 * - **Query fallback**: falls back to "all" when a specific-shot filter returns 0 results
 *
 * @module useGalleryFilterState
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useCurrentShot } from '@/shared/contexts/CurrentShotContext';
import { useShots } from '@/shared/contexts/ShotsContext';
import { useToolSettings } from '@/shared/hooks/useToolSettings';
import { GenerationsPaneSettings } from '@/shared/types/steerableMotion';
import { SHOT_FILTER, isSpecialFilter } from '@/shared/constants/filterConstants';

/**
 * Filter state for a single shot.
 * Tracks both the current filter and whether it was explicitly set by the user.
 */
interface ShotFilterState {
  filter: string; // SHOT_FILTER.ALL, SHOT_FILTER.NO_SHOT, or a shotId UUID
  isUserOverride: boolean; // true if user explicitly set this, false if it's the computed default
}

/**
 * A map of shotId -> filter state.
 * This allows us to track filter preferences per-shot without reactive flicker.
 */
type ShotFilterStateMap = Map<string, ShotFilterState>;

interface UseGalleryFilterStateOptions {
  shouldLoadData: boolean;
  /** Called when shot navigation applies a filter for a specific shot (used to sync lastAffectedShotId) */
  onShotFilterApplied?: (shotId: string) => void;
}

/**
 * Data from the generations query needed for the query-based fallback.
 * The parent hook passes this in so we can react to empty results.
 */
export interface QueryFallbackData {
  isLoading: boolean;
  isFetching: boolean;
  total: number | undefined;
  /** Whether the response exists at all (undefined = query hasn't run) */
  hasResponse: boolean;
}

export interface GalleryFilterStateResult {
  // State values
  selectedShotFilter: string;
  excludePositioned: boolean;
  searchTerm: string;
  starredOnly: boolean;

  // State setters
  setSelectedShotFilter: (filter: string) => void;
  setExcludePositioned: (value: boolean) => void;
  setSearchTerm: (term: string) => void;
  setStarredOnly: (starred: boolean) => void;

  // Computed
  filters: {
    mediaType: string;
    toolType?: string;
    shotId?: string;
    excludePositioned?: boolean;
    starredOnly: boolean;
    searchTerm?: string;
  };

  // For skeleton display
  expectedItemCount: number;

  // Refs exposed for query fallback effect (called from parent)
  applyQueryFallback: (data: QueryFallbackData, page: number) => void;
}

const NO_SHOT_VIEW_KEY = '__no_shot_view__';

export function useGalleryFilterState({
  shouldLoadData,
  onShotFilterApplied,
}: UseGalleryFilterStateOptions, mediaType: string, toolType?: string): GalleryFilterStateResult {
  const { shots: shotsData, allImagesCount, noShotImagesCount } = useShots();
  const { currentShotId } = useCurrentShot();

  // Core filter state
  const [selectedShotFilter, setSelectedShotFilter] = useState<string>(SHOT_FILTER.ALL);
  const [excludePositioned, setExcludePositioned] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [starredOnly, setStarredOnly] = useState<boolean>(false);

  // Use shots.settings to store GenerationsPane settings for the current shot (for persistence)
  const {
    settings: shotSettings,
    update: updateShotSettings,
    isLoading: isLoadingShotSettings,
  } = useToolSettings<GenerationsPaneSettings>('generations-pane', {
    shotId: currentShotId || undefined,
    enabled: shouldLoadData && !!currentShotId,
  });

  // ============================================================================
  // STABLE FILTER STATE MAP
  // This map tracks the filter state for each shot, avoiding reactive flicker.
  // It uses pre-computed stats from shotsData (hasUnpositionedImages) for defaults.
  // Special key '__no_shot_view__' is used for the overall view (no specific shot).
  // ============================================================================

  const filterStateMapRef = useRef<ShotFilterStateMap>(new Map());

  // Track which shot we last applied settings for (to detect shot changes)
  const lastAppliedShotIdRef = useRef<string | null>(null);

  // Track whether we've done the initial filter setup (to handle null === null case)
  const hasInitializedRef = useRef<boolean>(false);

  // Debug: Log on mount
  useEffect(() => {
    console.log('[StableFilter] Hook mounted, initial state:', {
      currentShotId: currentShotId?.substring(0, 8) ?? 'null',
      selectedShotFilter,
      isLoadingShotSettings,
    });

    return () => {
      console.log('[StableFilter] Hook unmounted');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the filter that was applied for the last shot (to preserve "all" during navigation)
  const lastAppliedFilterRef = useRef<string>(SHOT_FILTER.ALL);

  // Track the last known unpositioned count for each shot (to detect when images are added/removed)
  const lastUnpositionedCountsRef = useRef<Map<string, number>>(new Map());

  /**
   * Get the filter state for a shot from the map.
   * Uses pre-computed stats from shotsData for the default.
   */
  const getFilterStateForShot = useCallback((shotId: string): ShotFilterState => {
    // Check if we have an existing state (possibly with user override)
    const existingState = filterStateMapRef.current.get(shotId);
    if (existingState) {
      return existingState;
    }

    // No existing state - compute default from pre-computed stats
    const shot = shotsData?.find(s => s.id === shotId);
    const hasUnpositioned = shot?.hasUnpositionedImages ?? false;

    // Default: show shot's images if it has unpositioned ones, otherwise show all
    const defaultFilter = hasUnpositioned ? shotId : SHOT_FILTER.ALL;

    return {
      filter: defaultFilter,
      isUserOverride: false,
    };
  }, [shotsData]);

  /**
   * Set the filter state for a shot.
   * If isUserOverride is true, this will persist until explicitly changed again.
   */
  const setFilterStateForShot = useCallback((shotId: string, filter: string, isUserOverride: boolean) => {
    filterStateMapRef.current.set(shotId, { filter, isUserOverride });

    console.log('[StableFilter] Set filter state:', {
      shotId: shotId?.substring(0, 8),
      filter: filter === 'all' ? 'all' : filter?.substring(0, 8),
      isUserOverride,
    });
  }, []);

  // ============================================================================
  // INITIALIZE FILTER STATE FROM PERSISTED SETTINGS
  // When shot settings load, populate the map with user's previous choice.
  // ============================================================================

  useEffect(() => {
    if (!currentShotId || isLoadingShotSettings) return;

    // Check if we already have a user override in the map
    const existingState = filterStateMapRef.current.get(currentShotId);
    if (existingState?.isUserOverride) {
      console.log('[StableFilter] Already have user override in map, skipping settings restore');
      return;
    }

    // Populate map from persisted settings if user had customized
    if (shotSettings?.userHasCustomized && shotSettings.selectedShotFilter) {
      console.log('[StableFilter] Populating map from persisted settings:', {
        shotId: currentShotId?.substring(0, 8),
        filter: shotSettings.selectedShotFilter === 'all' ? 'all' : shotSettings.selectedShotFilter?.substring(0, 8),
      });

      setFilterStateForShot(currentShotId, shotSettings.selectedShotFilter, true);
      // Also restore excludePositioned preference
      setExcludePositioned(shotSettings.excludePositioned ?? true);
    }
  }, [currentShotId, isLoadingShotSettings, shotSettings, setFilterStateForShot]);

  // ============================================================================
  // APPLY FILTER WHEN NAVIGATING TO A SHOT
  // This is the main effect that applies the filter when currentShotId changes.
  // ============================================================================

  useEffect(() => {
    console.log('[StableFilter] Effect running:', {
      currentShotId: currentShotId?.substring(0, 8) ?? 'null',
      hasInitialized: hasInitializedRef.current,
      lastAppliedShotId: lastAppliedShotIdRef.current?.substring(0, 8) ?? 'null',
      isLoadingShotSettings,
      selectedShotFilter,
    });

    // Don't apply defaults while per-shot settings are still loading.
    if (currentShotId && isLoadingShotSettings) {
      console.log('[StableFilter] Shot changed but settings still loading - deferring filter apply:', {
        shotId: currentShotId.substring(0, 8),
      });
      return;
    }

    // Only run when the shot actually changes (or on initial load)
    if (hasInitializedRef.current && currentShotId === lastAppliedShotIdRef.current) {
      console.log('[StableFilter] Skipping - already initialized and shot unchanged');
      return;
    }

    const previousShotId = lastAppliedShotIdRef.current;

    console.log('[StableFilter] Shot changed:', {
      from: previousShotId?.substring(0, 8),
      to: currentShotId?.substring(0, 8),
      currentFilter: selectedShotFilter,
    });

    if (!currentShotId) {
      // No shot selected - check for user override, otherwise default to 'no-shot'
      const noShotViewState = filterStateMapRef.current.get(NO_SHOT_VIEW_KEY);

      let filterToApply: string;
      if (noShotViewState?.isUserOverride) {
        filterToApply = noShotViewState.filter;
        console.log('[StableFilter] No current shot, using user override:', filterToApply);
      } else {
        filterToApply = SHOT_FILTER.NO_SHOT;
        console.log('[StableFilter] No current shot, defaulting to "no-shot"');
      }

      setSelectedShotFilter(filterToApply);
      setExcludePositioned(true);
      lastAppliedShotIdRef.current = currentShotId;
      lastAppliedFilterRef.current = filterToApply;
      hasInitializedRef.current = true;
      return;
    }

    // Get the filter state for this shot
    const filterState = getFilterStateForShot(currentShotId);

    // IMPORTANT: When navigating between shots (shot-to-shot), preserve "all" filter
    // if the previous shot was on "all" and this shot has no user override.
    const isNavigatingBetweenShots = previousShotId !== null && currentShotId !== null;
    const previousWasAll = lastAppliedFilterRef.current === SHOT_FILTER.ALL;

    let filterToApply = filterState.filter;

    if (isNavigatingBetweenShots && previousWasAll && !filterState.isUserOverride) {
      console.log('[StableFilter] Preserving "all" filter during shot-to-shot navigation:', {
        from: previousShotId?.substring(0, 8),
        to: currentShotId?.substring(0, 8),
        computedDefault: filterState.filter === SHOT_FILTER.ALL ? 'all' : filterState.filter?.substring(0, 8),
        preserving: 'all',
      });
      filterToApply = SHOT_FILTER.ALL;
    } else {
      console.log('[StableFilter] Applying filter for shot:', {
        shotId: currentShotId?.substring(0, 8),
        filter: filterState.filter === SHOT_FILTER.ALL ? 'all' : filterState.filter?.substring(0, 8),
        isUserOverride: filterState.isUserOverride,
      });
    }

    setSelectedShotFilter(filterToApply);
    setExcludePositioned(true);

    // If not a user override, store this as the default in the map
    if (!filterState.isUserOverride) {
      setFilterStateForShot(currentShotId, filterToApply, false);
    }

    // Sync the dropdown selection to the current shot
    onShotFilterApplied?.(currentShotId);

    // Mark as applied
    lastAppliedShotIdRef.current = currentShotId;
    lastAppliedFilterRef.current = filterToApply;
    hasInitializedRef.current = true;

  }, [
    currentShotId,
    isLoadingShotSettings,
    getFilterStateForShot,
    setFilterStateForShot,
    onShotFilterApplied,
  ]);

  // ============================================================================
  // UPDATE DEFAULTS WHEN SHOT IMAGE COUNTS CHANGE
  // ============================================================================

  useEffect(() => {
    if (!shotsData?.length) return;

    shotsData.forEach(shot => {
      const lastCount = lastUnpositionedCountsRef.current.get(shot.id);
      const currentCount = shot.unpositionedImageCount ?? 0;

      if (lastCount !== undefined && lastCount !== currentCount) {
        const existingState = filterStateMapRef.current.get(shot.id);

        if (!existingState?.isUserOverride) {
          const newDefault = currentCount > 0 ? shot.id : SHOT_FILTER.ALL;

          console.log('[StableFilter] Unpositioned count changed, updating default:', {
            shotId: shot.id?.substring(0, 8),
            oldCount: lastCount,
            newCount: currentCount,
            newDefault: newDefault === 'all' ? 'all' : 'shot',
          });

          setFilterStateForShot(shot.id, newDefault, false);

          if (shot.id === currentShotId) {
            setSelectedShotFilter(newDefault);
            lastAppliedFilterRef.current = newDefault;
          }
        }
      }

      lastUnpositionedCountsRef.current.set(shot.id, currentCount);
    });
  }, [shotsData, currentShotId, setFilterStateForShot]);

  // ============================================================================
  // USER OVERRIDE HANDLERS
  // ============================================================================

  const handleShotFilterChange = useCallback((newShotFilter: string) => {
    setSelectedShotFilter(newShotFilter);
    lastAppliedFilterRef.current = newShotFilter;

    if (currentShotId) {
      setFilterStateForShot(currentShotId, newShotFilter, true);

      const updatedSettings: GenerationsPaneSettings = {
        selectedShotFilter: newShotFilter,
        excludePositioned,
        userHasCustomized: true,
      };
      updateShotSettings('shot', updatedSettings);

      console.log('[StableFilter] User changed filter (override):', {
        shotId: currentShotId?.substring(0, 8),
        newFilter: newShotFilter === SHOT_FILTER.ALL ? 'all' : newShotFilter?.substring(0, 8),
      });
    } else {
      filterStateMapRef.current.set(NO_SHOT_VIEW_KEY, { filter: newShotFilter, isUserOverride: true });

      console.log('[StableFilter] User changed filter in overall view (override):', {
        newFilter: newShotFilter === SHOT_FILTER.ALL ? 'all' : (newShotFilter === SHOT_FILTER.NO_SHOT ? 'no-shot' : newShotFilter?.substring(0, 8)),
      });
    }

    if (!isSpecialFilter(newShotFilter)) {
      filterStateMapRef.current.set(newShotFilter, { filter: newShotFilter, isUserOverride: true });
    }
  }, [currentShotId, excludePositioned, setFilterStateForShot, updateShotSettings]);

  const handleExcludePositionedChange = useCallback((newExcludePositioned: boolean) => {
    setExcludePositioned(newExcludePositioned);

    if (currentShotId) {
      const updatedSettings: GenerationsPaneSettings = {
        selectedShotFilter,
        excludePositioned: newExcludePositioned,
        userHasCustomized: true,
      };
      updateShotSettings('shot', updatedSettings);
    }
  }, [currentShotId, selectedShotFilter, updateShotSettings]);

  // Reset excludePositioned when switching to video to avoid confusion
  useEffect(() => {
    if (mediaType === 'video') {
      setExcludePositioned(false);
    }
  }, [mediaType]);

  // Memoize filters to prevent unnecessary re-renders and duplicate progressive loading sessions
  const filters = useMemo(() => {
    const computedFilters = {
      mediaType,
      toolType,
      shotId: selectedShotFilter === SHOT_FILTER.ALL ? undefined : selectedShotFilter,
      excludePositioned: !isSpecialFilter(selectedShotFilter) ? excludePositioned : undefined,
      starredOnly,
      searchTerm: searchTerm.trim() || undefined,
    };

    console.log('[SkeletonCountDebug] Filters changed:', {
      shotId: computedFilters.shotId === undefined ? 'all' : computedFilters.shotId?.substring(0, 8),
      excludePositioned: computedFilters.excludePositioned,
      mediaType: computedFilters.mediaType,
      starredOnly: computedFilters.starredOnly,
      searchTerm: computedFilters.searchTerm,
    });

    return computedFilters;
  }, [mediaType, toolType, selectedShotFilter, excludePositioned, starredOnly, searchTerm]);

  // ============================================================================
  // SKELETON COUNT (expectedItemCount)
  // ============================================================================

  const lastKnownCountsRef = useRef<Map<string, number>>(new Map());

  const expectedItemCount = useMemo(() => {
    const filterKey = `${selectedShotFilter}-${excludePositioned}`;

    const lastKnown = lastKnownCountsRef.current.get(filterKey);
    if (lastKnown !== undefined) {
      const cappedLastKnown = Math.min(lastKnown, 60);

      console.log('[SkeletonCountDebug] Using last known count:', {
        shotId: selectedShotFilter === 'all' ? 'all' : selectedShotFilter?.substring(0, 8),
        lastKnown,
        cappedLastKnown,
        source: 'cache',
      });
      return cappedLastKnown;
    }

    if (selectedShotFilter === SHOT_FILTER.ALL) {
      return Math.min(allImagesCount ?? 12, 60);
    }
    if (selectedShotFilter === SHOT_FILTER.NO_SHOT) {
      return Math.min(noShotImagesCount ?? 12, 60);
    }
    const shot = shotsData?.find(s => s.id === selectedShotFilter);
    if (!shot) return 12;

    const count = excludePositioned
      ? shot.unpositionedImageCount
      : shot.imageCount;

    const cappedCount = Math.min(count ?? 12, 60);

    console.log('[SkeletonCountDebug] Using pre-computed count:', {
      shotId: selectedShotFilter?.substring(0, 8),
      excludePositioned,
      allImagesCount,
      noShotImagesCount,
      rawCount: count,
      cappedCount,
      source: 'shotsData',
    });

    return cappedCount;
  }, [selectedShotFilter, shotsData, excludePositioned, allImagesCount, noShotImagesCount]);

  // ============================================================================
  // QUERY-BASED FALLBACK
  // Called by parent hook when query data changes, to fall back to 'all'
  // when a specific shot filter returns 0 results.
  // ============================================================================

  const lastQueryResultRef = useRef<{ filter: string; total: number } | null>(null);

  /** Update the last known count when we get real data (called by parent) */
  const updateLastKnownCount = useCallback((total: number) => {
    const filterKey = `${selectedShotFilter}-${excludePositioned}`;
    lastKnownCountsRef.current.set(filterKey, total);
  }, [selectedShotFilter, excludePositioned]);

  const applyQueryFallback = useCallback((data: QueryFallbackData, page: number) => {
    console.log('[StableFilter] Query fallback effect running:', {
      isLoading: data.isLoading,
      isFetching: data.isFetching,
      selectedShotFilter,
      page,
      total: data.total,
    });

    // Update last known count when data is ready
    if (!data.isLoading && data.total !== undefined) {
      updateLastKnownCount(data.total);
    }

    // Only check when query has completed and we're filtering by a specific shot
    if (data.isLoading || data.isFetching || selectedShotFilter === SHOT_FILTER.ALL || page !== 1 || !data.hasResponse) {
      console.log('[StableFilter] Query fallback - skipping (not ready or already all)', {
        isLoading: data.isLoading, isFetching: data.isFetching, selectedShotFilter, page, hasResponse: data.hasResponse,
      });
      return;
    }

    const total = data.total ?? 0;
    const lastResult = lastQueryResultRef.current;

    // Check if this is a NEW result for this filter
    if (lastResult?.filter === selectedShotFilter && lastResult?.total === total) {
      console.log('[StableFilter] Query fallback - skipping (same result as before)');
      return;
    }

    lastQueryResultRef.current = { filter: selectedShotFilter, total };

    if (total === 0) {
      const existingState = currentShotId
        ? filterStateMapRef.current.get(currentShotId)
        : filterStateMapRef.current.get(selectedShotFilter);

      if (existingState?.isUserOverride) {
        console.log('[StableFilter] Query returned 0 results but user intentionally selected this shot, keeping filter:', {
          filter: selectedShotFilter?.substring(0, 8),
          total,
        });
        return;
      }

      console.log('[StableFilter] Query returned 0 results, falling back to "all":', {
        filter: selectedShotFilter?.substring(0, 8),
        total,
      });

      if (currentShotId) {
        setFilterStateForShot(currentShotId, SHOT_FILTER.ALL, false);
      }

      setSelectedShotFilter(SHOT_FILTER.ALL);
      lastAppliedFilterRef.current = SHOT_FILTER.ALL;
    } else {
      console.log('[StableFilter] Query fallback - has results, keeping filter:', {
        filter: selectedShotFilter,
        total,
      });
    }
  }, [selectedShotFilter, currentShotId, setFilterStateForShot, updateLastKnownCount]);

  return {
    // State values
    selectedShotFilter,
    excludePositioned,
    searchTerm,
    starredOnly,

    // State setters
    setSelectedShotFilter: handleShotFilterChange,
    setExcludePositioned: handleExcludePositionedChange,
    setSearchTerm,
    setStarredOnly,

    // Computed
    filters,

    // For skeleton display
    expectedItemCount,

    // Query fallback
    applyQueryFallback,
  };
}
