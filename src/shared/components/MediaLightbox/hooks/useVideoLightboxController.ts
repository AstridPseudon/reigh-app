import { useMemo } from 'react';
import type { GenerationRow } from '@/types/shots';
import { useLoadVariantImages } from '@/shared/hooks/useLoadVariantImages';
import type { SegmentSlotModeData } from '../types';
import {
  useAdjustedTaskDetails,
  useLightboxVariantBadges,
  useLightboxVideoMode,
  usePanelModeRestore,
  useSharedLightboxState,
  useVideoEditContextValue,
  useVideoRegenerateMode,
} from './index';
import type { VideoLightboxEnvironment, VideoLightboxModeModel } from './useVideoLightboxEnvironment';
import type { VideoLightboxProps } from '../VideoLightbox';

export function useVideoLightboxSharedState(
  props: VideoLightboxProps,
  modeModel: VideoLightboxModeModel,
  env: VideoLightboxEnvironment,
) {
  const {
    media,
    onClose,
    readOnly = false,
    initialVariantId,
    onOpenExternalGeneration,
    shotId,
  } = props;

  const nav = props.navigation;
  const sw = props.shotWorkflow;
  const feat = props.features;
  const act = props.actions;

  const fallbackMedia = media || ({} as GenerationRow);

  return useSharedLightboxState({
    media: fallbackMedia,
    isVideo: true,
    selectedProjectId: env.selectedProjectId,
    isMobile: env.isMobile,
    isFormOnlyMode: modeModel.isFormOnlyMode,
    onClose,
    readOnly,
    variantFetchGenerationId: env.variantFetchGenerationId,
    initialVariantId,
    starred: act?.starred,
    onOpenExternalGeneration,
    showNavigation: nav?.showNavigation ?? true,
    hasNext: modeModel.hasNext,
    hasPrevious: modeModel.hasPrevious,
    handleSlotNavNext: modeModel.handleSlotNavNext,
    handleSlotNavPrev: modeModel.handleSlotNavPrev,
    swipeDisabled: env.videoEditSubMode !== null || readOnly,
    shotId,
    selectedShotId: sw?.selectedShotId,
    allShots: sw?.allShots,
    onShotChange: sw?.onShotChange,
    onAddToShot: sw?.onAddToShot,
    onAddToShotWithoutPosition: sw?.onAddToShotWithoutPosition,
    onNavigateToShot: sw?.onNavigateToShot,
    onShowTick: sw?.onShowTick,
    onShowSecondaryTick: sw?.onShowSecondaryTick,
    onOptimisticPositioned: sw?.onOptimisticPositioned,
    onOptimisticUnpositioned: sw?.onOptimisticUnpositioned,
    optimisticPositionedIds: sw?.optimisticPositionedIds,
    optimisticUnpositionedIds: sw?.optimisticUnpositionedIds,
    positionedInSelectedShot: sw?.positionedInSelectedShot,
    associatedWithoutPositionInSelectedShot: sw?.associatedWithoutPositionInSelectedShot,
    showTaskDetails: feat?.showTaskDetails ?? false,
    isSpecialEditMode: env.videoEditSubMode !== null,
    isInpaintMode: false,
    isMagicEditMode: false,
    isCloudMode: env.isCloudMode,
    showDownload: feat?.showDownload ?? true,
    isDownloading: env.isDownloading,
    setIsDownloading: env.setIsDownloading,
    onDelete: act?.onDelete,
    isDeleting: act?.isDeleting,
    isUpscaling: false,
    handleUpscale: () => {},
    handleEnterMagicEditMode: () => {},
    effectiveImageUrl: env.effectiveImageUrl,
    imageDimensions: env.imageDimensions || { width: 1024, height: 576 },
    projectAspectRatio: env.projectAspectRatio,
  });
}

function buildVariantSegmentImages(
  segmentSlotMode?: SegmentSlotModeData,
  currentSegmentImages?: VideoLightboxProps['currentSegmentImages'],
) {
  if (segmentSlotMode?.pairData) {
    return {
      startUrl: segmentSlotMode.pairData.startImage?.url,
      endUrl: segmentSlotMode.pairData.endImage?.url,
      startGenerationId: segmentSlotMode.pairData.startImage?.generationId,
      endGenerationId: segmentSlotMode.pairData.endImage?.generationId,
      startShotGenerationId: segmentSlotMode.pairData.startImage?.id,
      endShotGenerationId: segmentSlotMode.pairData.endImage?.id,
      startVariantId: segmentSlotMode.pairData.startImage?.primaryVariantId,
      endVariantId: segmentSlotMode.pairData.endImage?.primaryVariantId,
    };
  }

  return currentSegmentImages;
}

export function useVideoLightboxEditing(
  props: VideoLightboxProps,
  modeModel: VideoLightboxModeModel,
  env: VideoLightboxEnvironment,
  sharedState: ReturnType<typeof useVideoLightboxSharedState>,
) {
  const {
    media,
    taskDetailsData,
    initialVariantId,
    shotId,
    segmentSlotMode,
  } = props;

  const currentSegmentImages = props.videoProps?.currentSegmentImages;
  const onSegmentFrameCountChange = props.videoProps?.onSegmentFrameCountChange;
  const currentFrameCount = props.videoProps?.currentFrameCount;
  const onTrimModeChange = props.videoProps?.onTrimModeChange;
  const initialVideoTrimMode = props.videoProps?.initialVideoTrimMode;

  const fallbackMedia = media || ({} as GenerationRow);

  const { adjustedTaskDetailsData } = useAdjustedTaskDetails({
    activeVariant: sharedState.variants.activeVariant,
    taskDetailsData,
    isLoadingVariants: sharedState.variants.isLoading,
    initialVariantId,
  });

  const { canRegenerate, regenerateFormProps } = useVideoRegenerateMode({
    isVideo: true,
    media: fallbackMedia,
    shotId,
    selectedProjectId: env.selectedProjectId,
    actualGenerationId: env.actualGenerationId,
    adjustedTaskDetailsData,
    primaryVariant: sharedState.variants.primaryVariant,
    currentSegmentImages,
    segmentSlotMode,
    variantParamsToLoad: env.variantParamsToLoad,
    setVariantParamsToLoad: env.setVariantParamsToLoad,
    onSegmentFrameCountChange: segmentSlotMode?.onFrameCountChange ?? onSegmentFrameCountChange,
    currentFrameCount,
  });

  const videoMode = useLightboxVideoMode({
    media: fallbackMedia,
    isVideo: true,
    selectedProjectId: env.selectedProjectId,
    projectAspectRatio: env.projectAspectRatio,
    shotId,
    actualGenerationId: env.actualGenerationId,
    effectiveVideoUrl: sharedState.effectiveMedia.videoUrl ?? env.effectiveImageUrl,
    activeVariant: sharedState.variants.activeVariant,
    setActiveVariantId: sharedState.variants.setActiveVariantId,
    refetchVariants: sharedState.variants.refetch,
    videoEditSubMode: env.videoEditSubMode,
    setVideoEditSubMode: env.setVideoEditSubMode,
    persistedVideoEditSubMode: env.persistedVideoEditSubMode,
    setPersistedPanelMode: env.setPersistedPanelMode,
    enhanceSettings: env.enhanceSettings,
    setEnhanceSettings: env.setEnhanceSettings,
    onTrimModeChange,
    canRegenerate,
  });

  usePanelModeRestore({
    mediaId: media?.id || '',
    persistedPanelMode: env.persistedPanelMode,
    isVideo: true,
    isSpecialEditMode: false,
    isInVideoEditMode: videoMode.isInVideoEditMode,
    initialVideoTrimMode,
    autoEnterInpaint: false,
    handleEnterVideoEditMode: videoMode.handleEnterVideoEditMode,
    handleEnterMagicEditMode: () => {},
  });

  const videoEditValue = useVideoEditContextValue({
    videoEditSubMode: env.videoEditSubMode,
    setVideoEditSubMode: env.setVideoEditSubMode,
    videoMode,
    isFormOnlyMode: modeModel.isFormOnlyMode,
    variantParamsToLoad: env.variantParamsToLoad,
    setVariantParamsToLoad: env.setVariantParamsToLoad,
    setEnhanceSettings: env.setEnhanceSettings,
  });

  const variantBadges = useLightboxVariantBadges({
    pendingTaskGenerationId: regenerateFormProps?.pairShotGenerationId || env.actualGenerationId,
    selectedProjectId: env.selectedProjectId,
    variants: sharedState.variants.list,
    variantFetchGenerationId: env.variantFetchGenerationId,
  });

  const variantSegmentImages = useMemo(() => {
    return buildVariantSegmentImages(segmentSlotMode, currentSegmentImages);
  }, [segmentSlotMode, currentSegmentImages]);

  const { loadVariantImages } = useLoadVariantImages({
    currentSegmentImages: variantSegmentImages,
  });

  return {
    adjustedTaskDetailsData,
    regenerateFormProps,
    videoMode,
    videoEditValue,
    variantBadges,
    variantSegmentImages,
    loadVariantImages,
  };
}

export type VideoLightboxSharedStateModel = ReturnType<typeof useVideoLightboxSharedState>;
export type VideoLightboxEditModel = ReturnType<typeof useVideoLightboxEditing>;
