import { useMemo } from 'react';
import type { GenerationRow } from '@/domains/generation/types';
import type { GenerationVariant } from '@/shared/hooks/useVariants';
import { useStarToggle } from '../useStarToggle';
import { useReferences } from '../useReferences';
import { useJoinClips } from '../useJoinClips';
import { useGenerationLineage } from '../useGenerationLineage';
import { useShotPositioning } from '../useShotPositioning';
import { useShotCreation } from '../useShotCreation';
import { useSourceGeneration } from '../useSourceGeneration';
import { useMakeMainVariant } from '../useMakeMainVariant';
import type {
  SharedInteractionInput,
  SharedLightboxInteractionState,
  SharedShotActionsInput,
  SharedVariantsStateResult,
  UseSharedLightboxStateReturn,
} from './useSharedLightboxState.types';

/**
 * Shot management sub-facade: positioning, creation, association state.
 * Usable standalone when callers only need shot management.
 */
export function useLightboxShotActions(input: SharedShotActionsInput): UseSharedLightboxStateReturn['shots'] {
  const { media, selectedProjectId, onClose } = input.core;
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
  } = input.shots;
  const {
    isCreatingShot,
    quickCreateSuccess,
    handleQuickCreateAndAdd,
    handleQuickCreateSuccess,
  } = useShotCreation({
    media,
    selectedProjectId,
    allShots: allShots || [],
    onNavigateToShot,
    onClose,
    onShotChange,
  });
  const computedPositionedInSelectedShot = useMemo(() => (
    typeof positionedInSelectedShot === 'boolean' ? positionedInSelectedShot : undefined
  ), [positionedInSelectedShot]);
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

  return {
    isAlreadyPositionedInSelectedShot,
    isAlreadyAssociatedWithoutPosition,
    handleAddToShot,
    handleAddToShotWithoutPosition,
    isCreatingShot,
    quickCreateSuccess,
    handleQuickCreateAndAdd,
    handleQuickCreateSuccess,
  };
}

function useSharedMakeMainVariantState(params: {
  media: GenerationRow;
  sourceGenerationData: GenerationRow | null;
  isViewingNonPrimaryVariant: boolean;
  activeVariant: GenerationVariant | null;
  setPrimaryVariant: (id: string) => Promise<void>;
  refetchVariants: () => void;
  shotId?: string;
  selectedShotId?: string;
  onClose: () => void;
}): UseSharedLightboxStateReturn['makeMainVariant'] {
  const {
    media,
    sourceGenerationData,
    isViewingNonPrimaryVariant,
    activeVariant,
    setPrimaryVariant,
    refetchVariants,
    shotId,
    selectedShotId,
    onClose,
  } = params;
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
    shotId,
    selectedShotId,
    onClose,
  });

  return {
    canMake: canMakeMainVariant,
    canMakeFromChild: canMakeMainVariantFromChild,
    canMakeFromVariant: canMakeMainVariantFromVariant,
    isMaking: isMakingMainVariant,
    handle: handleMakeMainVariant,
  };
}

export function useSharedLightboxInteractionState(
  input: SharedInteractionInput,
  variantsState: SharedVariantsStateResult,
): SharedLightboxInteractionState {
  const star = useStarToggle({
    media: input.core.media,
    starred: input.starred,
    shotId: input.shots.shotId,
  });
  const referencesState = useReferences({
    media: input.core.media,
    selectedProjectId: input.core.selectedProjectId,
    isVideo: input.core.isVideo,
    selectedShotId: input.shots.selectedShotId,
  });
  const joinState = useJoinClips({
    media: input.core.media,
    isVideo: input.core.isVideo,
    selectedProjectId: input.core.selectedProjectId,
  });
  const lineageState = useGenerationLineage({
    media: input.core.media,
    enabled: !input.core.isFormOnlyMode,
  });
  const shots = useLightboxShotActions(input);
  const { sourceGenerationData, sourcePrimaryVariant } = useSourceGeneration({
    media: input.core.media,
    onOpenExternalGeneration: input.onOpenExternalGeneration,
  });
  const makeMainVariant = useSharedMakeMainVariantState({
    media: input.core.media,
    sourceGenerationData,
    isViewingNonPrimaryVariant: variantsState.isViewingNonPrimaryVariant,
    activeVariant: variantsState.activeVariant,
    setPrimaryVariant: variantsState.setPrimaryVariant,
    refetchVariants: variantsState.refetchVariants,
    shotId: input.shots.shotId,
    selectedShotId: input.shots.selectedShotId,
    onClose: input.core.onClose,
  });

  return {
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
    shots,
    sourceGeneration: {
      data: sourceGenerationData,
      primaryVariant: sourcePrimaryVariant,
    },
    makeMainVariant,
  };
}
