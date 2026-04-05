import { memo, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Shot } from '@/domains/generation/types';
import { useShotCreation } from '@/shared/hooks/shotCreation/useShotCreation';
import { useShots } from '@/shared/contexts/ShotsContext';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { VideoGenerationModal } from '@/tools/travel-between-images/components/VideoGenerationModal';
import '@/tools/video-editor/components/TimelineEditor/timeline-overrides.css';
import { ClipAction } from '@/tools/video-editor/components/TimelineEditor/ClipAction';
import { DropIndicator } from '@/tools/video-editor/components/TimelineEditor/DropIndicator';
import { TimelineCanvas } from '@/tools/video-editor/components/TimelineEditor/TimelineCanvas';
import { ROW_HEIGHT, TIMELINE_START_LEFT } from '@/tools/video-editor/lib/coordinate-utils';
import { useTimelineChromeContext } from '@/tools/video-editor/contexts/TimelineChromeContext';
import { useTimelineEditorContext } from '@/tools/video-editor/contexts/TimelineEditorContext';
import { useClipDrag } from '@/tools/video-editor/hooks/useClipDrag';
import { useMarqueeSelect } from '@/tools/video-editor/hooks/useMarqueeSelect';
import { useStaleVariants } from '@/tools/video-editor/hooks/useStaleVariants';
import type { AssetRegistry } from '@/tools/video-editor/types';
import type { TimelineAction, TimelineRow } from '@/tools/video-editor/types/timeline-canvas';

export function resolveSelectedGenerationIdsForShotCreation({
  rows,
  meta,
  registry,
  selectedClipIds,
}: {
  rows: TimelineRow[];
  meta: Record<string, ClipMeta>;
  registry: AssetRegistry;
  selectedClipIds: Iterable<string>;
}) {
  const selectedSet = new Set(selectedClipIds);
  if (selectedSet.size === 0) {
    return { canCreateShot: false, generationIds: [] as string[] };
  }

  const orderedSelections = rows
    .flatMap((row, trackIndex) => row.actions
      .filter((action) => selectedSet.has(action.id))
      .map((action) => {
        const assetKey = meta[action.id]?.asset;
        const assetEntry = assetKey ? registry.assets[assetKey] : undefined;

        return {
          trackIndex,
          start: action.start,
          generationId: assetEntry?.generationId,
        };
      }))
    .sort((left, right) => left.trackIndex - right.trackIndex || left.start - right.start);

  const generationIds = orderedSelections
    .map((selection) => selection.generationId)
    .filter((generationId): generationId is string => typeof generationId === 'string' && generationId.length > 0);

  return {
    canCreateShot: orderedSelections.length > 0 && generationIds.length === orderedSelections.length,
    generationIds,
  };
}

function TimelineEditorComponent() {
  const chrome = useTimelineChromeContext();
  const [newTrackDropLabel, setNewTrackDropLabel] = useState<string | null>(null);
  const [videoModalShot, setVideoModalShot] = useState<Shot | null>(null);
  const { createShot, isCreating } = useShotCreation();
  const { shots } = useShots();
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
    handleMoveTrack,
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
    patchRegistry,
    registerAsset,
  } = useTimelineEditorContext();
  const trackSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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

  const { staleAssetKeys, dismissedAssetKeys, generationAssetKeys, dismissAsset, updateAssetToCurrentVariant } = useStaleVariants({
    registry: resolvedConfig?.registry,
    patchRegistry,
    registerAsset,
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

  const selectionShotCreationState = useMemo(() => {
    if (!data) {
      return { canCreateShot: false, generationIds: [] as string[] };
    }

    return resolveSelectedGenerationIdsForShotCreation({
      rows: data.rows,
      meta: data.meta,
      registry: data.registry,
      selectedClipIds,
    });
  }, [data, selectedClipIds]);

  const handleCreateShotFromSelection = useCallback(async () => {
    if (!selectionShotCreationState.canCreateShot) {
      return;
    }

    await createShot({ generationIds: selectionShotCreationState.generationIds });
  }, [createShot, selectionShotCreationState]);

  const handleGenerateVideoFromSelection = useCallback(async () => {
    if (!selectionShotCreationState.canCreateShot) {
      return;
    }

    const result = await createShot({ generationIds: selectionShotCreationState.generationIds });
    const createdShot = result?.shot ?? shots?.find((shot) => shot.id === result?.shotId) ?? null;
    if (createdShot) {
      setVideoModalShot(createdShot);
    }
  }, [createShot, selectionShotCreationState, shots]);

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
    const assetKey = clipMeta.asset;
    const isStale = assetKey ? staleAssetKeys.has(assetKey) : false;
    const isDismissed = assetKey ? dismissedAssetKeys.has(assetKey) : false;
    const isGenAsset = assetKey ? generationAssetKeys.has(assetKey) : false;

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
        isVariantStale={isStale && !isDismissed}
        isGenerationAsset={isGenAsset}
        onUpdateVariant={isGenAsset && assetKey ? () => void updateAssetToCurrentVariant(assetKey) : undefined}
        onDismissStale={isStale && assetKey ? () => dismissAsset(assetKey) : undefined}
        canCreateShotFromSelection={selectionShotCreationState.canCreateShot}
        onCreateShotFromSelection={handleCreateShotFromSelection}
        onGenerateVideoFromSelection={handleGenerateVideoFromSelection}
        isCreatingShot={isCreating}
      />
    );
  }, [
    selectionShotCreationState.canCreateShot,
    data,
    dismissAsset,
    dismissedAssetKeys,
    generationAssetKeys,
    handleCreateShotFromSelection,
    handleClipSelect,
    handleDeleteClip,
    handleDeleteClips,
    handleGenerateVideoFromSelection,
    handleSplitClipHere,
    handleSplitClipsAtPlayhead,
    handleToggleMuteClips,
    isCreating,
    isClipSelected,
    onDoubleClickAsset,
    pixelsPerSecond,
    primaryClipId,
    selectedClipIds,
    staleAssetKeys,
    thumbnailMap,
    updateAssetToCurrentVariant,
  ]);

  const handleTrackDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (!over) {
      return;
    }

    const activeSortableId = String(active.id);
    const overSortableId = String(over.id);
    if (
      activeSortableId === overSortableId ||
      !activeSortableId.startsWith('track-') ||
      !overSortableId.startsWith('track-')
    ) {
      return;
    }

    const activeTrackId = activeSortableId.slice('track-'.length);
    const overTrackId = overSortableId.slice('track-'.length);
    handleMoveTrack(activeTrackId, overTrackId);
  }, [handleMoveTrack]);

  if (!data) {
    return null;
  }

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-border bg-card/80">
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
          tracks={data.tracks}
          scale={scale}
          scaleWidth={scaleWidth}
          scaleSplitCount={5}
          startLeft={TIMELINE_START_LEFT}
          rowHeight={ROW_HEIGHT}
          minScaleCount={scaleCount}
          maxScaleCount={scaleCount}
          selectedTrackId={selectedTrackId}
          getActionRender={getActionRender}
          onSelectTrack={setSelectedTrackId}
          onTrackChange={handleTrackPopoverChange}
          onRemoveTrack={handleRemoveTrack}
          onTrackDragEnd={handleTrackDragEnd}
          trackSensors={trackSensors}
          onCursorDrag={onCursorDrag}
          onClickTimeArea={onClickTimeArea}
          onActionResizeStart={onActionResizeStart}
          onActionResizeEnd={onActionResizeEnd}
          marqueeRect={marqueeRect}
          onEditAreaPointerDown={onMarqueePointerDown}
          onAddTrack={chrome.handleAddTrack}
          onAddTextAt={chrome.handleAddTextAt}
          unusedTrackCount={chrome.unusedTrackCount}
          onClearUnusedTracks={chrome.handleClearUnusedTracks}
          newTrackDropLabel={newTrackDropLabel}
        />
        <DropIndicator ref={indicatorRef} editAreaRef={editAreaRef} onNewTrackLabel={setNewTrackDropLabel} />
      </div>

      {videoModalShot && (
        <>
          {/* VideoGenerationModal only uses app-wide providers, so it can open from timeline selection flow. */}
          <VideoGenerationModal
            isOpen={true}
            onClose={() => setVideoModalShot(null)}
            shot={videoModalShot}
          />
        </>
      )}
    </div>
  );
}

export const TimelineEditor = memo(TimelineEditorComponent);
