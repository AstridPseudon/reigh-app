import React from 'react';
import { Film } from 'lucide-react';
import { ClipPairSelector } from '@/shared/components/JoinClipsSettingsForm/components/ClipPairSelector';
import { ClipTimeline } from '@/shared/components/JoinClipsSettingsForm/components/ClipTimeline';
import { useClipPairSelection } from '@/shared/components/JoinClipsSettingsForm/hooks/useClipPairSelection';
import { getClipFrameCalculations } from '@/shared/components/JoinClipsSettingsForm/lib/clipFrameCalculations';
import type { ClipPairInfo } from '@/shared/components/JoinClipsSettingsForm/types';

interface VisualizationProps {
  gapFrames: number;
  contextFrames: number;
  replaceMode: boolean;
  keepBridgingImages: boolean;
  infoContent?: React.ReactNode;
  clipPairs?: ClipPairInfo[];
}

export const Visualization: React.FC<VisualizationProps> = ({
  gapFrames,
  contextFrames,
  replaceMode,
  keepBridgingImages,
  infoContent,
  clipPairs,
}) => {
  const keepBridgingImagesValue = keepBridgingImages ?? false;
  const {
    selectedPairIndex,
    setSelectedPairIndex,
    selectedPair,
    hasPairs,
  } = useClipPairSelection(clipPairs);

  const calculations = getClipFrameCalculations({
    gapFrames,
    contextFrames,
    replaceMode,
    selectedPair,
  });

  return (
    <div className="border rounded-lg p-4 bg-background/50 text-xs h-full flex flex-col">
      <h4 className="font-semibold flex items-center gap-2 mb-2">
        <Film className="w-3 h-3" />
        Transition Structure Preview
      </h4>

      {hasPairs && clipPairs && (
        <ClipPairSelector
          clipPairs={clipPairs}
          selectedPairIndex={selectedPairIndex}
          onPairSelect={setSelectedPairIndex}
        />
      )}

      {infoContent && (
        <div className="mb-4 bg-muted/50 rounded-lg px-3 py-2">{infoContent}</div>
      )}

      <ClipTimeline
        gapFrames={gapFrames}
        contextFrames={contextFrames}
        replaceMode={replaceMode}
        keepBridgingImages={keepBridgingImagesValue}
        calculations={calculations}
      />
    </div>
  );
};
