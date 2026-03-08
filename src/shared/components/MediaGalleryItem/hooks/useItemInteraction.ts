import { useCallback, useRef } from 'react';
import type { GeneratedImageWithMetadata } from '@/shared/components/MediaGallery/types';
import { captureTouchStartPoint, isTouchTapWithinThreshold } from '@/shared/lib/touch/touchGestureUtils';

interface UseItemInteractionParams {
  image: GeneratedImageWithMetadata;
  isMobile: boolean;
  mobileActiveImageId: string | null;
  enableSingleClick: boolean;
  onImageClick?: (image: GeneratedImageWithMetadata) => void;
  onMobileTap: (image: GeneratedImageWithMetadata) => void;
}

export function useItemInteraction({
  image,
  isMobile,
  mobileActiveImageId,
  enableSingleClick,
  onImageClick,
  onMobileTap,
}: UseItemInteractionParams) {
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    captureTouchStartPoint(touchStartPosRef, event);
  }, []);

  const handleInteraction = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    const path = (event.nativeEvent as Event)?.composedPath?.() as HTMLElement[] | undefined;
    const isInsideButton = path
      ? path.some((element) => (element as HTMLElement)?.tagName === 'BUTTON' || (element as HTMLElement)?.closest?.('button'))
      : Boolean((event.target as HTMLElement).closest('button'));

    const isItemActive = mobileActiveImageId === image.id;
    if (isInsideButton && isItemActive) {
      return;
    }

    if (event.type === 'touchend') {
      const isTap = isTouchTapWithinThreshold(
        touchStartPosRef,
        event as React.TouchEvent,
        10,
      );
      if (!isTap) {
        return;
      }
    }

    event.preventDefault();

    if (enableSingleClick && onImageClick) {
      onImageClick(image);
      return;
    }

    if (isMobile) {
      onMobileTap(image);
    }
  }, [mobileActiveImageId, image, enableSingleClick, onImageClick, isMobile, onMobileTap]);

  return {
    handleTouchStart,
    handleInteraction,
  };
}
