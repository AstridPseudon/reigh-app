import { usePanes } from '@/shared/contexts/PanesContext';
import { useLightboxOpenState } from '@/shared/state/lightboxOpenState';

/**
 * Calculates side-pane handle offset from the generations pane state.
 */
export const useBottomOffset = (): number => {
  const {
    isGenerationsPaneLocked,
    isGenerationsPaneOpen,
    effectiveGenerationsPaneHeight,
  } = usePanes();
  const isLightboxOpen = useLightboxOpenState();

  if (isLightboxOpen) return 0;

  return (isGenerationsPaneLocked || isGenerationsPaneOpen)
    ? effectiveGenerationsPaneHeight
    : 0;
};
