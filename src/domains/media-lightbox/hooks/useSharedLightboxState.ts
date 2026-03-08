/**
 * useSharedLightboxState
 *
 * Shared state orchestrator for ImageLightbox and VideoLightbox.
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useVariants } from '@/shared/hooks/variants/useVariants';
import { useVariantSelection } from './useVariantSelection';
import { useVariantPromotion } from './useVariantPromotion';
import { useStarToggle } from './useStarToggle';
import { useReferences } from './useReferences';
import { useJoinClips } from './useJoinClips';
import { useGenerationLineage } from './useGenerationLineage';
import { useShotPositioning } from './useShotPositioning';
import { useShotCreation } from './useShotCreation';
import { useSourceGeneration } from './useSourceGeneration';
import { useMakeMainVariant } from './useMakeMainVariant';
import { useLightboxNavigation } from './useLightboxNavigation';
import { useSwipeNavigation } from './useSwipeNavigation';
import { useEffectiveMedia } from './useEffectiveMedia';
import { useLayoutMode } from './useLayoutMode';
import { invokeLightboxDelete } from '../utils/lightboxDelete';
import type {
  LightboxButtonGroupProps,
  UseSharedLightboxStateInput,
  UseSharedLightboxStateReturn,
} from './types';

export type { LightboxButtonGroupProps } from './types';

export function useSharedLightboxState(input: UseSharedLightboxStateInput): UseSharedLightboxStateReturn {
  const { core, navigation: navInput, shots: shotsInput, layout: layoutInput, actions, media: mediaInput } = input;
  const { media, isVideo, selectedProjectId, isMobile, isFormOnlyMode, onClose, readOnly } = core;
  const shotWorkflow = shotsInput.shotWorkflow;

  // --- Variants ---

  const {
    variants,
    primaryVariant,
    activeVariant,
    isLoading: isLoadingVariants,
    setActiveVariantId: rawSetActiveVariantId,
    refetch: refetchVariants,
    setPrimaryVariant,
    deleteVariant,
  } = useVariants({
    generationId: core.variantFetchGenerationId,
    enabled: !isFormOnlyMode,
  });

  const { setActiveVariantId: baseSetActiveVariantId, isViewingNonPrimaryVariant } = useVariantSelection({
    media,
    viewedGenerationId: core.variantFetchGenerationId,
    rawSetActiveVariantId,
    activeVariant,
    variants,
    initialVariantId: core.initialVariantId,
  });

  const intendedActiveVariantIdRef = useRef<string | null>(activeVariant?.id || null);

  const { promoteSuccess, isPromoting, handlePromoteToGeneration, handleAddVariantAsNewGenerationToShot } =
    useVariantPromotion({ selectedProjectId });

  useEffect(() => {
    if (activeVariant?.id && activeVariant.id !== intendedActiveVariantIdRef.current) {
      intendedActiveVariantIdRef.current = activeVariant.id;
    }
  }, [activeVariant?.id]);

  const setActiveVariantId = useCallback(
    (variantId: string) => {
      intendedActiveVariantIdRef.current = variantId;
      baseSetActiveVariantId(variantId);
    },
    [baseSetActiveVariantId],
  );

  // --- Star, references, join clips ---

  const star = useStarToggle({ media, starred: input.starred, shotId: shotsInput.shotId });

  const referencesState = useReferences({
    media,
    selectedProjectId,
    isVideo,
    selectedShotId: shotWorkflow?.selectedShotId,
  });

  const joinState = useJoinClips({ media, isVideo, selectedProjectId });

  // --- Lineage ---

  const lineageState = useGenerationLineage({ media, enabled: !isFormOnlyMode });

  // --- Shots ---

  const {
    allShots,
    onNavigateToShot,
    onShotChange,
    selectedShotId,
    positionedInSelectedShot,
    associatedWithoutPositionInSelectedShot,
    optimisticPositionedIds,
    optimisticUnpositionedIds,
    onAddToShot,
    onAddToShotWithoutPosition,
    onShowTick,
    onShowSecondaryTick,
    onOptimisticPositioned,
    onOptimisticUnpositioned,
  } = shotWorkflow ?? {};

  const { isCreatingShot, quickCreateSuccess, handleQuickCreateAndAdd, handleQuickCreateSuccess } = useShotCreation({
    media,
    selectedProjectId,
    allShots: allShots || [],
    onNavigateToShot,
    onClose,
    onShotChange,
  });

  const computedPositionedInSelectedShot = useMemo(
    () => (typeof positionedInSelectedShot === 'boolean' ? positionedInSelectedShot : undefined),
    [positionedInSelectedShot],
  );

  const {
    isAlreadyPositionedInSelectedShot,
    isAlreadyAssociatedWithoutPosition,
    handleAddToShot,
    handleAddToShotWithoutPosition,
  } = useShotPositioning({
    media,
    selectedShotId,
    allShots: allShots || [],
    positionedInSelectedShot: computedPositionedInSelectedShot,
    associatedWithoutPositionInSelectedShot,
    optimisticPositionedIds,
    optimisticUnpositionedIds,
    onNavigateToShot,
    onClose,
    onAddToShot,
    onAddToShotWithoutPosition,
    onShowTick,
    onShowSecondaryTick,
    onOptimisticPositioned,
    onOptimisticUnpositioned,
  });

  // --- Source generation & make-main-variant ---

  const { sourceGenerationData, sourcePrimaryVariant } = useSourceGeneration({
    media,
    onOpenExternalGeneration: input.onOpenExternalGeneration,
  });

  const canMakeMainVariantFromChild = !!sourceGenerationData && !!media.location;
  const canMakeMainVariantFromVariant = isViewingNonPrimaryVariant && !!activeVariant?.location;
  const canMakeMainVariant = canMakeMainVariantFromChild || canMakeMainVariantFromVariant;

  const { isMakingMainVariant, handleMakeMainVariant } = useMakeMainVariant({
    media,
    sourceGenerationData,
    canMakeMainVariantFromChild,
    canMakeMainVariantFromVariant,
    activeVariant,
    setPrimaryVariant,
    refetchVariants,
    shotId: shotsInput.shotId,
    selectedShotId: shotWorkflow?.selectedShotId,
    onClose,
  });

  // --- Navigation ---

  const { hasNext = false, hasPrevious = false, handleSlotNavNext, handleSlotNavPrev, swipeDisabled, showNavigation } = navInput;

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

  // --- Effective media & layout ---

  const { effectiveVideoUrl, effectiveMediaUrl, effectiveImageDimensions } = useEffectiveMedia({
    isVideo,
    activeVariant,
    effectiveImageUrl: mediaInput.effectiveImageUrl,
    imageDimensions: mediaInput.imageDimensions,
    projectAspectRatio: mediaInput.projectAspectRatio,
  });

  const layout = useLayoutMode({
    isMobile,
    showTaskDetails: layoutInput.showTaskDetails ?? false,
    isSpecialEditMode: layoutInput.isSpecialEditMode,
    isVideo,
    isInpaintMode: layoutInput.isInpaintMode ?? false,
    isMagicEditMode: layoutInput.isMagicEditMode ?? false,
  });

  // --- Button group ---

  const { showDownload, isDownloading, onDelete, isDeleting, isUpscaling, handleUpscale } = actions;

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    await invokeLightboxDelete(onDelete, media.id, 'MediaLightbox.delete');
  }, [onDelete, media.id]);

  const buttonGroupProps = useMemo<LightboxButtonGroupProps>(
    () => ({
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
        handleUpscale,
        localStarred: star.localStarred,
        handleToggleStar: star.handleToggleStar,
        toggleStarPending: star.toggleStarMutation.isPending,
      },
      bottomRight: {
        isAddingToReferences: referencesState.isAddingToReferences,
        addToReferencesSuccess: referencesState.addToReferencesSuccess,
        handleAddToReferences: referencesState.handleAddToReferences,
        handleAddToJoin: joinState.handleAddToJoin,
        isAddingToJoin: joinState.isAddingToJoin,
        addToJoinSuccess: joinState.addToJoinSuccess,
        onGoToJoin: joinState.handleGoToJoin,
      },
    }),
    [
      showDownload,
      isDownloading,
      onDelete,
      handleDelete,
      isDeleting,
      onClose,
      isUpscaling,
      handleUpscale,
      star.localStarred,
      star.handleToggleStar,
      star.toggleStarMutation.isPending,
      referencesState.isAddingToReferences,
      referencesState.addToReferencesSuccess,
      referencesState.handleAddToReferences,
      joinState.handleAddToJoin,
      joinState.isAddingToJoin,
      joinState.addToJoinSuccess,
      joinState.handleGoToJoin,
    ],
  );

  // --- Return ---

  return {
    variants: {
      list: variants || [],
      primaryVariant,
      activeVariant,
      isLoading: isLoadingVariants,
      setActiveVariantId,
      refetch: refetchVariants,
      setPrimaryVariant,
      deleteVariant,
      isViewingNonPrimaryVariant,
      promoteSuccess,
      isPromoting,
      handlePromoteToGeneration,
      handleAddVariantAsNewGenerationToShot,
    },
    intendedActiveVariantIdRef,
    navigation: {
      safeClose,
      activateClickShield,
      swipeNavigation,
    },
    star: {
      localStarred: star.localStarred,
      setLocalStarred: star.setLocalStarred,
      toggleStarMutation: star.toggleStarMutation,
      handleToggleStar: star.handleToggleStar,
    },
    references: {
      isAddingToReferences: referencesState.isAddingToReferences,
      addToReferencesSuccess: referencesState.addToReferencesSuccess,
      handleAddToReferences: referencesState.handleAddToReferences,
      isAddingToJoin: joinState.isAddingToJoin,
      addToJoinSuccess: joinState.addToJoinSuccess,
      handleAddToJoin: joinState.handleAddToJoin,
      handleGoToJoin: joinState.handleGoToJoin,
    },
    lineage: {
      derivedItems: lineageState.derivedItems || [],
      derivedGenerations: lineageState.derivedGenerations || [],
      derivedPage: lineageState.derivedPage,
      derivedTotalPages: lineageState.derivedTotalPages,
      paginatedDerived: lineageState.paginatedDerived || [],
      setDerivedPage: lineageState.setDerivedPage,
    },
    shots: {
      isAlreadyPositionedInSelectedShot,
      isAlreadyAssociatedWithoutPosition,
      handleAddToShot,
      handleAddToShotWithoutPosition,
      isCreatingShot,
      quickCreateSuccess,
      handleQuickCreateAndAdd,
      handleQuickCreateSuccess,
    },
    sourceGeneration: {
      data: sourceGenerationData,
      primaryVariant: sourcePrimaryVariant,
    },
    makeMainVariant: {
      canMake: canMakeMainVariant,
      canMakeFromChild: canMakeMainVariantFromChild,
      canMakeFromVariant: canMakeMainVariantFromVariant,
      isMaking: isMakingMainVariant,
      handle: handleMakeMainVariant,
    },
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
