import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useGallerySelection } from '@/shared/contexts/GallerySelectionContext';
import { useProjectSelectionContext } from '@/shared/contexts/ProjectContext';
import { useVideoEditorRuntime } from '@/tools/video-editor/contexts/DataProviderContext';
import { ROW_HEIGHT, TIMELINE_START_LEFT } from '@/tools/video-editor/lib/coordinate-utils';
import { useAssetManagement } from '@/tools/video-editor/hooks/useAssetManagement';
import { useAssetOperations } from '@/tools/video-editor/hooks/useAssetOperations';
import { useClipEditing } from '@/tools/video-editor/hooks/useClipEditing';
import { useClipResize } from '@/tools/video-editor/hooks/useClipResize';
import { useDerivedTimeline } from '@/tools/video-editor/hooks/useDerivedTimeline';
import { useDragCoordinator } from '@/tools/video-editor/hooks/useDragCoordinator';
import { useEditorPreferences } from '@/tools/video-editor/hooks/useEditorPreferences';
import { useExternalDrop } from '@/tools/video-editor/hooks/useExternalDrop';
import { useTimelinePlayback } from '@/tools/video-editor/hooks/useTimelinePlayback';
import { useRenderState } from '@/tools/video-editor/hooks/useRenderState';
import { useTimelineHistory } from '@/tools/video-editor/hooks/useTimelineHistory';
import { useTimelineQueries } from '@/tools/video-editor/hooks/useTimelineQueries';
import { useTimelineSave } from '@/tools/video-editor/hooks/useTimelineSave';
import { useTimelineSelection } from '@/tools/video-editor/hooks/useTimelineSelection';
import type {
  TimelineChromeContextValue,
  TimelineEditorContextValue,
  TimelinePlaybackContextValue,
  UseTimelineStateResult,
} from '@/tools/video-editor/hooks/useTimelineState.types';
import { useTimelineTrackManagement } from '@/tools/video-editor/hooks/useTimelineTrackManagement';

export type { SaveStatus, RenderStatus, EditorPreferences } from '@/tools/video-editor/hooks/useTimelineData.types';

export function useTimelineState(): UseTimelineStateResult {
  const runtime = useVideoEditorRuntime();
  const queryClient = useQueryClient();
  const playback = useTimelinePlayback();
  const preferences = useEditorPreferences(runtime.timelineId);
  const queries = useTimelineQueries(runtime.provider, runtime.timelineId);
  const save = useTimelineSave(queries, runtime.provider);
  const history = useTimelineHistory({
    dataRef: save.dataRef,
    commitData: save.commitData,
  });
  const derived = useDerivedTimeline(save.data, save.selectedClipId, save.selectedTrackId);
  const render = useRenderState(derived.resolvedConfig, derived.renderMetadata);
  const assetOperations = useAssetOperations(
    runtime.provider,
    runtime.timelineId,
    runtime.userId,
    queryClient,
    save.pendingOpsRef,
  );
  const {
    data,
    dataRef,
    eventBus,
    isConflictExhausted,
    selectedClipId,
    selectedTrackId,
    saveStatus,
    setSelectedClipId,
    setSelectedTrackId,
    applyEdit,
    patchRegistry,
    reloadFromServer,
    retrySaveAfterConflict,
    pendingOpsRef,
    isLoading,
  } = save;
  const {
    resolvedConfig,
    compositionSize,
    trackScaleMap,
  } = derived;
  const {
    renderStatus,
    renderLog,
    renderDirty,
    renderProgress,
    renderResultUrl,
    renderResultFilename,
    setRenderDirty,
    startRender,
  } = render;
  const {
    canUndo,
    canRedo,
    checkpoints,
    undo,
    redo,
    jumpToCheckpoint,
    createManualCheckpoint,
    onBeforeCommit,
  } = history;
  const {
    scale,
    scaleWidth,
    preferences: editorPreferences,
    setScaleWidth,
    setActiveClipTab,
    setAssetPanelState,
  } = preferences;
  const {
    registerAsset,
    uploadAsset,
    uploadFiles,
    invalidateAssetRegistry,
  } = assetOperations;
  const { selectedProjectId } = useProjectSelectionContext();
  const { clearGallerySelection, registerPeerClear } = useGallerySelection();
  const selection = useTimelineSelection({
    data,
    selectedClipId,
    selectedTrackId,
    setSelectedClipId,
    clearGallerySelection,
    registerPeerClear,
  });

  useEffect(() => {
    return eventBus.on('beforeCommit', onBeforeCommit);
  }, [eventBus, onBeforeCommit]);

  useEffect(() => {
    return eventBus.on('pruneSelection', selection.pruneSelection);
  }, [eventBus, selection.pruneSelection]);

  useEffect(() => {
    return eventBus.on('saveSuccess', () => {
      setRenderDirty(true);
    });
  }, [eventBus, setRenderDirty]);

  const dragCoordinator = useDragCoordinator({
    dataRef,
    scale,
    scaleWidth,
    startLeft: TIMELINE_START_LEFT,
    rowHeight: ROW_HEIGHT,
  });

  const assetManagement = useAssetManagement({
    dataRef,
    selectedTrackId,
    selectedProjectId,
    setSelectedClipId: selection.setSelectedClipId,
    setSelectedTrackId,
    applyEdit,
    patchRegistry,
    registerAsset,
    uploadAsset,
    invalidateAssetRegistry,
    resolveAssetUrl: runtime.provider.resolveAssetUrl.bind(runtime.provider),
  });

  const clipResize = useClipResize({
    dataRef,
    applyEdit,
  });

  const clipEditing = useClipEditing({
    dataRef,
    resolvedConfig: selection.resolvedConfig,
    selectedClipId: selection.primaryClipId,
    selectedTrack: selection.selectedTrack,
    currentTime: playback.currentTime,
    setSelectedClipId: selection.setSelectedClipId,
    setSelectedTrackId,
    applyEdit,
  });

  const externalDrop = useExternalDrop({
    dataRef,
    pendingOpsRef,
    scale,
    scaleWidth,
    selectedTrackId,
    applyEdit,
    patchRegistry,
    registerAsset,
    uploadAsset,
    invalidateAssetRegistry,
    resolveAssetUrl: runtime.provider.resolveAssetUrl.bind(runtime.provider),
    coordinator: dragCoordinator.coordinator,
    registerGenerationAsset: assetManagement.registerGenerationAsset,
    uploadImageGeneration: assetManagement.uploadImageGeneration,
    handleAssetDrop: assetManagement.handleAssetDrop,
    handleAddTextAt: clipEditing.handleAddTextAt,
  });

  const trackManagement = useTimelineTrackManagement({
    dataRef,
    resolvedConfig: selection.resolvedConfig,
    selectedClipId: selection.primaryClipId,
    setSelectedTrackId,
    applyEdit,
  });

  const editor = useMemo<TimelineEditorContextValue>(() => ({
    data,
    resolvedConfig: selection.resolvedConfig,
    selectedClipId: selection.primaryClipId,
    selectedClipIds: selection.selectedClipIds,
    selectedClipIdsRef: selection.selectedClipIdsRef,
    selectedTrackId,
    primaryClipId: selection.primaryClipId,
    selectedClip: selection.selectedClip,
    selectedTrack: selection.selectedTrack,
    selectedClipHasPredecessor: selection.selectedClipHasPredecessor,
    compositionSize,
    trackScaleMap,
    scale,
    scaleWidth,
    isLoading,
    dataRef,
    pendingOpsRef,
    coordinator: dragCoordinator.coordinator,
    indicatorRef: dragCoordinator.indicatorRef,
    editAreaRef: dragCoordinator.editAreaRef,
    preferences: editorPreferences,
    timelineRef: playback.timelineRef,
    timelineWrapperRef: playback.timelineWrapperRef,
    setSelectedClipId: selection.setSelectedClipId,
    isClipSelected: selection.isClipSelected,
    selectClip: selection.selectClip,
    selectClips: selection.selectClips,
    addToSelection: selection.addToSelection,
    clearSelection: selection.clearSelection,
    setSelectedTrackId,
    setActiveClipTab,
    setAssetPanelState,
    registerGenerationAsset: assetManagement.registerGenerationAsset,
    onCursorDrag: playback.onCursorDrag,
    onClickTimeArea: playback.onClickTimeArea,
    onActionResizeStart: clipResize.onActionResizeStart,
    onActionResizeEnd: clipResize.onActionResizeEnd,
    onOverlayChange: clipEditing.onOverlayChange,
    onTimelineDragOver: externalDrop.onTimelineDragOver,
    onTimelineDragLeave: externalDrop.onTimelineDragLeave,
    onTimelineDrop: externalDrop.onTimelineDrop,
    handleAssetDrop: assetManagement.handleAssetDrop,
    handleUpdateClips: clipEditing.handleUpdateClips,
    handleUpdateClipsDeep: clipEditing.handleUpdateClipsDeep,
    handleDeleteClips: clipEditing.handleDeleteClips,
    handleDeleteClip: clipEditing.handleDeleteClip,
    handleSelectedClipChange: clipEditing.handleSelectedClipChange,
    handleResetClipPosition: clipEditing.handleResetClipPosition,
    handleResetClipsPosition: clipEditing.handleResetClipsPosition,
    handleSplitSelectedClip: clipEditing.handleSplitSelectedClip,
    handleSplitClipAtTime: clipEditing.handleSplitClipAtTime,
    handleSplitClipsAtPlayhead: clipEditing.handleSplitClipsAtPlayhead,
    handleToggleMuteClips: clipEditing.handleToggleMuteClips,
    handleToggleMute: clipEditing.handleToggleMute,
    handleTrackPopoverChange: trackManagement.handleTrackPopoverChange,
    handleMoveTrack: trackManagement.handleMoveTrack,
    handleRemoveTrack: trackManagement.handleRemoveTrack,
    moveSelectedClipToTrack: trackManagement.moveSelectedClipToTrack,
    moveSelectedClipsToTrack: trackManagement.moveSelectedClipsToTrack,
    moveClipToRow: trackManagement.moveClipToRow,
    createTrackAndMoveClip: trackManagement.createTrackAndMoveClip,
    uploadFiles,
    applyEdit,
    patchRegistry,
    registerAsset,
  }), [
    compositionSize,
    data,
    dataRef,
    isLoading,
    pendingOpsRef,
    editorPreferences,
    scale,
    scaleWidth,
    selectedTrackId,
    setActiveClipTab,
    setAssetPanelState,
    setSelectedTrackId,
    trackScaleMap,
    uploadFiles,
    applyEdit,
    patchRegistry,
    registerAsset,
    selection.addToSelection,
    assetManagement.handleAssetDrop,
    assetManagement.registerGenerationAsset,
    selection.clearSelection,
    clipEditing.handleDeleteClip,
    clipEditing.handleDeleteClips,
    clipEditing.handleResetClipPosition,
    clipEditing.handleResetClipsPosition,
    clipEditing.handleSelectedClipChange,
    clipEditing.handleSplitSelectedClip,
    clipEditing.handleSplitClipAtTime,
    clipEditing.handleSplitClipsAtPlayhead,
    clipEditing.handleToggleMuteClips,
    clipEditing.handleToggleMute,
    clipEditing.handleUpdateClips,
    clipEditing.handleUpdateClipsDeep,
    clipEditing.onOverlayChange,
    clipResize.onActionResizeEnd,
    clipResize.onActionResizeStart,
    dragCoordinator.coordinator,
    dragCoordinator.editAreaRef,
    dragCoordinator.indicatorRef,
    externalDrop.onTimelineDragLeave,
    externalDrop.onTimelineDragOver,
    externalDrop.onTimelineDrop,
    selection.isClipSelected,
    playback.onClickTimeArea,
    playback.onCursorDrag,
    playback.timelineRef,
    playback.timelineWrapperRef,
    selection.primaryClipId,
    selection.selectClip,
    selection.selectClips,
    selection.selectedClipIds,
    selection.selectedClipIdsRef,
    selection.resolvedConfig,
    selection.selectedClip,
    selection.selectedClipHasPredecessor,
    selection.selectedTrack,
    selection.setSelectedClipId,
    trackManagement.createTrackAndMoveClip,
    trackManagement.handleMoveTrack,
    trackManagement.handleRemoveTrack,
    trackManagement.handleTrackPopoverChange,
    trackManagement.moveClipToRow,
    trackManagement.moveSelectedClipToTrack,
    trackManagement.moveSelectedClipsToTrack,
  ]);

  const chrome = useMemo<TimelineChromeContextValue>(() => ({
    timelineName: runtime.timelineName ?? null,
    saveStatus,
    isConflictExhausted,
    renderStatus,
    renderLog,
    renderDirty,
    renderProgress,
    renderResultUrl,
    renderResultFilename,
    undo,
    redo,
    canUndo,
    canRedo,
    checkpoints,
    jumpToCheckpoint,
    createManualCheckpoint,
    setScaleWidth,
    handleAddTrack: trackManagement.handleAddTrack,
    handleClearUnusedTracks: trackManagement.handleClearUnusedTracks,
    unusedTrackCount: trackManagement.unusedTrackCount,
    handleAddText: clipEditing.handleAddText,
    handleAddTextAt: clipEditing.handleAddTextAt,
    reloadFromServer,
    retrySaveAfterConflict,
    startRender,
  }), [
    runtime.timelineName,
    isConflictExhausted,
    reloadFromServer,
    retrySaveAfterConflict,
    renderDirty,
    renderLog,
    renderProgress,
    renderResultFilename,
    renderResultUrl,
    renderStatus,
    saveStatus,
    setScaleWidth,
    startRender,
    undo,
    redo,
    canUndo,
    canRedo,
    checkpoints,
    jumpToCheckpoint,
    createManualCheckpoint,
    clipEditing.handleAddText,
    clipEditing.handleAddTextAt,
    trackManagement.handleAddTrack,
    trackManagement.handleClearUnusedTracks,
    trackManagement.unusedTrackCount,
  ]);

  const playbackValue = useMemo<TimelinePlaybackContextValue>(() => ({
    currentTime: playback.currentTime,
    previewRef: playback.previewRef,
    playerContainerRef: playback.playerContainerRef,
    onPreviewTimeUpdate: playback.onPreviewTimeUpdate,
    formatTime: playback.formatTime,
  }), [
    playback.currentTime,
    playback.formatTime,
    playback.onPreviewTimeUpdate,
    playback.playerContainerRef,
    playback.previewRef,
  ]);

  return {
    editor,
    chrome,
    playback: playbackValue,
  };
}
