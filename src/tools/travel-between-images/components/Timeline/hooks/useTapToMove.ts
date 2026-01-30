import { useState, useCallback, useRef } from 'react';

/**
 * useTapToMove - Tablet-specific tap-to-select and tap-to-place interaction
 *
 * Provides a two-tap interaction for tablets:
 * 1. First tap: Select an item (shows visual indicator)
 * 2. Second tap: Move item to the tapped location or deselect if tapping same item
 *
 * With multi-select support:
 * - When external selectedIds are provided with >1 items, timeline tap moves all selected items
 * - Items are bundled 5 frames apart at the target position
 *
 * Features:
 * - Visual feedback for selected state
 * - Auto-deselect after placing
 * - Cancel selection by tapping same item
 * - Only active on tablets (not phones or desktop)
 */
interface UseTapToMoveProps {
  isEnabled: boolean; // Should be true for tablets, false for phones and desktop
  onMove: (imageId: string, targetFrame: number) => void;
  /** Callback for moving multiple items at once */
  onMoveMultiple?: (imageIds: string[], targetFrame: number) => void;
  framePositions: Map<string, number>;
  fullMin: number;
  fullRange: number;
  timelineWidth: number;
  /** External selected IDs for multi-select mode */
  selectedIds?: string[];
  /** Callback when selection changes (for syncing with external selection) */
  onSelectionChange?: (selectedId: string | null) => void;
}

interface TapToMoveState {
  selectedItemId: string | null;
  isItemSelected: (imageId: string) => boolean;
  handleItemTap: (imageId: string) => void;
  handleTimelineTap: (clientX: number, containerRef: React.RefObject<HTMLDivElement>) => void;
  clearSelection: () => void;
}

export const useTapToMove = ({
  isEnabled,
  onMove,
  onMoveMultiple,
  framePositions,
  fullMin,
  fullRange,
  timelineWidth,
  selectedIds = [],
  onSelectionChange,
}: UseTapToMoveProps): TapToMoveState => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use external selection if multiple items are selected, otherwise use internal
  const effectiveSelectedIds = selectedIds.length > 1 ? selectedIds : (selectedItemId ? [selectedItemId] : []);
  const hasMultiSelection = selectedIds.length > 1;

  // Check if an item is currently selected
  const isItemSelected = useCallback((imageId: string): boolean => {
    if (!isEnabled) return false;
    // If multi-select is active, check external selection
    if (hasMultiSelection) {
      return selectedIds.includes(imageId);
    }
    // Otherwise use internal selection
    return selectedItemId === imageId;
  }, [isEnabled, selectedItemId, selectedIds, hasMultiSelection]);

  // Handle tap on a timeline item
  const handleItemTap = useCallback((imageId: string) => {
    console.log('[DoubleTapFlow] 🎯 useTapToMove handleItemTap called:', {
      imageId: imageId.substring(0, 8),
      isEnabled,
      hasMultiSelection,
      currentlySelected: selectedItemId?.substring(0, 8),
      willToggle: selectedItemId === imageId ? 'DESELECT' : 'SELECT'
    });

    if (!isEnabled) {
      console.log('[DoubleTapFlow] ⚠️ TapToMove not enabled - ignoring');
      return;
    }

    // If multi-select is active externally, don't manage internal selection
    if (hasMultiSelection) {
      console.log('[DoubleTapFlow] 📦 Multi-select active - deferring to external selection');
      return;
    }

    // If tapping the same item, deselect it
    if (selectedItemId === imageId) {
      console.log('[DoubleTapFlow] 🔄 DESELECTING item (same item tapped)');
      setSelectedItemId(null);
      onSelectionChange?.(null);
      return;
    }

    // Otherwise, select this item
    console.log('[DoubleTapFlow] ✅ SELECTING item for tap-to-move');
    setSelectedItemId(imageId);
    onSelectionChange?.(imageId);

    // Auto-clear selection after 30 seconds if no action taken
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    tapTimeoutRef.current = setTimeout(() => {
      console.log('[DoubleTapFlow] ⏰ Auto-clearing selection after 30s timeout');
      setSelectedItemId(null);
      onSelectionChange?.(null);
    }, 30000);
  }, [isEnabled, selectedItemId, hasMultiSelection, onSelectionChange]);

  // Handle tap on the timeline (to place selected item(s))
  const handleTimelineTap = useCallback((clientX: number, containerRef: React.RefObject<HTMLDivElement>) => {
    if (!isEnabled || !containerRef.current) return;

    // Check if we have anything to move
    const idsToMove = effectiveSelectedIds;
    if (idsToMove.length === 0) return;

    // Calculate target frame from tap position
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;

    // Account for padding (same logic as useTimelineDrag)
    const effectiveWidth = timelineWidth - (32 * 2); // 32px padding on each side
    const adjustedX = relativeX - 32; // Account for left padding
    const normalizedX = Math.max(0, Math.min(1, adjustedX / effectiveWidth));
    const targetFrame = Math.round(fullMin + (normalizedX * fullRange));

    console.log('[TapToMove] Timeline tapped - placing item(s):', {
      selectedCount: idsToMove.length,
      selectedIds: idsToMove.map(id => id.substring(0, 8)),
      clientX,
      relativeX,
      targetFrame,
      isMultiMove: idsToMove.length > 1,
    });

    // Move the item(s)
    if (idsToMove.length > 1 && onMoveMultiple) {
      // Multi-item move: bundle items together
      console.log('[TapToMove] 📦 Moving multiple items bundled together');
      onMoveMultiple(idsToMove, targetFrame);
    } else if (idsToMove.length === 1) {
      // Single item move
      onMove(idsToMove[0], targetFrame);
    }

    // Clear internal selection after placing
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    setSelectedItemId(null);
    onSelectionChange?.(null);
  }, [isEnabled, effectiveSelectedIds, onMove, onMoveMultiple, fullMin, fullRange, timelineWidth, onSelectionChange]);

  // Clear selection manually
  const clearSelection = useCallback(() => {
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    setSelectedItemId(null);
    onSelectionChange?.(null);
  }, [onSelectionChange]);

  return {
    selectedItemId,
    isItemSelected,
    handleItemTap,
    handleTimelineTap,
    clearSelection
  };
};
