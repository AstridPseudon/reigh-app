import { useCallback, useMemo } from 'react';
import { useAutoSaveSettings } from '@/shared/settings/hooks/useAutoSaveSettings';
import type { VideoMetadata } from '@/shared/lib/media/videoUploader';
import {
  DEFAULT_STRUCTURE_VIDEO,
  StructureVideoConfig,
  StructureVideoConfigWithMetadata,
} from '@/shared/lib/tasks/travelBetweenImages';
import { migrateLegacyStructureVideos } from '@/shared/lib/tasks/travelBetweenImages/legacyStructureVideo';
import { SETTINGS_IDS } from '@/shared/lib/settingsIds';

interface UseStructureVideoParams {
  projectId: string;
  shotId: string | undefined;
  /** Timeline frame range for auto-calculating default video ranges */
  timelineStartFrame?: number;
  timelineEndFrame?: number;
}

// Re-export types from the shared lib for convenience
export type { StructureVideoConfig, StructureVideoConfigWithMetadata };

export interface UseStructureVideoReturn {
  // ============ NEW: Multi-video array interface ============
  /** Array of structure video configurations */
  structureVideos: StructureVideoConfigWithMetadata[];
  /** Add a new structure video to the array */
  addStructureVideo: (video: StructureVideoConfigWithMetadata) => void;
  /** Update a structure video at a specific index */
  updateStructureVideo: (index: number, video: Partial<StructureVideoConfigWithMetadata>) => void;
  /** Remove a structure video at a specific index */
  removeStructureVideo: (index: number) => void;
  /** Clear all structure videos */
  clearAllStructureVideos: () => void;
  /** Set the entire array of structure videos */
  setStructureVideos: (videos: StructureVideoConfigWithMetadata[]) => void;
  /** Loading state */
  isLoading: boolean;

  // Primary video accessors (derived from structureVideos[0])
  structureVideoPath: string | null;
  structureVideoMetadata: VideoMetadata | null;
  structureVideoTreatment: 'adjust' | 'clip';
  structureVideoMotionStrength: number;
  structureVideoType: 'uni3c' | 'flow' | 'canny' | 'depth';
  structureVideoResourceId: string | null;
  structureVideoUni3cEndPercent: number;
}

/**
 * Settings storage schema - supports both legacy single-video and new array format
 */
interface StructureVideoSettings {
  // Canonical array format (preferred)
  structure_videos?: StructureVideoConfigWithMetadata[];
}

/**
 * Hook to manage structure video state with database persistence.
 * Supports both legacy single-video format and new multi-video array format.
 * Uses the shared auto-save settings pattern.
 */
export function useStructureVideo({
  projectId,
  shotId,
  timelineEndFrame = 81,
}: UseStructureVideoParams): UseStructureVideoReturn {
  const settings = useAutoSaveSettings<StructureVideoSettings>({
    toolId: SETTINGS_IDS.TRAVEL_STRUCTURE_VIDEO,
    projectId,
    shotId: shotId ?? null,
    scope: 'shot',
    defaults: { structure_videos: [] },
    enabled: !!shotId,
    debounceMs: 100,
  });

  const structureVideos = useMemo(
    () => migrateLegacyStructureVideos(
      settings.settings ?? null,
      {
        defaultEndFrame: timelineEndFrame,
        defaultVideoTreatment: DEFAULT_STRUCTURE_VIDEO.treatment,
        defaultMotionStrength: DEFAULT_STRUCTURE_VIDEO.motion_strength,
        defaultStructureType: DEFAULT_STRUCTURE_VIDEO.structure_type,
        defaultUni3cEndPercent: DEFAULT_STRUCTURE_VIDEO.uni3c_end_percent,
      },
    ),
    [settings.settings, timelineEndFrame],
  );

  const setStructureVideos = useCallback((videos: StructureVideoConfigWithMetadata[]) => {
    settings.updateField('structure_videos', videos);
  }, [settings]);

  const addStructureVideo = useCallback((video: StructureVideoConfigWithMetadata) => {
    settings.updateField('structure_videos', [...structureVideos, video]);
  }, [settings, structureVideos]);

  const updateStructureVideo = useCallback((index: number, updates: Partial<StructureVideoConfigWithMetadata>) => {
    if (index < 0 || index >= structureVideos.length) {
      return;
    }

    const next = [...structureVideos];
    next[index] = { ...next[index], ...updates };
    settings.updateField('structure_videos', next);
  }, [settings, structureVideos]);

  const removeStructureVideo = useCallback((index: number) => {
    if (index < 0 || index >= structureVideos.length) {
      return;
    }

    settings.updateField('structure_videos', structureVideos.filter((_, i) => i !== index));
  }, [settings, structureVideos]);

  const clearAllStructureVideos = useCallback(() => {
    settings.updateField('structure_videos', []);
  }, [settings]);

  const primaryStructureVideo = structureVideos[0] ?? null;

  return {
    structureVideos,
    addStructureVideo,
    updateStructureVideo,
    removeStructureVideo,
    clearAllStructureVideos,
    setStructureVideos,
    isLoading: !!shotId && settings.status === 'loading',
    structureVideoPath: primaryStructureVideo?.path ?? null,
    structureVideoMetadata: primaryStructureVideo?.metadata ?? null,
    structureVideoTreatment: primaryStructureVideo?.treatment ?? DEFAULT_STRUCTURE_VIDEO.treatment,
    structureVideoMotionStrength: primaryStructureVideo?.motion_strength ?? DEFAULT_STRUCTURE_VIDEO.motion_strength,
    structureVideoType: primaryStructureVideo?.structure_type ?? DEFAULT_STRUCTURE_VIDEO.structure_type,
    structureVideoResourceId: primaryStructureVideo?.resource_id ?? null,
    structureVideoUni3cEndPercent: primaryStructureVideo?.uni3c_end_percent ?? DEFAULT_STRUCTURE_VIDEO.uni3c_end_percent,
  };
}
