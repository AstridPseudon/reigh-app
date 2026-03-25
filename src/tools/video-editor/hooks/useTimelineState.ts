import { useMemo } from 'react';
import { useVideoEditorRuntime } from '@/tools/video-editor/contexts/DataProviderContext';
import { useTimelineData } from '@/tools/video-editor/hooks/useTimelineData';
import { useTimelineEditing } from '@/tools/video-editor/hooks/useTimelineEditing';
import { useTimelinePlayback } from '@/tools/video-editor/hooks/useTimelinePlayback';
import { useTimelineTrackManagement } from '@/tools/video-editor/hooks/useTimelineTrackManagement';

export type { SaveStatus, RenderStatus, EditorPreferences, ActionDragState } from '@/tools/video-editor/hooks/useTimelineData';

export interface TimelineEditorContextValue {
  data: ReturnType<typeof useTimelineData>['data'];
  resolvedConfig: ReturnType<typeof useTimelineData>['resolvedConfig'];
  selectedClipId: ReturnType<typeof useTimelineData>['selectedClipId'];
  selectedTrackId: ReturnType<typeof useTimelineData>['selectedTrackId'];
  selectedClip: ReturnType<typeof useTimelineData>['selectedClip'];
  selectedTrack: ReturnType<typeof useTimelineData>['selectedTrack'];
  selectedClipHasPredecessor: boolean;
  compositionSize: ReturnType<typeof useTimelineData>['compositionSize'];
  trackScaleMap: ReturnType<typeof useTimelineData>['trackScaleMap'];
  scale: number;
  scaleWidth: number;
  isLoading: boolean;
  dataRef: ReturnType<typeof useTimelineData>['dataRef'];
  crossTrackActive: ReturnType<typeof useTimelineData>['crossTrackActive'];
  actionDragStateRef: ReturnType<typeof useTimelineData>['actionDragStateRef'];
  preferences: ReturnType<typeof useTimelineData>['preferences'];
  timelineRef: ReturnType<typeof useTimelinePlayback>['timelineRef'];
  timelineWrapperRef: ReturnType<typeof useTimelinePlayback>['timelineWrapperRef'];
  setSelectedClipId: ReturnType<typeof useTimelineData>['setSelectedClipId'];
  setSelectedTrackId: ReturnType<typeof useTimelineData>['setSelectedTrackId'];
  setActiveClipTab: ReturnType<typeof useTimelineData>['setActiveClipTab'];
  setAssetPanelState: ReturnType<typeof useTimelineData>['setAssetPanelState'];
  registerGenerationAsset: ReturnType<typeof useTimelineEditing>['registerGenerationAsset'];
  onCursorDrag: ReturnType<typeof useTimelinePlayback>['onCursorDrag'];
  onClickTimeArea: ReturnType<typeof useTimelinePlayback>['onClickTimeArea'];
  onActionMoveStart: ReturnType<typeof useTimelineEditing>['onActionMoveStart'];
  onActionMoving: ReturnType<typeof useTimelineEditing>['onActionMoving'];
  onActionMoveEnd: ReturnType<typeof useTimelineEditing>['onActionMoveEnd'];
  onActionResizeStart: ReturnType<typeof useTimelineEditing>['onActionResizeStart'];
  onActionResizeEnd: ReturnType<typeof useTimelineEditing>['onActionResizeEnd'];
  onChange: ReturnType<typeof useTimelineEditing>['onChange'];
  onOverlayChange: ReturnType<typeof useTimelineEditing>['onOverlayChange'];
  onTimelineDragOver: ReturnType<typeof useTimelineEditing>['onTimelineDragOver'];
  onTimelineDragLeave: ReturnType<typeof useTimelineEditing>['onTimelineDragLeave'];
  onTimelineDrop: ReturnType<typeof useTimelineEditing>['onTimelineDrop'];
  handleAssetDrop: ReturnType<typeof useTimelineEditing>['handleAssetDrop'];
  handleDeleteClip: ReturnType<typeof useTimelineEditing>['handleDeleteClip'];
  handleSelectedClipChange: ReturnType<typeof useTimelineEditing>['handleSelectedClipChange'];
  handleResetClipPosition: ReturnType<typeof useTimelineEditing>['handleResetClipPosition'];
  handleSplitSelectedClip: ReturnType<typeof useTimelineEditing>['handleSplitSelectedClip'];
  handleSplitClipAtTime: ReturnType<typeof useTimelineEditing>['handleSplitClipAtTime'];
  handleToggleMute: ReturnType<typeof useTimelineEditing>['handleToggleMute'];
  handleTrackPopoverChange: ReturnType<typeof useTimelineTrackManagement>['handleTrackPopoverChange'];
  handleReorderTrack: ReturnType<typeof useTimelineTrackManagement>['handleReorderTrack'];
  handleRemoveTrack: ReturnType<typeof useTimelineTrackManagement>['handleRemoveTrack'];
  moveSelectedClipToTrack: ReturnType<typeof useTimelineTrackManagement>['moveSelectedClipToTrack'];
  moveClipToRow: ReturnType<typeof useTimelineTrackManagement>['moveClipToRow'];
  createTrackAndMoveClip: ReturnType<typeof useTimelineTrackManagement>['createTrackAndMoveClip'];
  clearActionDragState: ReturnType<typeof useTimelineEditing>['clearActionDragState'];
  uploadFiles: ReturnType<typeof useTimelineData>['uploadFiles'];
  onDoubleClickAsset?: (assetKey: string) => void;
  registerLightboxHandler?: (handler: ((assetKey: string) => void) | null) => void;
}

export interface TimelineChromeContextValue {
  timelineName: string | null;
  saveStatus: ReturnType<typeof useTimelineData>['saveStatus'];
  renderStatus: ReturnType<typeof useTimelineData>['renderStatus'];
  renderLog: ReturnType<typeof useTimelineData>['renderLog'];
  renderDirty: ReturnType<typeof useTimelineData>['renderDirty'];
  renderProgress: ReturnType<typeof useTimelineData>['renderProgress'];
  renderResultUrl: ReturnType<typeof useTimelineData>['renderResultUrl'];
  renderResultFilename: ReturnType<typeof useTimelineData>['renderResultFilename'];
  setScaleWidth: ReturnType<typeof useTimelineData>['setScaleWidth'];
  handleAddTrack: ReturnType<typeof useTimelineTrackManagement>['handleAddTrack'];
  handleClearUnusedTracks: ReturnType<typeof useTimelineTrackManagement>['handleClearUnusedTracks'];
  unusedTrackCount: ReturnType<typeof useTimelineTrackManagement>['unusedTrackCount'];
  handleAddText: ReturnType<typeof useTimelineEditing>['handleAddText'];
  reloadFromServer: ReturnType<typeof useTimelineData>['reloadFromServer'];
  startRender: ReturnType<typeof useTimelineData>['startRender'];
}

export interface TimelinePlaybackContextValue {
  currentTime: number;
  previewRef: ReturnType<typeof useTimelinePlayback>['previewRef'];
  playerContainerRef: ReturnType<typeof useTimelinePlayback>['playerContainerRef'];
  onPreviewTimeUpdate: ReturnType<typeof useTimelinePlayback>['onPreviewTimeUpdate'];
  formatTime: ReturnType<typeof useTimelinePlayback>['formatTime'];
}

export interface UseTimelineStateResult {
  editor: TimelineEditorContextValue;
  chrome: TimelineChromeContextValue;
  playback: TimelinePlaybackContextValue;
}

export function useTimelineState(): UseTimelineStateResult {
  const runtime = useVideoEditorRuntime();
  const playback = useTimelinePlayback();
  const dataHook = useTimelineData();

  const editing = useTimelineEditing({
    dataRef: dataHook.dataRef,
    resolvedConfig: dataHook.resolvedConfig,
    data: dataHook.data,
    selectedClipId: dataHook.selectedClipId,
    selectedTrackId: dataHook.selectedTrackId,
    selectedTrack: dataHook.selectedTrack,
    currentTime: playback.currentTime,
    scale: dataHook.scale,
    scaleWidth: dataHook.scaleWidth,
    crossTrackActive: dataHook.crossTrackActive,
    actionDragStateRef: dataHook.actionDragStateRef,
    resizeStartRef: dataHook.resizeStartRef,
    setSelectedClipId: dataHook.setSelectedClipId,
    setSelectedTrackId: dataHook.setSelectedTrackId,
    applyTimelineEdit: dataHook.applyTimelineEdit,
    applyResolvedConfigEdit: dataHook.applyResolvedConfigEdit,
    patchRegistry: dataHook.patchRegistry,
    registerAsset: dataHook.registerAsset,
    uploadAsset: dataHook.uploadAsset,
    invalidateAssetRegistry: dataHook.invalidateAssetRegistry,
    resolveAssetUrl: runtime.provider.resolveAssetUrl.bind(runtime.provider),
  });

  const trackManagement = useTimelineTrackManagement({
    dataRef: dataHook.dataRef,
    resolvedConfig: dataHook.resolvedConfig,
    selectedClipId: dataHook.selectedClipId,
    setSelectedTrackId: dataHook.setSelectedTrackId,
    applyTimelineEdit: dataHook.applyTimelineEdit,
    applyResolvedConfigEdit: dataHook.applyResolvedConfigEdit,
  });

  const editor = useMemo<TimelineEditorContextValue>(() => ({
    data: dataHook.data,
    resolvedConfig: dataHook.resolvedConfig,
    selectedClipId: dataHook.selectedClipId,
    selectedTrackId: dataHook.selectedTrackId,
    selectedClip: dataHook.selectedClip,
    selectedTrack: dataHook.selectedTrack,
    selectedClipHasPredecessor: dataHook.selectedClipHasPredecessor,
    compositionSize: dataHook.compositionSize,
    trackScaleMap: dataHook.trackScaleMap,
    scale: dataHook.scale,
    scaleWidth: dataHook.scaleWidth,
    isLoading: dataHook.isLoading,
    dataRef: dataHook.dataRef,
    crossTrackActive: dataHook.crossTrackActive,
    actionDragStateRef: dataHook.actionDragStateRef,
    preferences: dataHook.preferences,
    timelineRef: playback.timelineRef,
    timelineWrapperRef: playback.timelineWrapperRef,
    setSelectedClipId: dataHook.setSelectedClipId,
    setSelectedTrackId: dataHook.setSelectedTrackId,
    setActiveClipTab: dataHook.setActiveClipTab,
    setAssetPanelState: dataHook.setAssetPanelState,
    registerGenerationAsset: editing.registerGenerationAsset,
    onCursorDrag: playback.onCursorDrag,
    onClickTimeArea: playback.onClickTimeArea,
    onActionMoveStart: editing.onActionMoveStart,
    onActionMoving: editing.onActionMoving,
    onActionMoveEnd: editing.onActionMoveEnd,
    onActionResizeStart: editing.onActionResizeStart,
    onActionResizeEnd: editing.onActionResizeEnd,
    onChange: editing.onChange,
    onOverlayChange: editing.onOverlayChange,
    onTimelineDragOver: editing.onTimelineDragOver,
    onTimelineDragLeave: editing.onTimelineDragLeave,
    onTimelineDrop: editing.onTimelineDrop,
    handleAssetDrop: editing.handleAssetDrop,
    handleDeleteClip: editing.handleDeleteClip,
    handleSelectedClipChange: editing.handleSelectedClipChange,
    handleResetClipPosition: editing.handleResetClipPosition,
    handleSplitSelectedClip: editing.handleSplitSelectedClip,
    handleSplitClipAtTime: editing.handleSplitClipAtTime,
    handleToggleMute: editing.handleToggleMute,
    handleTrackPopoverChange: trackManagement.handleTrackPopoverChange,
    handleReorderTrack: trackManagement.handleReorderTrack,
    handleRemoveTrack: trackManagement.handleRemoveTrack,
    moveSelectedClipToTrack: trackManagement.moveSelectedClipToTrack,
    moveClipToRow: trackManagement.moveClipToRow,
    createTrackAndMoveClip: trackManagement.createTrackAndMoveClip,
    clearActionDragState: editing.clearActionDragState,
    uploadFiles: dataHook.uploadFiles,
  }), [
    dataHook.actionDragStateRef,
    dataHook.compositionSize,
    dataHook.crossTrackActive,
    dataHook.data,
    dataHook.dataRef,
    dataHook.isLoading,
    dataHook.preferences,
    dataHook.resolvedConfig,
    dataHook.scale,
    dataHook.scaleWidth,
    dataHook.selectedClip,
    dataHook.selectedClipHasPredecessor,
    dataHook.selectedClipId,
    dataHook.selectedTrack,
    dataHook.selectedTrackId,
    dataHook.setActiveClipTab,
    dataHook.setAssetPanelState,
    dataHook.setSelectedClipId,
    dataHook.setSelectedTrackId,
    dataHook.trackScaleMap,
    dataHook.uploadFiles,
    editing.clearActionDragState,
    editing.handleAssetDrop,
    editing.handleDeleteClip,
    editing.handleResetClipPosition,
    editing.handleSelectedClipChange,
    editing.handleSplitSelectedClip,
    editing.handleSplitClipAtTime,
    editing.handleToggleMute,
    editing.onActionMoveEnd,
    editing.onActionMoveStart,
    editing.onActionMoving,
    editing.onActionResizeEnd,
    editing.onActionResizeStart,
    editing.onChange,
    editing.onOverlayChange,
    editing.onTimelineDragLeave,
    editing.onTimelineDragOver,
    editing.onTimelineDrop,
    editing.registerGenerationAsset,
    playback.onClickTimeArea,
    playback.onCursorDrag,
    playback.timelineRef,
    playback.timelineWrapperRef,
    trackManagement.createTrackAndMoveClip,
    trackManagement.handleRemoveTrack,
    trackManagement.handleReorderTrack,
    trackManagement.handleTrackPopoverChange,
    trackManagement.moveClipToRow,
    trackManagement.moveSelectedClipToTrack,
  ]);

  const chrome = useMemo<TimelineChromeContextValue>(() => ({
    timelineName: runtime.timelineName ?? null,
    saveStatus: dataHook.saveStatus,
    renderStatus: dataHook.renderStatus,
    renderLog: dataHook.renderLog,
    renderDirty: dataHook.renderDirty,
    renderProgress: dataHook.renderProgress,
    renderResultUrl: dataHook.renderResultUrl,
    renderResultFilename: dataHook.renderResultFilename,
    setScaleWidth: dataHook.setScaleWidth,
    handleAddTrack: trackManagement.handleAddTrack,
    handleClearUnusedTracks: trackManagement.handleClearUnusedTracks,
    unusedTrackCount: trackManagement.unusedTrackCount,
    handleAddText: editing.handleAddText,
    reloadFromServer: dataHook.reloadFromServer,
    startRender: dataHook.startRender,
  }), [
    runtime.timelineName,
    dataHook.reloadFromServer,
    dataHook.renderDirty,
    dataHook.renderLog,
    dataHook.renderProgress,
    dataHook.renderResultFilename,
    dataHook.renderResultUrl,
    dataHook.renderStatus,
    dataHook.saveStatus,
    dataHook.setScaleWidth,
    dataHook.startRender,
    editing.handleAddText,
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
