import { useRef, useState, useCallback, useEffect } from 'react';
import { useTemporaryVisibility } from '@/shared/hooks/useTemporaryVisibility';
import { useClickOutside } from '@/shared/hooks/useClickOutside';

const SCROLL_THRESHOLD = 10;
const DOUBLE_TAP_DELAY = 300;
const MIN_DURATION_FRAMES = 10;
const EDGE_SNAP_THRESHOLD = 5;

interface SiblingRange {
  start: number;
  end: number;
}

interface UseTabletEndpointSelectionOptions {
  /** Whether tablet tap-to-select is enabled (isTablet && !readOnly && onRangeChange) */
  enabled: boolean;
  /** Whether the strip is in active (handles-visible) mode */
  isStripActive: boolean;
  /** Whether this is a tablet device */
  isTablet: boolean;
  /** Strip position as percent of container width */
  stripLeftPercent: number;
  /** Strip width as percent of container width */
  stripWidthPercent: number;
  /** Timeline coordinate system */
  fullMin: number;
  fullMax: number;
  fullRange: number;
  /** Current output range of this strip */
  effectiveOutputStart: number;
  effectiveOutputEnd: number;
  /** Sibling video ranges for collision detection */
  siblingRanges: SiblingRange[];
  /** Ref to the outer container element (for tap-to-place coordinate mapping) */
  outerContainerRef: React.RefObject<HTMLDivElement | null>;

  // Callbacks
  onRangeChange?: (startFrame: number, endFrame: number) => void;
  /** Called on double-tap on the strip body */
  onDoubleTap: () => void;
  /** Called on single-tap on the strip body (for frame preview) */
  onSingleTap: (touch: Touch) => void;
}

interface UseTabletEndpointSelectionReturn {
  /** Currently selected endpoint, or null */
  selectedEndpoint: 'left' | 'right' | null;
  /** Clear the endpoint selection (for parent click-outside handlers) */
  clearSelection: () => void;
  /** Whether the tap-to-place hint should be shown */
  tapToPlaceHintVisible: boolean;
  /** Touch start handler for resize handle endpoints */
  handleEndpointTouchStart: (endpoint: 'left' | 'right', e: React.TouchEvent) => void;
  /** Touch end handler for resize handle endpoints */
  handleEndpointTouchEnd: (endpoint: 'left' | 'right', e: React.TouchEvent) => void;
  /** Touch start handler for the strip body */
  handleStripTouchStart: (e: React.TouchEvent) => void;
  /** Touch end handler for the strip body (handles tap-to-place, double-tap, and single-tap) */
  handleStripTouchEnd: (e: React.TouchEvent) => void;
}

/**
 * Hook for tablet touch gesture handling on timeline strips.
 *
 * Manages:
 * - Endpoint selection (tap on resize handle to select, tap elsewhere to place)
 * - Double-tap detection (to toggle strip active state)
 * - Single-tap frame preview (delegates to parent via callback)
 * - Scroll vs tap discrimination (ignores touches that moved beyond threshold)
 */
export function useTabletEndpointSelection(
  options: UseTabletEndpointSelectionOptions,
): UseTabletEndpointSelectionReturn {
  const {
    enabled,
    isStripActive,
    isTablet,
    stripLeftPercent,
    stripWidthPercent,
    fullMin,
    fullMax,
    fullRange,
    effectiveOutputStart,
    effectiveOutputEnd,
    siblingRanges,
    outerContainerRef,
    onRangeChange,
    onDoubleTap,
    onSingleTap,
  } = options;

  const [selectedEndpoint, setSelectedEndpoint] = useState<'left' | 'right' | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  // Tap-to-place hint visibility
  const tapToPlaceHint = useTemporaryVisibility(2000);

  // Show/hide tap-to-place hint when endpoint selection changes
  useEffect(() => {
    if (selectedEndpoint && enabled) {
      tapToPlaceHint.show();
    } else {
      tapToPlaceHint.hide();
    }
  }, [selectedEndpoint, enabled, tapToPlaceHint]);

  // iPad: touch outside to deselect endpoint
  useClickOutside(
    () => setSelectedEndpoint(null),
    { events: ['touchstart'], enabled: !!selectedEndpoint && !!enabled, delay: 100 },
    outerContainerRef as React.RefObject<HTMLDivElement>
  );

  /** Clear endpoint selection (for use by parent click-outside handlers) */
  const clearSelection = useCallback(() => {
    setSelectedEndpoint(null);
  }, []);

  // Touch start handler for resize handle endpoints
  const handleEndpointTouchStart = useCallback((_endpoint: 'left' | 'right', e: React.TouchEvent) => {
    if (!enabled) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
  }, [enabled]);

  // Touch end handler for resize handle endpoints
  const handleEndpointTouchEnd = useCallback((_endpoint: 'left' | 'right', e: React.TouchEvent) => {
    if (!enabled || !touchStartPosRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);
    touchStartPosRef.current = null;

    if (deltaX > SCROLL_THRESHOLD || deltaY > SCROLL_THRESHOLD) return;

    e.preventDefault();
    e.stopPropagation();
    setSelectedEndpoint(prev => prev === _endpoint ? null : _endpoint);
  }, [enabled]);

  // Handle tap on strip area to place the selected endpoint
  const handleStripTapToPlace = useCallback((e: React.TouchEvent) => {
    if (!enabled || !selectedEndpoint || !outerContainerRef.current || !onRangeChange) return;

    const touch = e.changedTouches[0];
    const rect = outerContainerRef.current.getBoundingClientRect();
    const tapX = touch.clientX;

    if (stripWidthPercent < 1) {
      setSelectedEndpoint(null);
      return;
    }

    // Find sibling boundaries
    let leftLimit = Math.max(0, fullMin);
    let rightLimit = Math.min(fullMax, fullMax);
    for (const sibling of siblingRanges) {
      if (sibling.end <= effectiveOutputStart && sibling.end > leftLimit) {
        leftLimit = sibling.end;
      }
      if (sibling.start >= effectiveOutputEnd && sibling.start < rightLimit) {
        rightLimit = sibling.start;
      }
    }

    // Calculate target frame
    const fullTimelineWidth = rect.width / (stripWidthPercent / 100);
    const timelineLeft = rect.left - (stripLeftPercent / 100) * fullTimelineWidth;
    const normalizedX = Math.max(0, Math.min(1, (tapX - timelineLeft) / fullTimelineWidth));
    const targetFrame = Math.round(fullMin + normalizedX * fullRange);

    if (selectedEndpoint === 'left') {
      let newStart: number;
      if (targetFrame <= leftLimit + EDGE_SNAP_THRESHOLD) {
        newStart = leftLimit;
      } else {
        newStart = Math.max(leftLimit, targetFrame);
      }
      newStart = Math.min(newStart, effectiveOutputEnd - MIN_DURATION_FRAMES);
      newStart = Math.max(fullMin, Math.min(newStart, fullMax - MIN_DURATION_FRAMES));
      onRangeChange(newStart, effectiveOutputEnd);
    } else {
      let newEnd: number;
      if (targetFrame >= rightLimit - EDGE_SNAP_THRESHOLD) {
        newEnd = rightLimit;
      } else {
        newEnd = Math.min(rightLimit, targetFrame);
      }
      newEnd = Math.max(newEnd, effectiveOutputStart + MIN_DURATION_FRAMES);
      newEnd = Math.min(fullMax, Math.max(newEnd, fullMin + MIN_DURATION_FRAMES));
      onRangeChange(effectiveOutputStart, newEnd);
    }

    setSelectedEndpoint(null);
  }, [enabled, selectedEndpoint, stripLeftPercent, stripWidthPercent, fullMin, fullMax, fullRange, effectiveOutputStart, effectiveOutputEnd, siblingRanges, onRangeChange, outerContainerRef]);

  // Track touch start for tap detection on strip body
  const handleStripTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
  }, [enabled]);

  // Touch end handler for strip body - dispatches to tap-to-place, double-tap, or single-tap
  const handleStripTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);
    touchStartPosRef.current = null;

    if (deltaX > SCROLL_THRESHOLD || deltaY > SCROLL_THRESHOLD) return;

    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-resize-handle]')) return;

    // If endpoint selected and strip active, place it
    if (selectedEndpoint && isStripActive && enabled) {
      handleStripTapToPlace(e);
      return;
    }

    // Double-tap detection for iPad
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    lastTapTimeRef.current = now;

    if (timeSinceLastTap < DOUBLE_TAP_DELAY && isTablet) {
      e.preventDefault();
      setSelectedEndpoint(null);
      onDoubleTap();
    } else if (isTablet && !isStripActive) {
      // Single tap - delegate to parent for frame preview
      e.preventDefault();
      onSingleTap(touch);
    }
  }, [enabled, selectedEndpoint, handleStripTapToPlace, isTablet, isStripActive, onDoubleTap, onSingleTap]);

  return {
    selectedEndpoint,
    clearSelection,
    tapToPlaceHintVisible: tapToPlaceHint.isVisible,
    handleEndpointTouchStart,
    handleEndpointTouchEnd,
    handleStripTouchStart,
    handleStripTouchEnd,
  };
}

/** Returned clearSelection function type for parent click-outside handlers */
export type { UseTabletEndpointSelectionReturn };
