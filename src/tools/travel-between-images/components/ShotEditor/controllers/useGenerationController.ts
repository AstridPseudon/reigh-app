import { useCallback } from 'react';
import { useTimelineCore } from '@/shared/hooks/useTimelineCore';
import { handleError } from '@/shared/lib/errorHandling/handleError';
import type { Shot } from '@/types/shots';
import { useGenerateBatch, useSteerableMotionHandlers } from '../hooks';

interface UseGenerationControllerParams {
  projectId: string | null;
  selectedProjectId: string | null;
  selectedShotId: string;
  selectedShot: Shot | null;
  queryClient: ReturnType<typeof import('@tanstack/react-query').useQueryClient>;
  onShotImagesUpdate?: () => void;
  effectiveAspectRatio: string | undefined;
  generationMode: 'batch' | 'timeline' | 'join';
  prompt: string;
  onPromptChange: (prompt: string) => void;
  enhancePrompt: boolean;
  textBeforePrompts: string;
  textAfterPrompts: string;
  negativePrompt: string;
  amountOfMotion: number;
  motionMode: 'basic' | 'advanced';
  advancedMode: boolean;
  phaseConfig: ReturnType<typeof import('../hooks').useJoinSegmentsSetup>['joinPhaseConfig'];
  selectedPhasePresetId: string | null;
  steerableMotionSettings: { model_name: string; num_inference_steps: number; seed?: number };
  randomSeed: boolean;
  turboMode: boolean;
  generationTypeMode: 'i2v' | 'vace';
  smoothContinuations: boolean;
  batchVideoFrames: number;
  selectedLoras: Array<{ id: string; path: string; strength: number }>;
  structureVideos: ReturnType<typeof import('../hooks').useStructureVideo>['structureVideos'];
  selectedOutputId: string | null;
  stitchAfterGenerate: boolean;
  joinContextFrames: number;
  joinGapFrames: number;
  joinReplaceMode: boolean;
  joinKeepBridgingImages: boolean;
  joinPrompt: string;
  joinNegativePrompt: string;
  joinEnhancePrompt: boolean;
  joinModel: string;
  joinNumInferenceSteps: number;
  joinGuidanceScale: number;
  joinSeed: number;
  joinRandomSeed: boolean;
  joinMotionMode: 'basic' | 'advanced';
  joinPhaseConfig: ReturnType<typeof import('../hooks').useJoinSegmentsSetup>['joinPhaseConfig'];
  joinSelectedPhasePresetId: string | null;
  joinSelectedLoras: Array<{ id: string; path: string; strength: number }>;
  joinPriority: 'speed' | 'quality';
  joinUseInputVideoResolution: boolean;
  joinUseInputVideoFps: boolean;
  joinNoisedInputVideo: number;
  joinLoopFirstClip: boolean;
  accelerated: boolean;
  isShotUISettingsLoading: boolean;
  settingsLoadingFromContext: boolean;
  updateShotUISettings: (scope: 'project' | 'shot', values: Record<string, unknown>) => void;
  setSteerableMotionSettings: (settings: { seed?: number }) => void;
  setSteps: (steps: number) => void;
  setShowStepsNotification: (show: boolean) => void;
}

export function useGenerationController({
  projectId,
  selectedProjectId,
  selectedShotId,
  selectedShot,
  queryClient,
  onShotImagesUpdate,
  effectiveAspectRatio,
  generationMode,
  prompt,
  onPromptChange,
  enhancePrompt,
  textBeforePrompts,
  textAfterPrompts,
  negativePrompt,
  amountOfMotion,
  motionMode,
  advancedMode,
  phaseConfig,
  selectedPhasePresetId,
  steerableMotionSettings,
  randomSeed,
  turboMode,
  generationTypeMode,
  smoothContinuations,
  batchVideoFrames,
  selectedLoras,
  structureVideos,
  selectedOutputId,
  stitchAfterGenerate,
  joinContextFrames,
  joinGapFrames,
  joinReplaceMode,
  joinKeepBridgingImages,
  joinPrompt,
  joinNegativePrompt,
  joinEnhancePrompt,
  joinModel,
  joinNumInferenceSteps,
  joinGuidanceScale,
  joinSeed,
  joinRandomSeed,
  joinMotionMode,
  joinPhaseConfig,
  joinSelectedPhasePresetId,
  joinSelectedLoras,
  joinPriority,
  joinUseInputVideoResolution,
  joinUseInputVideoFps,
  joinNoisedInputVideo,
  joinLoopFirstClip,
  accelerated,
  isShotUISettingsLoading,
  settingsLoadingFromContext,
  updateShotUISettings,
  setSteerableMotionSettings,
  setSteps,
  setShowStepsNotification,
}: UseGenerationControllerParams) {
  const { clearAllEnhancedPrompts, updatePairPromptsByIndex, refetch: loadPositions } = useTimelineCore(selectedShotId);

  const handleBatchVideoPromptChangeWithClear = useCallback(async (newPrompt: string) => {
    onPromptChange(newPrompt);
    try {
      await clearAllEnhancedPrompts();
    } catch (error) {
      handleError(error, { context: 'PromptClearLog', showToast: false });
    }
  }, [onPromptChange, clearAllEnhancedPrompts]);

  const {
    handleRandomSeedChange,
    handleAcceleratedChange,
    handleStepsChange,
  } = useSteerableMotionHandlers({
    accelerated,
    randomSeed,
    turboMode,
    steerableMotionSettings,
    isShotUISettingsLoading,
    settingsLoadingFromContext,
    updateShotUISettings,
    setSteerableMotionSettings,
    setSteps,
    setShowStepsNotification,
    selectedShotId: selectedShot?.id,
  });

  const {
    handleGenerateBatch,
    isSteerableMotionEnqueuing,
    steerableMotionJustQueued,
    isGenerationDisabled,
  } = useGenerateBatch({
    projectId,
    selectedProjectId,
    selectedShotId,
    selectedShot,
    queryClient,
    onShotImagesUpdate,
    effectiveAspectRatio,
    generationMode,
    // Prompt config
    prompt,
    enhancePrompt,
    textBeforePrompts,
    textAfterPrompts,
    negativePrompt,
    // Motion config
    amountOfMotion,
    motionMode: motionMode || 'basic',
    advancedMode,
    phaseConfig,
    selectedPhasePresetId,
    // Model config
    steerableMotionSettings,
    randomSeed,
    turboMode,
    generationTypeMode,
    smoothContinuations,
    // Frame settings
    batchVideoFrames,
    // LoRAs
    selectedLoras,
    // Structure video
    structureVideos,
    // Clear prompts callback
    clearAllEnhancedPrompts,
    // Output selection
    selectedOutputId,
    // Stitch config
    stitchAfterGenerate,
    joinContextFrames,
    joinGapFrames,
    joinReplaceMode,
    joinKeepBridgingImages,
    joinPrompt,
    joinNegativePrompt,
    joinEnhancePrompt,
    joinModel,
    joinNumInferenceSteps,
    joinGuidanceScale,
    joinSeed,
    joinRandomSeed,
    joinMotionMode,
    joinPhaseConfig,
    joinSelectedPhasePresetId,
    joinSelectedLoras,
    joinPriority,
    joinUseInputVideoResolution,
    joinUseInputVideoFps,
    joinNoisedInputVideo,
    joinLoopFirstClip,
  });

  return {
    clearAllEnhancedPrompts,
    updatePairPromptsByIndex,
    loadPositions,
    handleBatchVideoPromptChangeWithClear,
    handleRandomSeedChange,
    handleAcceleratedChange,
    handleStepsChange,
    handleGenerateBatch,
    isSteerableMotionEnqueuing,
    steerableMotionJustQueued,
    isGenerationDisabled,
  };
}
