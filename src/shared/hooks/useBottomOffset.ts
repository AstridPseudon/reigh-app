import { usePanes } from '@/shared/contexts/PanesContext';
import { useLightboxOpen } from './useLightboxOpen';

/**
 * Custom hook to calculate the bottom offset for pane positioning.
 * This offset is used to position side pane handles above the generations pane
 * when it's open or locked.
 *
 * Returns 0 when a lightbox is open because the generations pane is hidden
 * behind it, while the side pane handles float above — shifting them up
 * for an invisible pane makes no sense.
 *
 * @returns The calculated bottom offset in pixels
 */
export const useBottomOffset = (): number => {
  const {
    isGenerationsPaneLocked,
    isGenerationsPaneOpen,
    generationsPaneHeight
  } = usePanes();
  const isLightboxOpen = useLightboxOpen();

  if (isLightboxOpen) return 0;

  return (isGenerationsPaneLocked || isGenerationsPaneOpen)
    ? generationsPaneHeight
    : 0;
}; 