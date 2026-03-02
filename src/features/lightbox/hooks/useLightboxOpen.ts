import { useLightboxOpenState } from '@/features/lightbox/state/lightboxOpenState';

/**
 * Returns true when MediaLightbox is open in non-modal mode.
 * State is published by the Lightbox viewport lock flow.
 */
export const useLightboxOpen = (): boolean => {
  return useLightboxOpenState();
};
