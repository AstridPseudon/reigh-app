/**
 * Video Trim Types
 *
 * Shared TypeScript interfaces for video trimming functionality.
 * Extracted from VideoTrimEditor to allow shared components to use these types
 * without importing from tool-specific locations.
 */

/**
 * State for video trimming controls
 */
export interface TrimState {
  /** Seconds to cut from the beginning */
  startTrim: number;
  /** Seconds to cut from the end */
  endTrim: number;
  /** Total video duration in seconds */
  videoDuration: number;
  /** Whether the current trim values are valid */
  isValid: boolean;
}

/**
 * Return type for useVideoTrimming hook
 */
export interface UseVideoTrimmingReturn {
  trimState: TrimState;
  setStartTrim: (seconds: number) => void;
  setEndTrim: (seconds: number) => void;
  resetTrim: () => void;
  setVideoDuration: (duration: number) => void;
  /** Duration after trimming is applied */
  trimmedDuration: number;
  /** Preview start time (where kept portion begins) */
  previewStartTime: number;
  /** Preview end time (where kept portion ends) */
  previewEndTime: number;
  /** Whether any trimming has been applied */
  hasTrimChanges: boolean;
}

/**
 * Return type for useTrimSave hook
 */
export interface UseTrimSaveReturn {
  isSaving: boolean;
  saveProgress: number;
  saveError: string | null;
  saveSuccess: boolean;
  saveTrimmedVideo: () => Promise<void>;
  resetSaveState: () => void;
}
