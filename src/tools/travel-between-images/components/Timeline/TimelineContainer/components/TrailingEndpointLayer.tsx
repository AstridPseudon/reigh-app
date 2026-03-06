import React, { useMemo } from 'react';
import { GenerationRow } from '@/domains/generation/types';
import { PairData } from '@/shared/types/pairData';
import { TrailingEndpoint } from '../../TrailingEndpoint';
import { sortPositionEntries } from '../../utils/timeline-utils';

interface TrailingEndpointLayerProps {
  imagePositions: Map<string, number>;
  images: GenerationRow[];
  trailingEndFrame: number | undefined;
  hasCallbackTrailingVideo: boolean;
  hasLiveTrailingVideo: boolean;
  isEndpointDragging: boolean;
  endpointDragFrame: number | null;
  containerWidth: number;
  fullMin: number;
  fullRange: number;
  maxAllowedGap: number;
  readOnly: boolean;
  onEndpointMouseDown: (e: React.MouseEvent, endpointId: string) => void;
  onPairClick?: (pairIndex: number, pairData: PairData) => void;
  trailingVideoUrl: string | null;
  onExtractFinalFrame?: () => Promise<void>;
}

export const TrailingEndpointLayer: React.FC<TrailingEndpointLayerProps> = ({
  imagePositions,
  images,
  trailingEndFrame,
  hasCallbackTrailingVideo,
  hasLiveTrailingVideo,
  isEndpointDragging,
  endpointDragFrame,
  containerWidth,
  fullMin,
  fullRange,
  maxAllowedGap,
  readOnly,
  onEndpointMouseDown,
  onPairClick,
  trailingVideoUrl,
  onExtractFinalFrame,
}) => {
  const sortedEntries = useMemo(() => sortPositionEntries(imagePositions), [imagePositions]);

  if (sortedEntries.length === 0) {
    return null;
  }

  const lastEntry = sortedEntries[sortedEntries.length - 1];
  if (!lastEntry) {
    return null;
  }

  const [id, imageFrame] = lastEntry;
  const isMultiImage = images.length > 1;
  const hasTrailingSegment = trailingEndFrame !== undefined;

  if (isMultiImage && !hasTrailingSegment && !hasCallbackTrailingVideo && !hasLiveTrailingVideo) {
    return null;
  }

  const defaultEndFrame = imageFrame + (isMultiImage ? 17 : 49);
  const effectiveEndFrame = trailingEndFrame ?? defaultEndFrame;
  const gapToImage = effectiveEndFrame - imageFrame;
  const lastImageIndex = sortedEntries.length - 1;
  const lastImage = images.find((img) => {
    const imgId = img.shot_generation_id || img.id;
    return imgId === id;
  }) || images[lastImageIndex];

  const trailingPairIndex = Math.max(0, sortedEntries.length - 1);

  return (
    <TrailingEndpoint
      framePosition={effectiveEndFrame}
      imageFramePosition={imageFrame}
      isDragging={isEndpointDragging}
      dragOffset={null}
      onMouseDown={readOnly ? undefined : (e, endpointId) => onEndpointMouseDown(e, endpointId)}
      timelineWidth={containerWidth}
      fullMinFrames={fullMin}
      fullRange={fullRange}
      currentDragFrame={isEndpointDragging ? endpointDragFrame : null}
      gapToImage={gapToImage}
      maxAllowedGap={maxAllowedGap}
      readOnly={readOnly}
      compact={isMultiImage}
      onDurationClick={onPairClick && lastImage ? () => {
        onPairClick(trailingPairIndex, {
          index: trailingPairIndex,
          frames: effectiveEndFrame - imageFrame,
          startFrame: imageFrame,
          endFrame: effectiveEndFrame,
          startImage: {
            id,
            generationId: lastImage.generation_id,
            url: lastImage.imageUrl || lastImage.thumbUrl,
            thumbUrl: lastImage.thumbUrl,
            position: sortedEntries.length,
          },
          endImage: null,
        });
      } : undefined}
      hasTrailingVideo={!!trailingVideoUrl}
      onExtractFinalFrame={trailingVideoUrl && onExtractFinalFrame ? onExtractFinalFrame : undefined}
    />
  );
};
