import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MediaLightbox } from '@/domains/media-lightbox/MediaLightbox';
import { useShots } from '@/shared/contexts/ShotsContext';
import type { GenerationRow } from '@/domains/generation/types';
import { VideoEditorLightboxOverlay } from '@/tools/video-editor/components/VideoEditorLightboxOverlay';
import type { DataProvider } from '@/tools/video-editor/data/DataProvider';
import {
  DataProviderWrapper,
  useVideoEditorRuntime,
} from '@/tools/video-editor/contexts/DataProviderContext';
import { TimelineChromeContextProvider } from '@/tools/video-editor/contexts/TimelineChromeContext';
import {
  TimelineEditorDataContextProvider,
  TimelineEditorOpsContextProvider,
  useTimelineEditorOps,
} from '@/tools/video-editor/contexts/TimelineEditorContext';
import { TimelinePlaybackContextProvider } from '@/tools/video-editor/contexts/TimelinePlaybackContext';
import {
  AgentChatProvider,
  type AgentChatContextValue,
} from '@/shared/contexts/AgentChatContext';
import { useEffects } from '@/tools/video-editor/hooks/useEffects';
import { useEffectRegistry } from '@/tools/video-editor/hooks/useEffectRegistry';
import { useEffectResources } from '@/tools/video-editor/hooks/useEffectResources';
import { useSelectedMediaClips } from '@/tools/video-editor/hooks/useSelectedMediaClips';
import { useTimelineState } from '@/tools/video-editor/hooks/useTimelineState';
import type {
  TimelineActionResizeStart,
  TimelineClipEdgeResizeEnd,
  TimelineEditorDataContextValue,
  TimelineEditorOpsContextValue,
} from '@/tools/video-editor/hooks/useTimelineState.types';
import { useVideoEditorLightboxNavigation } from '@/tools/video-editor/hooks/useVideoEditorLightboxNavigation';
import { isOpenableAssetType } from '@/tools/video-editor/lib/editor-utils';
import { loadGenerationForLightbox } from '@/tools/video-editor/lib/generation-utils';
import { useRenderDiagnostic } from '@/tools/video-editor/hooks/usePerfDiagnostics';
import type { ResolvedAssetRegistryEntry } from '@/tools/video-editor/types';

const log = import.meta.env.DEV ? (...args: Parameters<typeof console.log>) => console.log(...args) : () => {};

export function buildVideoEditorLightboxMedia(
  assetKey: string | null,
  asset: ResolvedAssetRegistryEntry | undefined,
): GenerationRow | null {
  if (!assetKey || !asset) {
    return null;
  }

  const src = asset.src || asset.file;
  if (!src || !isOpenableAssetType(asset.type, src)) {
    return null;
  }

  const isVideo = asset.type?.startsWith('video/')
    || /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(src);

  return {
    id: assetKey,
    generation_id: asset.generationId || assetKey,
    location: src,
    imageUrl: src,
    thumbUrl: asset.thumbnailUrl || src,
    type: isVideo ? 'video' : 'image',
    primary_variant_id: asset.variantId || null,
    name: asset.file,
  };
}

function VideoEditorAgentChatBridge({ children }: { children: React.ReactNode }) {
  const { timelineId } = useVideoEditorRuntime();
  const timelineEditorOps = useTimelineEditorOps();
  const { clips: timelineClips } = useSelectedMediaClips();

  const replaceSelectedTimelineClips = useCallback((nextClips: AgentChatContextValue['timelineClips']) => {
    const nextClipIds = nextClips.map((clip) => clip.clipId);
    if (typeof timelineEditorOps.replaceTimelineSelection === 'function') {
      timelineEditorOps.replaceTimelineSelection(nextClipIds);
      return;
    }

    timelineEditorOps.selectClips(nextClipIds);
  }, [timelineEditorOps]);

  const value = useMemo<AgentChatContextValue>(() => ({
    timelineId,
    timelineClips,
    replaceSelectedTimelineClips,
  }), [replaceSelectedTimelineClips, timelineClips, timelineId]);

  return (
    <AgentChatProvider value={value}>
      {children}
    </AgentChatProvider>
  );
}

function InnerProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string;
}) {
  useRenderDiagnostic('VideoEditorProvider');
  const effectsQuery = useEffects(userId);
  const effectResources = useEffectResources(userId);
  useEffectRegistry(
    effectsQuery.data?.map((effect) => ({
      slug: effect.slug,
      code: effect.code,
    })),
    effectResources.effects,
  );
  const { editor, chrome, playback } = useTimelineState();
  const { shots } = useShots();
  const [lightboxAssetKey, setLightboxAssetKey] = useState<string | null>(null);
  const [lightboxClipId, setLightboxClipId] = useState<string | null>(null);
  const lightboxAsset = lightboxAssetKey ? editor.resolvedConfig?.registry[lightboxAssetKey] : undefined;
  const lightboxFallbackMedia = useMemo(
    () => buildVideoEditorLightboxMedia(lightboxAssetKey, lightboxAsset),
    [lightboxAsset, lightboxAssetKey],
  );
  const lightboxGenerationId = lightboxAsset?.generationId ?? null;
  const lightboxQuery = useQuery({
    queryKey: ['video-editor', 'lightbox', lightboxGenerationId],
    queryFn: () => loadGenerationForLightbox(lightboxGenerationId as string),
    enabled: Boolean(lightboxGenerationId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (
      !lightboxAssetKey
      || !lightboxGenerationId
      || lightboxQuery.isLoading
      || lightboxQuery.data
      || lightboxFallbackMedia
    ) {
      return;
    }

    log('[video-editor] lightbox query returned no data; clearing asset key', {
      assetKey: lightboxAssetKey,
      clipId: lightboxClipId,
      generationId: lightboxGenerationId,
    });
    setLightboxAssetKey(null);
    setLightboxClipId(null);
  }, [lightboxAssetKey, lightboxClipId, lightboxFallbackMedia, lightboxGenerationId, lightboxQuery.data, lightboxQuery.isLoading]);

  const navResult = useVideoEditorLightboxNavigation({
    lightboxAssetKey,
    lightboxClipId,
    data: editor.data,
    shots,
    setLightboxAssetKey,
    setLightboxClipId,
  });

  const onDoubleClickAsset = useCallback((assetKey: string, clipId?: string) => {
    const asset = editor.resolvedConfig?.registry[assetKey];
    log('[video-editor] onDoubleClickAsset', {
      assetKey,
      clipId: clipId ?? null,
      hasAsset: Boolean(asset),
      generationId: asset?.generationId ?? null,
      file: asset?.file ?? null,
      type: asset?.type ?? null,
    });
    if (!buildVideoEditorLightboxMedia(assetKey, asset)) {
      return;
    }

    setLightboxClipId(clipId ?? null);
    setLightboxAssetKey(assetKey);
  }, [editor.resolvedConfig]);

  useEffect(() => {
    if (!lightboxAssetKey) {
      return;
    }

    log('[video-editor] lightbox state', {
      assetKey: lightboxAssetKey,
      clipId: lightboxClipId,
      generationId: lightboxGenerationId,
      isLoading: lightboxQuery.isLoading,
      hasData: Boolean(lightboxQuery.data),
      hasFallbackMedia: Boolean(lightboxFallbackMedia),
      mediaId: lightboxQuery.data?.id ?? null,
      mediaType: lightboxQuery.data?.type ?? null,
      mediaLocation: lightboxQuery.data?.location ?? null,
    });
  }, [lightboxAssetKey, lightboxClipId, lightboxFallbackMedia, lightboxGenerationId, lightboxQuery.data, lightboxQuery.isLoading]);

  const editorData = useMemo<TimelineEditorDataContextValue>(() => ({
    data: editor.data,
    resolvedConfig: editor.resolvedConfig,
    deviceClass: editor.deviceClass,
    inputModality: editor.inputModality,
    interactionMode: editor.interactionMode,
    gestureOwner: editor.gestureOwner,
    precisionEnabled: editor.precisionEnabled,
    contextTarget: editor.contextTarget,
    inspectorTarget: editor.inspectorTarget,
    interactionPolicy: editor.interactionPolicy,
    selectedClipId: editor.selectedClipId,
    selectedClipIds: editor.selectedClipIds,
    selectedClipIdsRef: editor.selectedClipIdsRef,
    additiveSelectionRef: editor.additiveSelectionRef,
    selectedTrackId: editor.selectedTrackId,
    primaryClipId: editor.primaryClipId,
    selectedClip: editor.selectedClip,
    selectedTrack: editor.selectedTrack,
    selectedClipHasPredecessor: editor.selectedClipHasPredecessor,
    compositionSize: editor.compositionSize,
    trackScaleMap: editor.trackScaleMap,
    scale: editor.scale,
    scaleWidth: editor.scaleWidth,
    isLoading: editor.isLoading,
    dataRef: editor.dataRef,
    pendingOpsRef: editor.pendingOpsRef,
    interactionStateRef: editor.interactionStateRef,
    coordinator: editor.coordinator,
    indicatorRef: editor.indicatorRef,
    editAreaRef: editor.editAreaRef,
    preferences: editor.preferences,
    timelineRef: editor.timelineRef,
    timelineWrapperRef: editor.timelineWrapperRef,
  }), [editor]);

  const onActionResizeStart: TimelineActionResizeStart = editor.onActionResizeStart;
  const onClipEdgeResizeEnd: TimelineClipEdgeResizeEnd = editor.onClipEdgeResizeEnd;

  const editorOps = useMemo<TimelineEditorOpsContextValue>(() => ({
    setInputModality: editor.setInputModality,
    setInputModalityFromPointerType: editor.setInputModalityFromPointerType,
    setInteractionMode: editor.setInteractionMode,
    setGestureOwner: editor.setGestureOwner,
    setPrecisionEnabled: editor.setPrecisionEnabled,
    setContextTarget: editor.setContextTarget,
    setInspectorTarget: editor.setInspectorTarget,
    setSelectedClipId: editor.setSelectedClipId,
    isClipSelected: editor.isClipSelected,
    selectClip: editor.selectClip,
    selectClips: editor.selectClips,
    replaceTimelineSelection: editor.replaceTimelineSelection,
    addToSelection: editor.addToSelection,
    clearSelection: editor.clearSelection,
    setSelectedTrackId: editor.setSelectedTrackId,
    setActiveClipTab: editor.setActiveClipTab,
    setAssetPanelState: editor.setAssetPanelState,
    registerGenerationAsset: editor.registerGenerationAsset,
    onCursorDrag: editor.onCursorDrag,
    onClickTimeArea: editor.onClickTimeArea,
    onActionResizeStart,
    onClipEdgeResizeEnd,
    onOverlayChange: editor.onOverlayChange,
    onTimelineDragOver: editor.onTimelineDragOver,
    onTimelineDragLeave: editor.onTimelineDragLeave,
    onTimelineDrop: editor.onTimelineDrop,
    handleAssetDrop: editor.handleAssetDrop,
    handleUpdateClips: editor.handleUpdateClips,
    handleUpdateClipsDeep: editor.handleUpdateClipsDeep,
    handleDeleteClips: editor.handleDeleteClips,
    handleDeleteClip: editor.handleDeleteClip,
    handleSelectedClipChange: editor.handleSelectedClipChange,
    handleResetClipPosition: editor.handleResetClipPosition,
    handleResetClipsPosition: editor.handleResetClipsPosition,
    handleSplitSelectedClip: editor.handleSplitSelectedClip,
    handleSplitClipAtTime: editor.handleSplitClipAtTime,
    handleSplitClipsAtPlayhead: editor.handleSplitClipsAtPlayhead,
    handleToggleMuteClips: editor.handleToggleMuteClips,
    handleToggleMute: editor.handleToggleMute,
    handleDetachAudioClip: editor.handleDetachAudioClip,
    handleTrackPopoverChange: editor.handleTrackPopoverChange,
    handleMoveTrack: editor.handleMoveTrack,
    handleRemoveTrack: editor.handleRemoveTrack,
    moveSelectedClipToTrack: editor.moveSelectedClipToTrack,
    moveSelectedClipsToTrack: editor.moveSelectedClipsToTrack,
    moveClipToRow: editor.moveClipToRow,
    createTrackAndMoveClip: editor.createTrackAndMoveClip,
    uploadFiles: editor.uploadFiles,
    applyEdit: editor.applyEdit,
    patchRegistry: editor.patchRegistry,
    unpatchRegistry: editor.unpatchRegistry,
    registerAsset: editor.registerAsset,
    onDoubleClickAsset,
    setLightboxAssetKey,
  }), [editor, onActionResizeStart, onClipEdgeResizeEnd, onDoubleClickAsset, setLightboxAssetKey]);

  const resolvedLightboxMedia = lightboxQuery.data ?? lightboxFallbackMedia;

  return (
    <TimelineEditorDataContextProvider value={editorData}>
      <TimelineEditorOpsContextProvider value={editorOps}>
        <VideoEditorAgentChatBridge>
          <TimelineChromeContextProvider value={chrome}>
            <TimelinePlaybackContextProvider value={playback}>
              {children}
              {lightboxAssetKey && resolvedLightboxMedia && (
                <>
                  <MediaLightbox
                    media={resolvedLightboxMedia}
                    navigation={navResult.navigation}
                    initialVariantId={lightboxAsset?.variantId ?? resolvedLightboxMedia.primary_variant_id ?? undefined}
                    onClose={() => {
                      setLightboxAssetKey(null);
                      setLightboxClipId(null);
                    }}
                    features={{ showDownload: true, showTaskDetails: true }}
                  />
                  {navResult.indicator ? <VideoEditorLightboxOverlay indicator={navResult.indicator} /> : null}
                </>
              )}
            </TimelinePlaybackContextProvider>
          </TimelineChromeContextProvider>
        </VideoEditorAgentChatBridge>
      </TimelineEditorOpsContextProvider>
    </TimelineEditorDataContextProvider>
  );
}

export function VideoEditorProvider({
  dataProvider,
  timelineId,
  timelineName,
  userId,
  children,
}: {
  dataProvider: DataProvider;
  timelineId: string;
  timelineName?: string | null;
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <DataProviderWrapper value={{ provider: dataProvider, timelineId, timelineName, userId }}>
      <InnerProvider userId={userId}>{children}</InnerProvider>
    </DataProviderWrapper>
  );
}
