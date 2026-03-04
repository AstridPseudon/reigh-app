import { useEffect, useState } from 'react';
import type { ClipPairInfo } from '@/shared/components/JoinClipsSettingsForm/types';

interface UseClipPairSelectionResult {
  selectedPairIndex: number;
  setSelectedPairIndex: (index: number) => void;
  selectedPair: ClipPairInfo | undefined;
  hasPairs: boolean;
  hasMultiplePairs: boolean;
}

export function useClipPairSelection(
  clipPairs?: ClipPairInfo[]
): UseClipPairSelectionResult {
  const [selectedPairIndex, setSelectedPairIndex] = useState(0);
  const pairCount = clipPairs?.length ?? 0;

  useEffect(() => {
    if (pairCount === 0) {
      if (selectedPairIndex !== 0) {
        setSelectedPairIndex(0);
      }
      return;
    }
    if (selectedPairIndex >= pairCount) {
      setSelectedPairIndex(pairCount - 1);
    }
  }, [pairCount, selectedPairIndex]);

  return {
    selectedPairIndex,
    setSelectedPairIndex,
    selectedPair: clipPairs?.[selectedPairIndex],
    hasPairs: pairCount > 0,
    hasMultiplePairs: pairCount > 1,
  };
}
