import type { PortionSelection } from '@/shared/components/VideoPortionTimeline';

export {
  quantizeGapFrameCount,
  calculateGapFramesFromRange,
} from './replaceModeGapMath';
export {
  getDefaultSelectionRange,
  getNewSelectionRange,
} from './replaceModeSelectionPlacement';
export {
  selectionsToFrameRanges,
  calculateMaxContextFrames,
  capContextFrameCountForRanges,
} from './replaceModeFrameRanges';
export type { ReplaceFrameRangeSelection } from './replaceModeFrameRanges';

export function validatePortionSelections({
  selections,
  videoFps,
  videoDuration,
}: {
  selections: PortionSelection[];
  videoFps: number | null;
  videoDuration: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (selections.length === 0) {
    errors.push('No portions selected');
    return { isValid: false, errors };
  }

  if (videoFps === null) {
    errors.push('Video FPS not detected yet');
    return { isValid: false, errors };
  }

  for (let i = 0; i < selections.length; i++) {
    const selection = selections[i];
    const selNum = selections.length > 1 ? ` #${i + 1}` : '';

    if (selection.start >= selection.end) {
      errors.push(`Portion${selNum}: Start must be before end`);
    }

    const duration = selection.end - selection.start;
    if (duration < 0.1) {
      errors.push(`Portion${selNum}: Too short (min 0.1s)`);
    }

    if (selection.start < 0) {
      errors.push(`Portion${selNum}: Starts before video`);
    }
    if (selection.end > videoDuration) {
      errors.push(`Portion${selNum}: Extends past video end`);
    }
  }

  if (selections.length > 1) {
    const sorted = [...selections].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].end > sorted[i + 1].start) {
        errors.push('Portions overlap');
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}
