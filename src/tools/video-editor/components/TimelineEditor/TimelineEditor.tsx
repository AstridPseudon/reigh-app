import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import '@/tools/video-editor/components/TimelineEditor/timeline-overrides.css';
import { ClipAction } from '@/tools/video-editor/components/TimelineEditor/ClipAction';
import { DropIndicator } from '@/tools/video-editor/components/TimelineEditor/DropIndicator';
import { TimelineCanvas } from '@/tools/video-editor/components/TimelineEditor/TimelineCanvas';
import { TrackLabel } from '@/tools/video-editor/components/TimelineEditor/TrackLabel';
import { ROW_HEIGHT, TIMELINE_START_LEFT } from '@/tools/video-editor/lib/coordinate-utils';
import { useTimelineEditorContext } from '@/tools/video-editor/contexts/TimelineEditorContext';
import { useClipDrag } from '@/tools/video-editor/hooks/useClipDrag';
import { useMarqueeSelect } from '@/tools/video-editor/hooks/useMarqueeSelect';
import type { TimelineAction } from '@/tools/video-editor/types/timeline-canvas';

function TimelineEditorComponent() {
  const {
    data,
    resolvedConfig,
    timelineRef,
    timelineWrapperRef,
    dataRef,
    applyTimelineEdit,
    moveClipToRow,
    createTrackAndMoveClip,
    selectClip,
    selectClips,
    addToSelection,
    clearSelection,
    isClipSelected,
    primaryClipId,
    selectedClipIds,
    selectedClipIdsRef,
    setSelectedTrackId,
    scale,
    scaleWidth,
    coordinator,
    indicatorRef,
    editAreaRef,
    selectedTrackId,
    handleTrackPopoverChange,
    handleReorderTrack,
    handleRemoveTrack,
    handleSplitClipAtTime,
    handleSplitClipsAtPlayhead,
    handleDeleteClips,
    handleDeleteClip,
    handleToggleMuteClips,
    onCursorDrag,
    onClickTimeArea,
    onActionResizeStart,
    onActionResizeEnd,
    onTimelineDragOver,
    onTimelineDragLeave,
    onTimelineDrop,
    onDoubleClickAsset,
  } = useTimelineEditorContext();
  const trackListRef = useRef<HTMLDivElement>(null);

  // useClipDrag handles all internal clip drag interactions (horizontal moves,
  // cross-track moves, and new-track creation) using the same fixed-position
  // drop indicators as external HTML5 drag-drop.
  const { dragSessionRef } = useClipDrag({
    timelineWrapperRef,
    dataRef,
    moveClipToRow,
    createTrackAndMoveClip,
    applyTimelineEdit,
    selectClip,
    selectClips,
    selectedClipIdsRef,
    coordinator,
    rowHeight: ROW_HEIGHT,
    scale,
    scaleWidth,
    startLeft: TIMELINE_START_LEFT,
  });

  const { marqueeRect, onPointerDown: onMarqueePointerDown } = useMarqueeSelect({
    editAreaRef,
    dragSessionRef,
    selectClips,
    addToSelection,
    clearSelection,
  });

  useLayoutEffect(() => {
    const wrapper = timelineWrapperRef.current;
    const nextEditArea = wrapper?.querySelector<HTMLElement>('.timeline-canvas-edit-area') ?? null;
    editAreaRef.current = nextEditArea;

    return () => {
      if (editAreaRef.current === nextEditArea) {
        editAreaRef.current = null;
      }
    };
  }, [data, editAreaRef, timelineWrapperRef]);

  const scaleCount = useMemo(() => {
    if (!data) {
      return 1;
    }

    let maxEnd = 0;
    for (const row of data.rows) {
      for (const action of row.actions) {
        maxEnd = Math.max(maxEnd, action.end);
      }
    }

    return Math.ceil((maxEnd + 20) / scale) + 1;
  }, [data, scale]);

  const thumbnailMap = useMemo<Record<string, string>>(() => {
    if (!resolvedConfig) {
      return {};
    }

    return resolvedConfig.clips.reduce<Record<string, string>>((acc, clip) => {
      if (clip.clipType === 'text' || !clip.assetEntry?.type?.startsWith('image')) {
        return acc;
      }

      acc[clip.id] = clip.assetEntry.src;
      return acc;
    }, {});
  }, [resolvedConfig]);

  const handleClipSelect = useCallback((clipId: string, trackId: string) => {
    selectClip(clipId);
    setSelectedTrackId(trackId);
  }, [selectClip, setSelectedTrackId]);

  const pixelsPerSecond = scaleWidth / scale;

  const clientXToTime = useCallback((clientX: number): number => {
    const wrapper = timelineWrapperRef.current;
    if (!wrapper) return 0;
    const editArea = wrapper.querySelector<HTMLElement>('.timeline-canvas-edit-area');
    const grid = editArea;
    const rect = (editArea ?? wrapper).getBoundingClientRect();
    const scrollLeft = grid?.scrollLeft ?? 0;
    return Math.max(0, (clientX - rect.left + scrollLeft - TIMELINE_START_LEFT) / pixelsPerSecond);
  }, [pixelsPerSecond, timelineWrapperRef]);

  const handleSplitClipHere = useCallback((clipId: string, clientX: number) => {
    const time = clientXToTime(clientX);
    handleSplitClipAtTime(clipId, time);
  }, [clientXToTime, handleSplitClipAtTime]);

  const getActionRender = useCallback((action: TimelineAction) => {
    const clipMeta = data?.meta[action.id];
    if (!clipMeta) {
      return null;
    }

    const clipWidthPx = (action.end - action.start) * pixelsPerSecond;
    const thumbnailSrc = clipWidthPx >= 40 ? thumbnailMap[action.id] : undefined;

    return (
      <ClipAction
        action={action}
        clipMeta={clipMeta}
        isSelected={isClipSelected(action.id)}
        isPrimary={primaryClipId === action.id}
        selectedClipIds={[...selectedClipIds]}
        thumbnailSrc={thumbnailSrc}
        onSelect={handleClipSelect}
        onDoubleClickAsset={onDoubleClickAsset}
        onSplitHere={handleSplitClipHere}
        onSplitClipsAtPlayhead={handleSplitClipsAtPlayhead}
        onDeleteClips={handleDeleteClips}
        onDeleteClip={handleDeleteClip}
        onToggleMuteClips={handleToggleMuteClips}
      />
    );
  }, [
    data,
    handleClipSelect,
    handleDeleteClip,
    handleDeleteClips,
    handleSplitClipHere,
    handleSplitClipsAtPlayhead,
    handleToggleMuteClips,
    isClipSelected,
    onDoubleClickAsset,
    pixelsPerSecond,
    primaryClipId,
    selectedClipIds,
    thumbnailMap,
  ]);

  const kindCountMap = useMemo(() => {
    if (!data) {
      return {} as Record<string, number>;
    }

    return data.tracks.reduce<Record<string, number>>((counts, track) => {
      counts[track.kind] = (counts[track.kind] ?? 0) + 1;
      return counts;
    }, {});
  }, [data]);

  if (!data) {
    return null;
  }

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-border bg-card/80">
      <div
        ref={trackListRef}
        className="flex w-36 shrink-0 flex-col overflow-y-auto border-r border-border pt-[30px]"
        onScroll={(event) => {
          timelineRef.current?.setScrollTop(event.currentTarget.scrollTop);
        }}
      >
        {data.tracks.map((track, index) => {
          const row = data.rows[index];
          return (
            <TrackLabel
              key={track.id}
              track={track}
              isSelected={selectedTrackId === track.id}
              trackCount={data.tracks.length}
              trackIndex={index}
              sameKindCount={kindCountMap[track.kind] ?? 0}
              hasClips={Boolean(row && row.actions.length > 0)}
              onSelect={setSelectedTrackId}
              onChange={handleTrackPopoverChange}
              onReorder={handleReorderTrack}
              onRemove={handleRemoveTrack}
            />
          );
        })}
      </div>
      <div
        ref={timelineWrapperRef}
        className="timeline-wrapper relative min-w-0 flex-1 overflow-hidden"
        onDragOver={onTimelineDragOver}
        onDragLeave={onTimelineDragLeave}
        onDrop={onTimelineDrop}
      >
        <TimelineCanvas
          ref={timelineRef}
          rows={data.rows}
          scale={scale}
          scaleWidth={scaleWidth}
          scaleSplitCount={5}
          startLeft={TIMELINE_START_LEFT}
          rowHeight={ROW_HEIGHT}
          minScaleCount={scaleCount}
          maxScaleCount={scaleCount}
          getActionRender={getActionRender}
          onCursorDrag={onCursorDrag}
          onClickTimeArea={onClickTimeArea}
          onActionResizeStart={onActionResizeStart}
          onActionResizeEnd={onActionResizeEnd}
          marqueeRect={marqueeRect}
          onEditAreaPointerDown={onMarqueePointerDown}
          trackLabelRef={trackListRef}
        />
        <DropIndicator ref={indicatorRef} editAreaRef={editAreaRef} />
      </div>
    </div>
  );
}

export const TimelineEditor = memo(TimelineEditorComponent);
