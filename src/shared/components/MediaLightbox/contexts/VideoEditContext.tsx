/**
 * VideoEditContext
 *
 * Provides video-specific edit state to lightbox components.
 * This context is only provided by VideoLightbox, not ImageLightbox.
 *
 * Includes state for:
 * - Trim mode (cut video start/end)
 * - Replace mode (replace video portion)
 * - Regenerate mode (re-generate video)
 * - Enhance mode (upscale/interpolate video)
 */

import React, { createContext, useContext } from 'react';

// ============================================================================
// Types
// ============================================================================

export type VideoEditSubMode = 'trim' | 'replace' | 'regenerate' | 'enhance' | null;

export interface TrimState {
  startTrim: number;
  endTrim: number;
  videoDuration: number;
}

export interface EnhanceSettings {
  enableInterpolation: boolean;
  enableUpscale: boolean;
  numFrames: number;
  upscaleFactor: number;
  colorFix: boolean;
  outputQuality: 'low' | 'medium' | 'high';
}

export interface VideoEditState {
  // ========================================
  // Mode state
  // ========================================
  isInVideoEditMode: boolean;
  videoEditSubMode: VideoEditSubMode;

  // ========================================
  // Mode setters
  // ========================================
  setVideoEditSubMode: (mode: VideoEditSubMode) => void;

  // ========================================
  // Mode entry/exit handlers
  // ========================================
  handleEnterVideoEditMode: () => void;
  handleExitVideoEditMode: () => void;
  handleEnterVideoTrimMode: () => void;
  handleEnterVideoReplaceMode: () => void;
  handleEnterVideoRegenerateMode: () => void;
  handleEnterVideoEnhanceMode: () => void;

  // ========================================
  // Trim state
  // ========================================
  trimState: TrimState;
  setStartTrim: (frame: number) => void;
  setEndTrim: (frame: number) => void;
  resetTrim: () => void;
  trimmedDuration: number;
  hasTrimChanges: boolean;

  // ========================================
  // Video duration/playback
  // ========================================
  videoDuration: number;
  setVideoDuration: (duration: number) => void;
  trimCurrentTime: number;
  setTrimCurrentTime: (time: number) => void;

  // ========================================
  // Enhance settings
  // ========================================
  enhanceSettings: EnhanceSettings;
  updateEnhanceSetting: <K extends keyof EnhanceSettings>(key: K, value: EnhanceSettings[K]) => void;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_TRIM_STATE: TrimState = {
  startTrim: 0,
  endTrim: 0,
  videoDuration: 0,
};

const DEFAULT_ENHANCE_SETTINGS: EnhanceSettings = {
  enableInterpolation: false,
  enableUpscale: true,
  numFrames: 1,
  upscaleFactor: 2,
  colorFix: true,
  outputQuality: 'high',
};

const EMPTY_VIDEO_EDIT: VideoEditState = {
  // Mode state
  isInVideoEditMode: false,
  videoEditSubMode: null,

  // Mode setters
  setVideoEditSubMode: () => {},

  // Mode entry/exit
  handleEnterVideoEditMode: () => {},
  handleExitVideoEditMode: () => {},
  handleEnterVideoTrimMode: () => {},
  handleEnterVideoReplaceMode: () => {},
  handleEnterVideoRegenerateMode: () => {},
  handleEnterVideoEnhanceMode: () => {},

  // Trim state
  trimState: DEFAULT_TRIM_STATE,
  setStartTrim: () => {},
  setEndTrim: () => {},
  resetTrim: () => {},
  trimmedDuration: 0,
  hasTrimChanges: false,

  // Video duration/playback
  videoDuration: 0,
  setVideoDuration: () => {},
  trimCurrentTime: 0,
  setTrimCurrentTime: () => {},

  // Enhance settings
  enhanceSettings: DEFAULT_ENHANCE_SETTINGS,
  updateEnhanceSetting: () => {},
};

// ============================================================================
// Context
// ============================================================================

const VideoEditContext = createContext<VideoEditState | null>(null);

// ============================================================================
// Provider
// ============================================================================

export interface VideoEditProviderProps {
  children: React.ReactNode;
  value: VideoEditState;
}

export const VideoEditProvider: React.FC<VideoEditProviderProps> = ({
  children,
  value,
}) => {
  return (
    <VideoEditContext.Provider value={value}>
      {children}
    </VideoEditContext.Provider>
  );
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access video edit state. Throws if used outside VideoEditProvider.
 */
export function useVideoEdit(): VideoEditState {
  const context = useContext(VideoEditContext);
  if (!context) {
    throw new Error('useVideoEdit must be used within a VideoEditProvider');
  }
  return context;
}

/**
 * Safe version that returns defaults when used outside provider.
 * Use this for components that may render in both image and video lightbox.
 */
export function useVideoEditSafe(): VideoEditState {
  const context = useContext(VideoEditContext);
  return context ?? EMPTY_VIDEO_EDIT;
}

/**
 * Check if we're inside a VideoEditProvider.
 */
export function useIsVideoLightbox(): boolean {
  const context = useContext(VideoEditContext);
  return context !== null;
}

export default VideoEditContext;
