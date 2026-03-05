import type { PortionSelection } from '@/shared/components/VideoPortionTimeline';

const DEFAULT_SELECTION_START_RATIO = 0.1;
const DEFAULT_SELECTION_END_RATIO = 0.2;
const FALLBACK_SELECTION_START_RATIO = 0.4;
const FALLBACK_SELECTION_END_RATIO = 0.5;
const NEW_SELECTION_WIDTH_RATIO = 0.1;
const NEW_SELECTION_GAP_RATIO = 0.1;

export function getDefaultSelectionRange(videoDuration: number): { start: number; end: number } {
  return {
    start: videoDuration * DEFAULT_SELECTION_START_RATIO,
    end: videoDuration * DEFAULT_SELECTION_END_RATIO,
  };
}

export function getNewSelectionRange(selections: PortionSelection[], videoDuration: number): { start: number; end: number } {
  const sortedSelections = [...selections].sort((a, b) => a.end - b.end);
  const lastSelection = sortedSelections[sortedSelections.length - 1];
  if (!lastSelection) {
    return getDefaultSelectionRange(videoDuration);
  }

  const selectionWidth = videoDuration * NEW_SELECTION_WIDTH_RATIO;
  const gap = videoDuration * NEW_SELECTION_GAP_RATIO;

  const afterStart = lastSelection.end + gap;
  const afterEnd = afterStart + selectionWidth;
  if (afterEnd <= videoDuration) {
    return { start: afterStart, end: afterEnd };
  }

  const firstSelection = sortedSelections[0];
  const beforeEnd = firstSelection.start - gap;
  const beforeStart = beforeEnd - selectionWidth;
  if (beforeStart >= 0) {
    return { start: beforeStart, end: beforeEnd };
  }

  return {
    start: videoDuration * FALLBACK_SELECTION_START_RATIO,
    end: videoDuration * FALLBACK_SELECTION_END_RATIO,
  };
}
