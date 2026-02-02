/**
 * useSettingsFromContext - Bridge hook for context-based settings access
 *
 * This hook enables gradual migration from props to context:
 * - Tries to read from VideoTravelSettingsProvider context first
 * - Falls back to props if context isn't available
 *
 * Usage in ShotEditor:
 * ```tsx
 * const { prompt, setPrompt } = useSettingsFromContext({
 *   // Props fallback
 *   prompt: batchVideoPrompt,
 *   setPrompt: onBatchVideoPromptChange,
 * });
 * ```
 *
 * Once all consumers migrate to context, the props fallback can be removed.
 */

import { useContext } from 'react';
import { VideoTravelSettingsContext } from '@/tools/travel-between-images/providers/VideoTravelSettingsProvider';

/**
 * Check if we're inside VideoTravelSettingsProvider
 */
export function useHasSettingsContext(): boolean {
  const ctx = useContext(VideoTravelSettingsContext);
  return ctx !== null;
}

/**
 * Get prompt settings from context or props fallback
 */
export function usePromptSettingsWithFallback(propsFallback: {
  prompt?: string;
  negativePrompt?: string;
  textBeforePrompts?: string;
  textAfterPrompts?: string;
  enhancePrompt?: boolean;
  setPrompt?: (v: string) => void;
  setNegativePrompt?: (v: string) => void;
  setTextBeforePrompts?: (v: string) => void;
  setTextAfterPrompts?: (v: string) => void;
  setEnhancePrompt?: (v: boolean) => void;
}) {
  const ctx = useContext(VideoTravelSettingsContext);

  if (ctx) {
    // Use context
    return {
      prompt: ctx.settings.prompt || '',
      negativePrompt: ctx.settings.negativePrompt || '',
      textBeforePrompts: ctx.settings.textBeforePrompts || '',
      textAfterPrompts: ctx.settings.textAfterPrompts || '',
      enhancePrompt: ctx.settings.enhancePrompt ?? false,
      setPrompt: ctx.handlers.handleBatchVideoPromptChange,
      setNegativePrompt: ctx.handlers.handleNegativePromptChange,
      setTextBeforePrompts: ctx.handlers.handleTextBeforePromptsChange,
      setTextAfterPrompts: ctx.handlers.handleTextAfterPromptsChange,
      setEnhancePrompt: ctx.handlers.handleEnhancePromptChange,
    };
  }

  // Fallback to props
  return {
    prompt: propsFallback.prompt || '',
    negativePrompt: propsFallback.negativePrompt || '',
    textBeforePrompts: propsFallback.textBeforePrompts || '',
    textAfterPrompts: propsFallback.textAfterPrompts || '',
    enhancePrompt: propsFallback.enhancePrompt ?? false,
    setPrompt: propsFallback.setPrompt || (() => {}),
    setNegativePrompt: propsFallback.setNegativePrompt || (() => {}),
    setTextBeforePrompts: propsFallback.setTextBeforePrompts || (() => {}),
    setTextAfterPrompts: propsFallback.setTextAfterPrompts || (() => {}),
    setEnhancePrompt: propsFallback.setEnhancePrompt || (() => {}),
  };
}

/**
 * Get motion settings from context or props fallback
 */
export function useMotionSettingsWithFallback(propsFallback: {
  amountOfMotion?: number;
  motionMode?: 'basic' | 'advanced';
  turboMode?: boolean;
  smoothContinuations?: boolean;
  setAmountOfMotion?: (v: number) => void;
  setMotionMode?: (v: 'basic' | 'advanced') => void;
  setTurboMode?: (v: boolean) => void;
  setSmoothContinuations?: (v: boolean) => void;
}) {
  const ctx = useContext(VideoTravelSettingsContext);

  if (ctx) {
    return {
      amountOfMotion: ctx.settings.amountOfMotion ?? 50,
      motionMode: ctx.settings.motionMode || 'basic',
      turboMode: ctx.settings.turboMode ?? false,
      smoothContinuations: ctx.settings.smoothContinuations ?? false,
      setAmountOfMotion: ctx.handlers.handleAmountOfMotionChange,
      setMotionMode: ctx.handlers.handleMotionModeChange,
      setTurboMode: ctx.handlers.handleTurboModeChange,
      setSmoothContinuations: ctx.handlers.handleSmoothContinuationsChange,
    };
  }

  return {
    amountOfMotion: propsFallback.amountOfMotion ?? 50,
    motionMode: propsFallback.motionMode || 'basic',
    turboMode: propsFallback.turboMode ?? false,
    smoothContinuations: propsFallback.smoothContinuations ?? false,
    setAmountOfMotion: propsFallback.setAmountOfMotion || (() => {}),
    setMotionMode: propsFallback.setMotionMode || (() => {}),
    setTurboMode: propsFallback.setTurboMode || (() => {}),
    setSmoothContinuations: propsFallback.setSmoothContinuations || (() => {}),
  };
}

/**
 * Get frame settings from context or props fallback
 */
export function useFrameSettingsWithFallback(propsFallback: {
  batchVideoFrames?: number;
  batchVideoSteps?: number;
  setFrames?: (v: number) => void;
  setSteps?: (v: number) => void;
}) {
  const ctx = useContext(VideoTravelSettingsContext);

  if (ctx) {
    return {
      batchVideoFrames: ctx.settings.batchVideoFrames ?? 61,
      batchVideoSteps: ctx.settings.batchVideoSteps ?? 6,
      setFrames: ctx.handlers.handleBatchVideoFramesChange,
      setSteps: ctx.handlers.handleBatchVideoStepsChange,
    };
  }

  return {
    batchVideoFrames: propsFallback.batchVideoFrames ?? 61,
    batchVideoSteps: propsFallback.batchVideoSteps ?? 6,
    setFrames: propsFallback.setFrames || (() => {}),
    setSteps: propsFallback.setSteps || (() => {}),
  };
}

/**
 * Get phase config settings from context or props fallback
 */
export function usePhaseConfigSettingsWithFallback(propsFallback: {
  phaseConfig?: any;
  selectedPhasePresetId?: string | null;
  generationTypeMode?: 'i2v' | 'vace';
  setPhaseConfig?: (config: any) => void;
  selectPreset?: (presetId: string, config: any) => void;
  removePreset?: () => void;
  setGenerationTypeMode?: (mode: 'i2v' | 'vace') => void;
  restoreDefaults?: () => void;
}) {
  const ctx = useContext(VideoTravelSettingsContext);

  if (ctx) {
    return {
      phaseConfig: ctx.settings.phaseConfig,
      selectedPhasePresetId: ctx.settings.selectedPhasePresetId,
      generationTypeMode: ctx.settings.generationTypeMode || 'i2v',
      advancedMode: ctx.settings.advancedMode ?? false,
      setPhaseConfig: ctx.handlers.handlePhaseConfigChange,
      selectPreset: ctx.handlers.handlePhasePresetSelect,
      removePreset: ctx.handlers.handlePhasePresetRemove,
      setGenerationTypeMode: ctx.handlers.handleGenerationTypeModeChange,
      restoreDefaults: ctx.handlers.handleRestoreDefaults,
    };
  }

  return {
    phaseConfig: propsFallback.phaseConfig,
    selectedPhasePresetId: propsFallback.selectedPhasePresetId,
    generationTypeMode: propsFallback.generationTypeMode || 'i2v',
    advancedMode: false,
    setPhaseConfig: propsFallback.setPhaseConfig || (() => {}),
    selectPreset: propsFallback.selectPreset || (() => {}),
    removePreset: propsFallback.removePreset || (() => {}),
    setGenerationTypeMode: propsFallback.setGenerationTypeMode || (() => {}),
    restoreDefaults: propsFallback.restoreDefaults || (() => {}),
  };
}

/**
 * Get generation mode settings from context or props fallback
 */
export function useGenerationModeSettingsWithFallback(propsFallback: {
  generationMode?: 'batch' | 'timeline';
  videoControlMode?: 'individual' | 'batch';
  setGenerationMode?: (mode: 'batch' | 'timeline') => void;
  setVideoControlMode?: (mode: 'individual' | 'batch') => void;
}) {
  const ctx = useContext(VideoTravelSettingsContext);

  if (ctx) {
    return {
      generationMode: ctx.settings.generationMode || 'timeline',
      videoControlMode: ctx.settings.videoControlMode || 'batch',
      setGenerationMode: ctx.handlers.handleGenerationModeChange,
      setVideoControlMode: ctx.handlers.handleVideoControlModeChange,
    };
  }

  return {
    generationMode: propsFallback.generationMode || 'timeline',
    videoControlMode: propsFallback.videoControlMode || 'batch',
    setGenerationMode: propsFallback.setGenerationMode || (() => {}),
    setVideoControlMode: propsFallback.setVideoControlMode || (() => {}),
  };
}

/**
 * Get steerable motion settings from context or props fallback
 */
export function useSteerableMotionSettingsWithFallback(propsFallback: {
  steerableMotionSettings?: any;
  setSteerableMotionSettings?: (settings: any) => void;
}) {
  const ctx = useContext(VideoTravelSettingsContext);

  if (ctx) {
    return {
      steerableMotionSettings: ctx.settings.steerableMotionSettings,
      setSteerableMotionSettings: ctx.handlers.handleSteerableMotionSettingsChange,
    };
  }

  return {
    steerableMotionSettings: propsFallback.steerableMotionSettings,
    setSteerableMotionSettings: propsFallback.setSteerableMotionSettings || (() => {}),
  };
}

/**
 * Get LoRA settings from context or props fallback
 */
export function useLoraSettingsWithFallback(propsFallback: {
  selectedLoras?: any[];
  availableLoras?: any[];
  setSelectedLoras?: (loras: any[]) => void;
}) {
  const ctx = useContext(VideoTravelSettingsContext);

  if (ctx) {
    return {
      selectedLoras: ctx.settings.loras || [],
      availableLoras: ctx.availableLoras,
      setSelectedLoras: ctx.handlers.handleSelectedLorasChange,
    };
  }

  return {
    selectedLoras: propsFallback.selectedLoras || [],
    availableLoras: propsFallback.availableLoras || [],
    setSelectedLoras: propsFallback.setSelectedLoras || (() => {}),
  };
}

/**
 * Get settings loading state from context or props fallback
 */
export function useSettingsLoadingWithFallback(propsFallback: {
  settingsLoading?: boolean;
}) {
  const ctx = useContext(VideoTravelSettingsContext);

  if (ctx) {
    return {
      settingsLoading: ctx.isLoading,
      settingsStatus: ctx.status,
    };
  }

  return {
    settingsLoading: propsFallback.settingsLoading ?? false,
    settingsStatus: 'ready' as const,
  };
}

/**
 * Get blur save handler from context or props fallback
 */
export function useBlurSaveWithFallback(propsFallback: {
  onBlurSave?: () => void;
}) {
  const ctx = useContext(VideoTravelSettingsContext);

  if (ctx) {
    return ctx.handlers.handleBlurSave;
  }

  return propsFallback.onBlurSave || (() => {});
}

// Re-export the context for direct access if needed
export { VideoTravelSettingsContext } from '@/tools/travel-between-images/providers/VideoTravelSettingsProvider';
