import { useAddImageToShot, useRemoveImageFromShot } from '@/shared/hooks/shots';
import { useApplySettingsHandler } from '../hooks/actions/useApplySettingsHandler';
import type { GenerationRow, Shot } from '@/domains/generation/types';
import type { PhaseConfig } from '@/shared/types/phaseConfig';
import type { PresetMetadata } from '@/shared/types/presetMetadata';
import type { SteerableMotionSettings } from '@/shared/types/steerableMotion';
import type { VideoMetadata } from '@/shared/lib/media/videoUploader';

type ApplySettingsHandlerState = Parameters<typeof useApplySettingsHandler>[0];

interface PromptSettingsSlice {
  prompt: string;
  setPrompt: (prompt: string) => void;
  enhancePrompt: boolean;
  setEnhancePrompt: (enhance: boolean) => void;
  textBeforePrompts: string;
  setTextBeforePrompts: (text: string) => void;
  textAfterPrompts: string;
  setTextAfterPrompts: (text: string) => void;
}

interface MotionSettingsSlice {
  motionMode: 'basic' | 'advanced';
  setMotionMode: (mode: 'basic' | 'advanced') => void;
  turboMode: boolean;
  setTurboMode: (turbo: boolean) => void;
  amountOfMotion: number;
  setAmountOfMotion: (motion: number) => void;
}

interface FrameSettingsSlice {
  batchVideoFrames: number;
  setFrames: (frames: number) => void;
  batchVideoSteps: number;
  setSteps: (steps: number) => void;
}

interface PhaseConfigSettingsSlice {
  generationTypeMode: 'i2v' | 'vace';
  setGenerationTypeMode: (mode: 'i2v' | 'vace') => void;
  phaseConfig: PhaseConfig;
  setPhaseConfig: (config: PhaseConfig) => void;
  selectPreset: (presetId: string, config: PhaseConfig, presetMetadata?: PresetMetadata) => void;
  removePreset: () => void;
  advancedMode: boolean;
}

interface GenerationModeSettingsSlice {
  generationMode: 'batch' | 'timeline' | 'by-pair';
  setGenerationMode: (mode: 'batch' | 'timeline' | 'by-pair') => void;
}

interface SteerableMotionSettingsSlice {
  steerableMotionSettings: SteerableMotionSettings;
  setSteerableMotionSettings: (settings: Partial<SteerableMotionSettings>) => void;
}

interface DimensionCallbacks {
  onDimensionSourceChange?: (source: 'project' | 'firstImage' | 'custom') => void;
  onCustomWidthChange?: (width?: number) => void;
  onCustomHeightChange?: (height?: number) => void;
}

interface StructureVideoSettingsSlice {
  handleStructureVideoInputChange: (
    videoPath: string | null,
    metadata: VideoMetadata | null,
    treatment: 'adjust' | 'clip',
    motionStrength: number,
    structureType: 'uni3c' | 'flow' | 'canny' | 'depth',
    resourceId?: string,
  ) => void;
}

interface GenerationControllerActionsSlice {
  updatePairPromptsByIndex: ApplySettingsHandlerState['updatePairPromptsByIndex'];
  loadPositions: ApplySettingsHandlerState['loadPositions'];
}

interface UseShotEditorApplySettingsModelParams {
  core: {
    projectId: string;
    selectedShot: Shot | undefined;
    simpleFilteredImages: GenerationRow[];
    availableLoras: ApplySettingsHandlerState['availableLoras'];
    loraManager: ApplySettingsHandlerState['loraManager'];
  };
  settings: {
    promptSettings: PromptSettingsSlice;
    motionSettings: MotionSettingsSlice;
    frameSettings: FrameSettingsSlice;
    phaseConfigSettings: PhaseConfigSettingsSlice;
    generationModeSettings: GenerationModeSettingsSlice;
    steerableMotionSettings: SteerableMotionSettingsSlice;
  };
  dimensions: DimensionCallbacks;
  structureVideo: StructureVideoSettingsSlice;
  generationController: GenerationControllerActionsSlice;
}

export function useShotEditorApplySettingsModel({
  core,
  settings,
  dimensions,
  structureVideo,
  generationController,
}: UseShotEditorApplySettingsModelParams): ReturnType<typeof useApplySettingsHandler> {
  const addImageToShotMutation = useAddImageToShot();
  const removeImageFromShotMutation = useRemoveImageFromShot();

  return useApplySettingsHandler({
    projectId: core.projectId,
    selectedShotId: core.selectedShot?.id ?? '',
    simpleFilteredImages: core.simpleFilteredImages,
    selectedShot: core.selectedShot,
    availableLoras: core.availableLoras,
    onBatchVideoPromptChange: settings.promptSettings.setPrompt,
    onSteerableMotionSettingsChange: settings.steerableMotionSettings.setSteerableMotionSettings,
    onBatchVideoFramesChange: settings.frameSettings.setFrames,
    onBatchVideoStepsChange: settings.frameSettings.setSteps,
    onDimensionSourceChange: dimensions.onDimensionSourceChange,
    onCustomWidthChange: dimensions.onCustomWidthChange,
    onCustomHeightChange: dimensions.onCustomHeightChange,
    onGenerationModeChange: settings.generationModeSettings.setGenerationMode,
    onAdvancedModeChange: (advanced: boolean) => settings.motionSettings.setMotionMode(advanced ? 'advanced' : 'basic'),
    onMotionModeChange: settings.motionSettings.setMotionMode,
    onGenerationTypeModeChange: settings.phaseConfigSettings.setGenerationTypeMode,
    onPhaseConfigChange: settings.phaseConfigSettings.setPhaseConfig,
    onPhasePresetSelect: settings.phaseConfigSettings.selectPreset,
    onPhasePresetRemove: settings.phaseConfigSettings.removePreset,
    onTurboModeChange: settings.motionSettings.setTurboMode,
    onEnhancePromptChange: settings.promptSettings.setEnhancePrompt,
    onAmountOfMotionChange: settings.motionSettings.setAmountOfMotion,
    onTextBeforePromptsChange: settings.promptSettings.setTextBeforePrompts,
    onTextAfterPromptsChange: settings.promptSettings.setTextAfterPrompts,
    onStructureVideoInputChange: structureVideo.handleStructureVideoInputChange,
    generationMode: settings.generationModeSettings.generationMode,
    generationTypeMode: settings.phaseConfigSettings.generationTypeMode,
    advancedMode: settings.phaseConfigSettings.advancedMode,
    motionMode: settings.motionSettings.motionMode,
    turboMode: settings.motionSettings.turboMode,
    enhancePrompt: settings.promptSettings.enhancePrompt,
    amountOfMotion: settings.motionSettings.amountOfMotion,
    textBeforePrompts: settings.promptSettings.textBeforePrompts,
    textAfterPrompts: settings.promptSettings.textAfterPrompts,
    batchVideoSteps: settings.frameSettings.batchVideoSteps,
    batchVideoFrames: settings.frameSettings.batchVideoFrames,
    steerableMotionSettings: settings.steerableMotionSettings.steerableMotionSettings,
    loraManager: core.loraManager,
    addImageToShotMutation,
    removeImageFromShotMutation,
    updatePairPromptsByIndex: generationController.updatePairPromptsByIndex,
    loadPositions: generationController.loadPositions,
  });
}
