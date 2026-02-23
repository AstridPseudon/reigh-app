import type React from 'react';
import type { Shot } from '@/types/shots';
import { useAudio, useJoinSegmentsHandler, useJoinSegmentsSetup, useNameEditing, useStructureVideo, useStructureVideoHandlers } from '../hooks';

interface UseEditingControllerParams {
  selectedShotId: string;
  projectId: string | null;
  selectedProjectId: string | null;
  selectedShot: Shot | null;
  effectiveAspectRatio: string | undefined;
  swapButtonRef: React.RefObject<HTMLButtonElement>;
  onUpdateShotName?: (newName: string) => void;
  state: {
    isEditingName: boolean;
    editingName: string;
  };
  actions: ReturnType<typeof import('../state/useShotEditorState').useShotEditorState>['actions'];
  generationTypeMode: 'i2v' | 'vace';
  setGenerationTypeMode: (mode: 'i2v' | 'vace') => void;
  joinSegmentSlots: ReturnType<typeof import('@/shared/hooks/segments').useSegmentOutputsForShot>['segmentSlots'];
  joinSelectedParent: ReturnType<typeof import('@/shared/hooks/segments').useSegmentOutputsForShot>['selectedParent'];
}

export function useEditingController({
  selectedShotId,
  projectId,
  selectedProjectId,
  selectedShot,
  effectiveAspectRatio,
  swapButtonRef,
  onUpdateShotName,
  state,
  actions,
  generationTypeMode,
  setGenerationTypeMode,
  joinSegmentSlots,
  joinSelectedParent,
}: UseEditingControllerParams) {
  // Structure video management
  const {
    structureVideoPath,
    structureVideoMetadata,
    structureVideoTreatment,
    structureVideoMotionStrength,
    structureVideoType,
    structureVideoResourceId,
    structureVideoUni3cEndPercent,
    isLoading: isStructureVideoSettingsLoading,
    structureVideos,
    addStructureVideo,
    updateStructureVideo,
    removeStructureVideo,
    clearAllStructureVideos,
    setStructureVideos,
  } = useStructureVideo({
    projectId,
    shotId: selectedShot?.id,
  });

  const {
    handleUni3cEndPercentChange,
    handleStructureVideoMotionStrengthChange,
    handleStructureTypeChangeFromMotionControl,
    handleStructureVideoInputChange,
  } = useStructureVideoHandlers({
    structureVideos,
    setStructureVideos,
    updateStructureVideo,
    structureVideoPath,
    structureVideoType,
    generationTypeMode,
    setGenerationTypeMode,
  });

  // Audio management
  const {
    audioUrl,
    audioMetadata,
    handleAudioChange,
    isLoading: isAudioSettingsLoading,
  } = useAudio({
    projectId,
    shotId: selectedShot?.id,
  });

  // Name editing
  const {
    handleNameClick,
    handleNameSave,
    handleNameCancel,
    handleNameKeyDown,
  } = useNameEditing({
    selectedShot,
    state,
    actions: {
      ...actions,
      setEditingName: actions.setEditingName,
      setEditingNameValue: actions.setEditingNameValue,
    },
    onUpdateShotName,
  });

  // Join segments setup
  const {
    joinSettings,
    joinPrompt,
    joinNegativePrompt,
    joinContextFrames,
    joinGapFrames,
    joinReplaceMode,
    joinKeepBridgingImages,
    joinEnhancePrompt,
    joinModel,
    joinNumInferenceSteps,
    joinGuidanceScale,
    joinSeed,
    joinMotionMode,
    joinPhaseConfig,
    joinSelectedPhasePresetId,
    joinRandomSeed,
    joinPriority,
    joinUseInputVideoResolution,
    joinUseInputVideoFps,
    joinNoisedInputVideo,
    joinLoopFirstClip,
    generateMode,
    joinSelectedLoras,
    stitchAfterGenerate,
    setGenerateMode,
    toggleGenerateModePreserveScroll,
    joinSettingsForHook,
    joinLoraManager,
  } = useJoinSegmentsSetup({
    selectedShotId,
    projectId,
    swapButtonRef,
  });

  // Join segments handler
  const {
    isJoiningClips,
    joinClipsSuccess,
    joinValidationData,
    handleJoinSegments,
    handleRestoreJoinDefaults,
  } = useJoinSegmentsHandler({
    projectId,
    selectedProjectId,
    selectedShotId,
    effectiveAspectRatio,
    audioUrl,
    joinSegmentSlots,
    joinSelectedParent,
    joinLoraManager,
    joinSettings: joinSettingsForHook,
  });

  return {
    // Structure video + handlers
    structureVideoPath,
    structureVideoMetadata,
    structureVideoTreatment,
    structureVideoMotionStrength,
    structureVideoType,
    structureVideoResourceId,
    structureVideoUni3cEndPercent,
    isStructureVideoSettingsLoading,
    structureVideos,
    addStructureVideo,
    updateStructureVideo,
    removeStructureVideo,
    clearAllStructureVideos,
    setStructureVideos,
    handleUni3cEndPercentChange,
    handleStructureVideoMotionStrengthChange,
    handleStructureTypeChangeFromMotionControl,
    handleStructureVideoInputChange,

    // Audio
    audioUrl,
    audioMetadata,
    handleAudioChange,
    isAudioSettingsLoading,

    // Name editing
    handleNameClick,
    handleNameSave,
    handleNameCancel,
    handleNameKeyDown,

    // Join configuration + actions
    joinSettings,
    joinPrompt,
    joinNegativePrompt,
    joinContextFrames,
    joinGapFrames,
    joinReplaceMode,
    joinKeepBridgingImages,
    joinEnhancePrompt,
    joinModel,
    joinNumInferenceSteps,
    joinGuidanceScale,
    joinSeed,
    joinMotionMode,
    joinPhaseConfig,
    joinSelectedPhasePresetId,
    joinRandomSeed,
    joinPriority,
    joinUseInputVideoResolution,
    joinUseInputVideoFps,
    joinNoisedInputVideo,
    joinLoopFirstClip,
    generateMode,
    joinSelectedLoras,
    stitchAfterGenerate,
    setGenerateMode,
    toggleGenerateModePreserveScroll,
    joinLoraManager,
    isJoiningClips,
    joinClipsSuccess,
    joinValidationData,
    handleJoinSegments,
    handleRestoreJoinDefaults,
  };
}
