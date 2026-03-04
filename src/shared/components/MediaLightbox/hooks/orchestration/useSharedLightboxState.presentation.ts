import { useCallback, useMemo } from 'react';
import { useLightboxNavigation } from '../useLightboxNavigation';
import { useSwipeNavigation } from '../useSwipeNavigation';
import { useEffectiveMedia } from '../useEffectiveMedia';
import { useLayoutMode } from '../useLayoutMode';
import { invokeLightboxDelete } from '../../utils';
import type {
  LightboxButtonGroupProps,
  SharedLightboxInteractionState,
  SharedLightboxPresentationState,
  SharedNavigationInput,
  SharedPresentationInput,
  SharedVariantsStateResult,
} from './useSharedLightboxState.types';

/**
 * Navigation sub-facade: keyboard nav, swipe nav, safe close.
 * Usable standalone when callers only need navigation controls.
 */
export function useLightboxNavigationModel(input: SharedNavigationInput) {
  const { onClose, readOnly } = input.core;
  const {
    hasNext = false,
    hasPrevious = false,
    handleSlotNavNext,
    handleSlotNavPrev,
    swipeDisabled,
    showNavigation,
  } = input.navigation;
  const { safeClose, activateClickShield } = useLightboxNavigation({
    onNext: handleSlotNavNext,
    onPrevious: handleSlotNavPrev,
    onClose,
  });
  const swipeNavigation = useSwipeNavigation({
    onSwipeLeft: () => {
      if (hasNext) handleSlotNavNext();
    },
    onSwipeRight: () => {
      if (hasPrevious) handleSlotNavPrev();
    },
    disabled: swipeDisabled || readOnly || !showNavigation,
    hasNext,
    hasPrevious,
    threshold: 50,
    velocityThreshold: 0.3,
  });

  return {
    safeClose,
    activateClickShield,
    swipeNavigation,
  };
}

function useSharedButtonGroupState(params: {
  input: SharedPresentationInput;
  localStarred: boolean;
  handleToggleStar: () => void;
  toggleStarPending: boolean;
  isAddingToReferences: boolean;
  addToReferencesSuccess: boolean;
  handleAddToReferences: () => Promise<void>;
  handleAddToJoin: () => void;
  isAddingToJoin: boolean;
  addToJoinSuccess: boolean;
  handleGoToJoin: () => void;
}) {
  const {
    input,
    localStarred,
    handleToggleStar,
    toggleStarPending,
    isAddingToReferences,
    addToReferencesSuccess,
    handleAddToReferences,
    handleAddToJoin,
    isAddingToJoin,
    addToJoinSuccess,
    handleGoToJoin,
  } = params;
  const { media, onClose } = input.core;
  const {
    showDownload,
    isDownloading,
    onDelete,
    isDeleting,
    isUpscaling,
    handleUpscale,
  } = input.actions;
  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    await invokeLightboxDelete(onDelete, media.id, 'MediaLightbox.delete');
  }, [onDelete, media.id]);

  return useMemo<LightboxButtonGroupProps>(() => ({
    topRight: {
      showDownload: !!showDownload,
      isDownloading,
      onDelete,
      handleDelete,
      isDeleting,
      onClose,
    },
    bottomLeft: {
      isUpscaling,
      handleUpscale: async () => {
        await Promise.resolve(handleUpscale());
      },
      localStarred,
      handleToggleStar,
      toggleStarPending,
    },
    bottomRight: {
      isAddingToReferences,
      addToReferencesSuccess,
      handleAddToReferences,
      handleAddToJoin,
      isAddingToJoin,
      addToJoinSuccess,
      onGoToJoin: handleGoToJoin,
    },
  }), [
    showDownload,
    isDownloading,
    onDelete,
    handleDelete,
    isDeleting,
    onClose,
    isUpscaling,
    handleUpscale,
    localStarred,
    handleToggleStar,
    toggleStarPending,
    isAddingToReferences,
    addToReferencesSuccess,
    handleAddToReferences,
    handleAddToJoin,
    isAddingToJoin,
    addToJoinSuccess,
    handleGoToJoin,
  ]);
}

export function useLightboxPanelModel(
  input: SharedPresentationInput,
  variantsState: SharedVariantsStateResult,
  interactionState: SharedLightboxInteractionState,
): SharedLightboxPresentationState {
  const navigation = useLightboxNavigationModel(input);
  const { effectiveVideoUrl, effectiveMediaUrl, effectiveImageDimensions } = useEffectiveMedia({
    isVideo: input.core.isVideo,
    activeVariant: variantsState.activeVariant,
    effectiveImageUrl: input.media.effectiveImageUrl,
    imageDimensions: input.media.imageDimensions,
    projectAspectRatio: input.media.projectAspectRatio,
  });
  const layout = useLayoutMode({
    isMobile: input.core.isMobile,
    showTaskDetails: input.layout.showTaskDetails ?? false,
    isSpecialEditMode: input.layout.isSpecialEditMode,
    isVideo: input.core.isVideo,
    isInpaintMode: input.layout.isInpaintMode ?? false,
    isMagicEditMode: input.layout.isMagicEditMode ?? false,
  });
  const buttonGroupProps = useSharedButtonGroupState({
    input,
    localStarred: interactionState.star.localStarred,
    handleToggleStar: interactionState.star.handleToggleStar,
    toggleStarPending: interactionState.star.toggleStarMutation.isPending,
    isAddingToReferences: interactionState.references.isAddingToReferences,
    addToReferencesSuccess: interactionState.references.addToReferencesSuccess,
    handleAddToReferences: interactionState.references.handleAddToReferences,
    handleAddToJoin: interactionState.references.handleAddToJoin,
    isAddingToJoin: interactionState.references.isAddingToJoin,
    addToJoinSuccess: interactionState.references.addToJoinSuccess,
    handleGoToJoin: interactionState.references.handleGoToJoin,
  });

  return {
    variants: variantsState.section,
    intendedActiveVariantIdRef: variantsState.intendedActiveVariantIdRef,
    navigation,
    effectiveMedia: {
      videoUrl: effectiveVideoUrl,
      mediaUrl: effectiveMediaUrl,
      imageDimensions: effectiveImageDimensions,
    },
    layout: {
      isTabletOrLarger: layout.isTabletOrLarger,
      isTouchLikeDevice: layout.isTouchLikeDevice,
      shouldShowSidePanel: layout.shouldShowSidePanel,
      isUnifiedEditMode: layout.isUnifiedEditMode,
      isPortraitMode: layout.isPortraitMode,
    },
    buttonGroupProps,
  };
}
