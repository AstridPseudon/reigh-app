/**
 * useSharedLightboxState
 *
 * Shared state orchestrator for ImageLightbox and VideoLightbox.
 * Domain facets are split into dedicated modules:
 * - useSharedLightboxState.variants
 * - useSharedLightboxState.interaction
 * - useSharedLightboxState.presentation
 */

import {
  type SharedInteractionInput,
  type SharedPresentationInput,
  type UseSharedLightboxStateInput,
  type UseSharedLightboxStateReturn,
} from './useSharedLightboxState.types';
import { useSharedVariantsState } from './useSharedLightboxState.variants';
import { useSharedLightboxInteractionState } from './useSharedLightboxState.interaction';
import { useLightboxPanelModel } from './useSharedLightboxState.presentation';

export function useSharedLightboxState(input: UseSharedLightboxStateInput): UseSharedLightboxStateReturn {
  const variantsState = useSharedVariantsState({ core: input.core });
  const interactionInput: SharedInteractionInput = {
    core: input.core,
    shots: input.shots,
    starred: input.starred,
    onOpenExternalGeneration: input.onOpenExternalGeneration,
  };
  const interactionState = useSharedLightboxInteractionState(interactionInput, variantsState);

  const presentationInput: SharedPresentationInput = {
    core: input.core,
    navigation: input.navigation,
    layout: input.layout,
    actions: input.actions,
    media: input.media,
  };
  const presentationState = useLightboxPanelModel(presentationInput, variantsState, interactionState);

  return {
    variants: presentationState.variants,
    intendedActiveVariantIdRef: presentationState.intendedActiveVariantIdRef,
    navigation: presentationState.navigation,
    star: interactionState.star,
    references: interactionState.references,
    lineage: interactionState.lineage,
    shots: interactionState.shots,
    sourceGeneration: interactionState.sourceGeneration,
    makeMainVariant: interactionState.makeMainVariant,
    effectiveMedia: presentationState.effectiveMedia,
    layout: presentationState.layout,
    buttonGroupProps: presentationState.buttonGroupProps,
  };
}

export { useSharedVariantsState } from './useSharedLightboxState.variants';
export {
  useLightboxShotActions,
  useSharedLightboxInteractionState,
} from './useSharedLightboxState.interaction';
export {
  useLightboxNavigationModel,
  useLightboxPanelModel,
} from './useSharedLightboxState.presentation';
export type {
  LightboxButtonGroupProps,
  SharedInteractionInput,
  SharedLightboxButtonGroupProps,
  SharedLightboxCoreProps,
  SharedLightboxInteractionState,
  SharedLightboxLayoutProps,
  SharedLightboxMediaProps,
  SharedLightboxNavigationProps,
  SharedLightboxPresentationState,
  SharedLightboxShotProps,
  SharedNavigationInput,
  SharedPresentationInput,
  SharedShotActionsInput,
  SharedVariantsInput,
  SharedVariantsStateResult,
  UseSharedLightboxStateInput,
  UseSharedLightboxStateReturn,
} from './useSharedLightboxState.types';
