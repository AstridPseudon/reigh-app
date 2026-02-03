import { useState, useCallback, useRef } from 'react';
import type { ImageTransform } from './types';

export interface UseRepositionDragProps {
  transform: ImageTransform;
  imageDimensions: { width: number; height: number } | null;
  imageContainerRef: React.RefObject<HTMLDivElement>;
  /** Callback to update transform when dragging */
  onTransformChange: (updates: Partial<ImageTransform>) => void;
}

export interface UseRepositionDragReturn {
  isDragging: boolean;
  dragHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

/**
 * Hook for drag-to-move functionality in reposition mode.
 * Handles pointer events for both mouse and touch dragging.
 */
export function useRepositionDrag({
  transform,
  imageDimensions,
  imageContainerRef,
  onTransformChange,
}: UseRepositionDragProps): UseRepositionDragReturn {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    translateX: number;
    translateY: number;
  } | null>(null);

  const handleDragPointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle primary pointer (left mouse button or first touch)
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Capture pointer for tracking outside element bounds
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      translateX: transform.translateX,
      translateY: transform.translateY,
    };

    e.preventDefault();
    e.stopPropagation();
  }, [transform.translateX, transform.translateY]);

  const handleDragPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current || !imageDimensions) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    // Get the displayed image size from the container
    // We need to convert pixel movement to percentage of image dimensions
    const containerEl = imageContainerRef.current;
    if (!containerEl) return;

    // Find the actual displayed image element to get its rendered size
    const imgEl = containerEl.querySelector('img');
    const displayedWidth = imgEl?.clientWidth || imageDimensions.width;
    const displayedHeight = imgEl?.clientHeight || imageDimensions.height;

    // Convert pixel delta to percentage
    // Account for current scale - dragging should feel consistent regardless of zoom
    const effectiveScale = transform.scale || 1;
    const deltaXPercent = (deltaX / displayedWidth) * 100 / effectiveScale;
    const deltaYPercent = (deltaY / displayedHeight) * 100 / effectiveScale;

    // Apply new translate values (clamped to +/-100%)
    const maxTranslate = 100;
    const newTranslateX = Math.max(
      -maxTranslate,
      Math.min(maxTranslate, dragStartRef.current.translateX + deltaXPercent)
    );
    const newTranslateY = Math.max(
      -maxTranslate,
      Math.min(maxTranslate, dragStartRef.current.translateY + deltaYPercent)
    );

    onTransformChange({
      translateX: newTranslateX,
      translateY: newTranslateY,
    });
  }, [isDragging, imageDimensions, imageContainerRef, transform.scale, onTransformChange]);

  const handleDragPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;

    // Release pointer capture
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    setIsDragging(false);
    dragStartRef.current = null;
  }, [isDragging]);

  const handleDragPointerCancel = useCallback((e: React.PointerEvent) => {
    // Same as pointer up - end the drag
    handleDragPointerUp(e);
  }, [handleDragPointerUp]);

  return {
    isDragging,
    dragHandlers: {
      onPointerDown: handleDragPointerDown,
      onPointerMove: handleDragPointerMove,
      onPointerUp: handleDragPointerUp,
      onPointerCancel: handleDragPointerCancel,
    },
  };
}
