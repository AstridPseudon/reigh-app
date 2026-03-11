import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GenerationRow } from '@/domains/generation/types';
import type {
  LightboxActionHandlers,
  LightboxFeatureFlags,
  LightboxNavigationProps,
  LightboxShotWorkflowProps,
} from '../types';
import { buildImageSharedLightboxInput } from './lightboxSharedBuilders';
import { useSharedLightboxState } from './useSharedLightboxState';
import type { ImageLightboxEnvironment } from './useImageLightboxEnvironment';

interface UseImageLightboxSharedStateProps {
  media: GenerationRow;
  onClose: () => void;
  readOnly?: boolean;
  shotId?: string;
  initialVariantId?: string;
  navigation?: LightboxNavigationProps;
  shotWorkflow?: LightboxShotWorkflowProps;
  features?: LightboxFeatureFlags;
  actions?: LightboxActionHandlers;
  onOpenExternalGeneration?: (generationId: string, derivedContext?: string[]) => Promise<void>;
}

export function useImageLightboxSharedState(
  props: UseImageLightboxSharedStateProps,
  env: ImageLightboxEnvironment,
) {
  const navigation = props.navigation;
  const { upscaleHook } = env;

  const handleSlotNavNext = useCallback(() => {
    navigation?.onNext?.();
  }, [navigation]);

  const handleSlotNavPrev = useCallback(() => {
    navigation?.onPrevious?.();
  }, [navigation]);

  const [modeSnapshot, setModeSnapshot] = useState({
    isInpaintMode: false,
    isMagicEditMode: false,
  });

  const sharedInput = useMemo(() => buildImageSharedLightboxInput({
    props,
    env,
    modeSnapshot,
    handleSlotNavNext,
    handleSlotNavPrev,
  }), [
    env,
    handleSlotNavNext,
    handleSlotNavPrev,
    modeSnapshot,
    props,
  ]);
  const sharedState = useSharedLightboxState(sharedInput);

  useEffect(() => {
    upscaleHook.setActiveVariant(sharedState.variants.activeVariant?.location, sharedState.variants.activeVariant?.id);
  }, [
    sharedState.variants.activeVariant?.location,
    sharedState.variants.activeVariant?.id,
    upscaleHook,
  ]);

  return {
    sharedState,
    handleSlotNavNext,
    handleSlotNavPrev,
    modeSnapshot,
    setModeSnapshot,
  };
}

export type ImageLightboxSharedModel = ReturnType<typeof useImageLightboxSharedState>;
