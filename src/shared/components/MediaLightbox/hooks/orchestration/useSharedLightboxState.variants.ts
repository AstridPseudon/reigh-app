import { useRef, useEffect, useCallback } from 'react';
import { useVariants } from '@/shared/hooks/useVariants';
import { useVariantSelection } from '../useVariantSelection';
import { useVariantPromotion } from '../useVariantPromotion';
import type {
  SharedVariantsInput,
  SharedVariantsStateResult,
} from './useSharedLightboxState.types';

/**
 * Variants sub-facade: variant loading, selection, promotion.
 * Usable standalone when callers only need variant state.
 */
export function useSharedVariantsState(input: SharedVariantsInput): SharedVariantsStateResult {
  const {
    media,
    isFormOnlyMode,
    variantFetchGenerationId,
    initialVariantId,
    selectedProjectId,
  } = input.core;
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
    generationId: variantFetchGenerationId,
    enabled: !isFormOnlyMode,
  });
  const { setActiveVariantId: baseSetActiveVariantId, isViewingNonPrimaryVariant } = useVariantSelection({
    media,
    viewedGenerationId: variantFetchGenerationId,
    rawSetActiveVariantId,
    activeVariant,
    variants,
    initialVariantId,
  });
  const intendedActiveVariantIdRef = useRef<string | null>(activeVariant?.id || null);
  const {
    promoteSuccess,
    isPromoting,
    handlePromoteToGeneration,
    handleAddVariantAsNewGenerationToShot,
  } = useVariantPromotion({
    selectedProjectId,
  });

  useEffect(() => {
    if (activeVariant?.id && activeVariant.id !== intendedActiveVariantIdRef.current) {
      intendedActiveVariantIdRef.current = activeVariant.id;
    }
  }, [activeVariant?.id]);

  const setActiveVariantId = useCallback((variantId: string) => {
    intendedActiveVariantIdRef.current = variantId;
    baseSetActiveVariantId(variantId);
  }, [baseSetActiveVariantId]);

  return {
    section: {
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
    activeVariant,
    primaryVariant,
    isViewingNonPrimaryVariant,
    setPrimaryVariant,
    refetchVariants,
  };
}
