/**
 * SegmentOutputStrip - Compact strip showing segment outputs above timeline
 *
 * Displays generated video segments aligned with their corresponding image pairs.
 * Each segment is positioned to match the timeline pair below it.
 *
 * Logic extracted to useSegmentOutputStrip hook — this file is rendering-only.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import MediaLightbox from '@/shared/components/MediaLightbox';
import { InlineSegmentVideo } from './InlineSegmentVideo';
import { TIMELINE_HORIZONTAL_PADDING, TIMELINE_PADDING_OFFSET } from './constants';
import { getDisplayUrl } from '@/shared/lib/utils';
import { cn } from '@/shared/lib/utils';

import type { PairData } from './TimelineContainer';
import type { SegmentSlot } from '@/shared/hooks/segments';
import { useSegmentOutputStrip } from './hooks/useSegmentOutputStrip';

interface PairInfo {
  index: number;
  startFrame: number;
  endFrame: number;
  frames: number;
}

interface SegmentOutputStripProps {
  shotId: string;
  projectId?: string | null;
  projectAspectRatio?: string;
  pairInfo: PairInfo[];
  fullMin: number;
  fullMax: number;
  fullRange: number;
  containerWidth: number;
  zoomLevel: number;
  segmentSlots: SegmentSlot[];
  isLoading?: boolean;
  localShotGenPositions?: Map<string, number>;
  hasPendingTask?: (pairShotGenerationId: string | null | undefined) => boolean;
  onOpenPairSettings?: (pairIndex: number, pairFrameData?: { frames: number; startFrame: number; endFrame: number }) => void;
  selectedParentId?: string | null;
  pairDataByIndex?: Map<number, PairData>;
  onSegmentFrameCountChange?: (pairShotGenerationId: string, frameCount: number) => void;
  lastImageId?: string;
  trailingSegmentMode?: {
    imageId: string;
    imageFrame: number;
    endFrame: number;
  };
  readOnly?: boolean;
  onAddTrailingSegment?: () => void;
  onRemoveTrailingSegment?: () => void;
  isMultiImage?: boolean;
  lastImageFrame?: number;
  onTrailingVideoInfo?: (videoUrl: string | null) => void;
}

export const SegmentOutputStrip: React.FC<SegmentOutputStripProps> = ({
  shotId,
  projectAspectRatio,
  pairInfo,
  fullMin,
  fullRange,
  containerWidth,
  zoomLevel,
  segmentSlots: rawSegmentSlots,
  isLoading = false,
  hasPendingTask: hasPendingTaskProp,
  onOpenPairSettings,
  selectedParentId,
  pairDataByIndex,
  onSegmentFrameCountChange,
  lastImageId,
  trailingSegmentMode,
  readOnly = false,
  onAddTrailingSegment,
  onRemoveTrailingSegment,
  isMultiImage = false,
  lastImageFrame,
  onTrailingVideoInfo,
}) => {
  const {
    // Refs
    previewVideoRef,
    stripContainerRef,
    // Mobile
    isMobile,
    // Display data
    displaySlots,
    segmentPositions,
    hasPendingTask,
    hasRecentMismatch,
    // Scrubbing
    activeScrubbingIndex,
    activeSegmentSlot,
    activeSegmentVideoUrl,
    scrubbing,
    previewPosition,
    previewDimensions,
    clampedPreviewX,
    handleScrubbingStart,
    // Lightbox
    lightboxMedia,
    lightboxCurrentSegmentImages,
    lightboxCurrentFrameCount,
    currentLightboxMedia,
    childSlotIndices,
    handleSegmentClick,
    handleLightboxNext,
    handleLightboxPrev,
    handleLightboxClose,
    // Deletion
    deletingSegmentId,
    handleDeleteSegment,
  } = useSegmentOutputStrip({
    shotId,
    projectAspectRatio,
    pairInfo,
    fullMin,
    fullRange,
    containerWidth,
    rawSegmentSlots,
    hasPendingTaskProp,
    pairDataByIndex,
    lastImageId,
    trailingSegmentMode,
    readOnly,
    onTrailingVideoInfo,
    selectedParentId,
    onSegmentFrameCountChange,
  });

  // Don't render if no pairs AND not in single-image mode
  if (pairInfo.length === 0 && !trailingSegmentMode) {
    return null;
  }

  return (
    <div className="w-full relative" ref={stripContainerRef}>
      {/* Scrubbing Preview Area - rendered via portal to escape container */}
      {activeScrubbingIndex !== null && activeSegmentVideoUrl && createPortal(
        <div
          className="fixed pointer-events-none"
          style={{
            left: `${clampedPreviewX}px`,
            top: `${previewPosition.y - previewDimensions.height - 16}px`,
            transform: 'translateX(-50%)',
            zIndex: 999999,
          }}
        >
          <div
            className="relative bg-black rounded-lg overflow-hidden shadow-xl border-2 border-primary/50"
            style={{
              width: previewDimensions.width,
              height: previewDimensions.height,
            }}
          >
            <video
              ref={previewVideoRef}
              src={getDisplayUrl(activeSegmentVideoUrl)}
              className="w-full h-full object-contain"
              muted
              playsInline
              preload="auto"
              loop
              {...scrubbing.videoProps}
            />

            {/* Scrubber progress bar */}
            {scrubbing.scrubberPosition !== null && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                <div
                  className={cn(
                    "h-full bg-primary transition-opacity duration-200",
                    scrubbing.scrubberVisible ? "opacity-100" : "opacity-50"
                  )}
                  style={{ width: `${scrubbing.scrubberPosition}%` }}
                />
              </div>
            )}

            {/* Segment label */}
            <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              Segment {(activeSegmentSlot?.index ?? 0) + 1}
              {scrubbing.duration > 0 && (
                <span className="ml-2 text-white/70">
                  {scrubbing.currentTime.toFixed(1)}s / {scrubbing.duration.toFixed(1)}s
                </span>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Segment output strip - compact height for segment thumbnails */}
      <div
        className="relative h-32 mt-3 mb-1"
        style={{
          width: zoomLevel > 1 ? `${zoomLevel * 100}%` : '100%',
          minWidth: '100%',
          paddingLeft: `${TIMELINE_HORIZONTAL_PADDING}px`,
          paddingRight: `${TIMELINE_HORIZONTAL_PADDING}px`,
          overflow: 'visible',
        }}
      >
        {/* Segment thumbnails - positioned to align with timeline pairs */}
        <div className="absolute left-0 right-0 top-5 bottom-1 overflow-visible">
          {displaySlots.length > 0 && segmentPositions.length > 0 ? (() => {
            const hasAnySegments = displaySlots.some(s => s.type === 'child');
            return (
            <div className="relative w-full h-full">
              {displaySlots.map((slot, index) => {
                const position = segmentPositions.find(p => p.pairIndex === slot.index);

                if (!position) {
                  return null;
                }

                const isTrailingSlot = 'isTrailingSegment' in slot && slot.isTrailingSegment === true;
                if (slot.type === 'placeholder' && hasAnySegments && !isTrailingSlot) {
                  return null;
                }

                const isActiveScrubbing = activeScrubbingIndex === index;

                // Check if source images have recent changes (for warning indicator)
                const segmentId = slot.type === 'child' ? slot.child.id : null;
                const hasSourceChanged = segmentId ? hasRecentMismatch(segmentId) : false;

                return (
                  <React.Fragment key={slot.type === 'child' ? slot.child.id : `placeholder-${index}`}>
                    <InlineSegmentVideo
                      slot={slot}
                      pairIndex={slot.index}
                      onClick={() => {
                        handleSegmentClick(slot, index, onOpenPairSettings);
                      }}
                      projectAspectRatio={projectAspectRatio}
                      isMobile={isMobile}
                      leftPercent={position.leftPercent}
                      widthPercent={position.widthPercent}
                      onOpenPairSettings={onOpenPairSettings ? (pairIdx: number) => {
                        const pairFrameData = pairInfo.find(p => p.index === pairIdx);
                        onOpenPairSettings(pairIdx, pairFrameData ? {
                          frames: pairFrameData.frames,
                          startFrame: pairFrameData.startFrame,
                          endFrame: pairFrameData.endFrame,
                        } : undefined);
                      } : undefined}
                      onDelete={handleDeleteSegment}
                      isDeleting={slot.type === 'child' && slot.child.id === deletingSegmentId}
                      isPending={hasPendingTask(slot.pairShotGenerationId)}
                      hasSourceChanged={hasSourceChanged}
                      // Scrubbing props
                      isScrubbingActive={isActiveScrubbing}
                      onScrubbingStart={(rect: DOMRect) => handleScrubbingStart(index, rect)}
                      scrubbingContainerRef={isActiveScrubbing ? scrubbing.containerRef : undefined}
                      scrubbingContainerProps={isActiveScrubbing ? scrubbing.containerProps : undefined}
                      scrubbingProgress={isActiveScrubbing ? scrubbing.progress : undefined}
                      readOnly={readOnly}
                    />
                    {/* X button to remove trailing segment */}
                    {isTrailingSlot && onRemoveTrailingSegment && !readOnly &&
                      slot.type !== 'child' && !hasPendingTask(slot.pairShotGenerationId) && (
                      <button
                        className="absolute z-20 w-5 h-5 rounded-full bg-muted/90 hover:bg-destructive border border-border/50 hover:border-destructive flex items-center justify-center text-muted-foreground hover:text-destructive-foreground transition-all duration-150"
                        style={{
                          left: `calc(${position.leftPercent + position.widthPercent}% - 8px)`,
                          top: '-4px',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveTrailingSegment();
                        }}
                        title="Remove trailing segment"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Add trailing segment button */}
              {isMultiImage && onAddTrailingSegment && !readOnly && lastImageFrame !== undefined && fullRange > 0 && containerWidth > 0 && (() => {
                const trailingIndex = pairInfo.length;
                const trailingSlot = displaySlots.find(slot => slot.index === trailingIndex);
                if (trailingSlot) return null;

                const effectiveWidth = containerWidth - (TIMELINE_PADDING_OFFSET * 2);
                const lastImagePixel = TIMELINE_PADDING_OFFSET + ((lastImageFrame - fullMin) / fullRange) * effectiveWidth;
                const buttonLeftPercent = (lastImagePixel / containerWidth) * 100;

                return (
                  <button
                    className="absolute top-0 bottom-0 w-7 rounded-md bg-muted/30 border-2 border-dashed border-border/40 hover:bg-muted/50 hover:border-primary/40 flex items-center justify-center cursor-pointer transition-all duration-150 group"
                    style={{ left: `calc(${buttonLeftPercent}% + 2px)` }}
                    onClick={onAddTrailingSegment}
                    title="Add trailing video segment"
                  >
                    <span className="text-xl font-light leading-none text-muted-foreground group-hover:text-foreground transition-colors">+</span>
                  </button>
                );
              })()}
            </div>
            );
          })() : (
            <div className="flex-1 h-full flex items-center justify-center text-xs text-muted-foreground">
              {isLoading ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading segments...</span>
                </div>
              ) : (
                <span>No segments generated yet</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox for segment videos */}
      {lightboxMedia && (
        <MediaLightbox
          media={lightboxMedia}
          onClose={handleLightboxClose}
          onNext={handleLightboxNext}
          onPrevious={handleLightboxPrev}
          showNavigation={true}
          showImageEditTools={false}
          showDownload={true}
          hasNext={childSlotIndices.length > 1}
          hasPrevious={childSlotIndices.length > 1}
          starred={currentLightboxMedia?.starred ?? false}
          shotId={shotId}
          showTaskDetails={true}
          showVideoTrimEditor={true}
          fetchVariantsForSelf={true}
          currentSegmentImages={lightboxCurrentSegmentImages}
          onSegmentFrameCountChange={onSegmentFrameCountChange}
          currentFrameCount={lightboxCurrentFrameCount}
        />
      )}

    </div>
  );
};
