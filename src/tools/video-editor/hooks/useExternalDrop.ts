import { useCallback, useEffect, useRef } from 'react';
import {
  getGenerationDropData,
  getMultiGenerationDropData,
  getDragType,
  type GenerationDropData,
} from '@/shared/lib/dnd/dragDrop';
import { inferDragKind } from '@/tools/video-editor/lib/drop-position';
import type { DragCoordinator } from '@/tools/video-editor/hooks/useDragCoordinator';
import type { UseAssetManagementResult } from '@/tools/video-editor/hooks/useAssetManagement';
import type {
  TimelineApplyEdit,
  TimelineInvalidateAssetRegistry,
  TimelinePatchRegistry,
  TimelineRegisterAsset,
  TimelineUploadAsset,
} from '@/tools/video-editor/hooks/useTimelineData.types';
import {
  createEffectLayerClipMeta,
  getNextClipId,
  type ClipMeta,
  type TimelineData,
} from '@/tools/video-editor/lib/timeline-data';
import type { TimelineAction } from '@/tools/video-editor/types/timeline-canvas';
import type { TrackKind } from '@/tools/video-editor/types';
import { getCompatibleTrackId, updateClipOrder } from '@/tools/video-editor/lib/coordinate-utils';
import { getTrackIndex } from '@/tools/video-editor/lib/editor-utils';
import { createAutoScroller } from '@/tools/video-editor/lib/auto-scroll';
import { resolveOverlaps } from '@/tools/video-editor/lib/resolve-overlaps';

type TimelineDropPosition = NonNullable<ReturnType<DragCoordinator['update']>>;

function isGenerationDragType(dragType: ReturnType<typeof getDragType>) {
  return dragType === 'generation' || dragType === 'generation-multi';
}

function isVideoGeneration(data: GenerationDropData): boolean {
  const contentType = typeof data.metadata?.content_type === 'string'
    ? data.metadata.content_type
    : null;

  return contentType?.startsWith('video/')
    || data.variantType === 'video'
    || /\.(mp4|mov|webm|m4v)$/i.test(data.imageUrl);
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function getDroppedGenerationDuration(data: GenerationDropData): number {
  if (!isVideoGeneration(data)) {
    return 5;
  }

  return readPositiveNumber(data.metadata?.duration)
    ?? readPositiveNumber(data.metadata?.duration_seconds)
    ?? readPositiveNumber(data.metadata?.original_duration)
    ?? 5;
}

function createTrack(
  dataRef: React.MutableRefObject<TimelineData | null>,
  kind: 'audio' | 'visual',
  insertAtTop: boolean,
  label?: string,
): { trackId: string; insertAtTop: boolean } | null {
  const current = dataRef.current;
  if (!current) {
    return null;
  }

  const prefix = kind === 'audio' ? 'A' : 'V';
  const nextNumber = getTrackIndex(current.tracks, prefix) + 1;
  const trackId = `${prefix}${nextNumber}`;
  const nextTrack = { id: trackId, kind, label: label ?? trackId };
  const nextRow = { id: trackId, actions: [] };

  dataRef.current = {
    ...current,
    tracks: insertAtTop ? [nextTrack, ...current.tracks] : [...current.tracks, nextTrack],
    rows: insertAtTop ? [nextRow, ...current.rows] : [...current.rows, nextRow],
  };

  return { trackId, insertAtTop };
}

function createTrackAtTop(
  dataRef: React.MutableRefObject<TimelineData | null>,
  kind: 'audio' | 'visual',
  label?: string,
): { trackId: string; insertAtTop: true } | null {
  const createdTrack = createTrack(dataRef, kind, true, label);
  return createdTrack ? { ...createdTrack, insertAtTop: true } : null;
}

function createTrackForDrop(
  dataRef: React.MutableRefObject<TimelineData | null>,
  kind: 'audio' | 'visual',
  insertAtTop: boolean,
  label?: string,
): { trackId: string; insertAtTop: boolean } | null {
  return insertAtTop
    ? createTrackAtTop(dataRef, kind, label)
    : createTrack(dataRef, kind, false, label);
}

function removeAction(rows: TimelineData['rows'], actionId: string) {
  return rows.map((row) => ({
    ...row,
    actions: row.actions.filter((action) => action.id !== actionId),
  }));
}

function inferFileDropKind(file: File): TrackKind {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  return ['.mp3', '.wav', '.aac', '.m4a'].includes(extension) ? 'audio' : 'visual';
}

function isImageFile(file: File): boolean {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  return file.type.startsWith('image/')
    || ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif'].includes(extension);
}

function handleTextToolDrop({
  dataRef,
  dropPosition,
  insertAtTop,
  handleAddTextAt,
}: {
  dataRef: React.MutableRefObject<TimelineData | null>;
  dropPosition: TimelineDropPosition;
  insertAtTop: boolean;
  handleAddTextAt?: (trackId: string, time: number) => void;
}): boolean {
  if (!handleAddTextAt || !dataRef.current) {
    return false;
  }

  let targetTrackId = dropPosition.isNewTrack ? undefined : dropPosition.trackId;
  if (!targetTrackId) {
    targetTrackId = createTrackForDrop(dataRef, 'visual', insertAtTop)?.trackId;
  }

  if (!targetTrackId) {
    return true;
  }

  handleAddTextAt(targetTrackId, dropPosition.time);
  return true;
}

function handleEffectLayerDrop({
  dataRef,
  dropPosition,
  insertAtTop,
  selectedTrackId,
  applyEdit,
}: {
  dataRef: React.MutableRefObject<TimelineData | null>;
  dropPosition: TimelineDropPosition;
  insertAtTop: boolean;
  selectedTrackId: string | null;
  applyEdit: TimelineApplyEdit;
}): boolean {
  let current = dataRef.current;
  if (!current) {
    return false;
  }

  let targetTrackId = dropPosition.isNewTrack
    ? null
    : getCompatibleTrackId(current.tracks, dropPosition.trackId, 'visual', selectedTrackId);

  if (!targetTrackId) {
    targetTrackId = createTrackForDrop(dataRef, 'visual', insertAtTop)?.trackId ?? null;
    current = dataRef.current;
  }

  if (!targetTrackId || !current) {
    return true;
  }

  const clipId = getNextClipId(current.meta);
  const clipMeta = createEffectLayerClipMeta(targetTrackId);
  const duration = clipMeta.hold ?? 5;
  const action: TimelineAction = {
    id: clipId,
    start: Math.max(0, dropPosition.time),
    end: Math.max(0, dropPosition.time) + duration,
    effectId: `effect-${clipId}`,
  };
  const rowsWithClip = current.rows.map((row) => (
    row.id === targetTrackId
      ? { ...row, actions: [...row.actions, action] }
      : row
  ));
  const { rows: nextRows, metaPatches, adjustments: _adjustments } = resolveOverlaps(
    rowsWithClip,
    targetTrackId,
    clipId,
    current.meta,
  );
  const resolvedAction = nextRows
    .find((row) => row.id === targetTrackId)
    ?.actions.find((candidate) => candidate.id === clipId);
  const nextClipOrder = updateClipOrder(current.clipOrder, targetTrackId, (ids) => [...ids, clipId]);

  applyEdit({
    type: 'rows',
    rows: nextRows,
    metaUpdates: {
      ...metaPatches,
      [clipId]: {
        ...clipMeta,
        hold: resolvedAction ? Math.max(0.05, resolvedAction.end - resolvedAction.start) : clipMeta.hold,
      },
    },
    clipOrderOverride: nextClipOrder,
  });
  return true;
}

async function handleFileDrop({
  files,
  dataRef,
  pendingOpsRef,
  dropPosition,
  insertAtTop,
  selectedTrackId,
  applyEdit,
  patchRegistry,
  uploadAsset,
  invalidateAssetRegistry,
  resolveAssetUrl,
  registerGenerationAsset,
  uploadImageGeneration,
  dropAsset,
}: {
  files: File[];
  dataRef: React.MutableRefObject<TimelineData | null>;
  pendingOpsRef: React.MutableRefObject<number>;
  dropPosition: TimelineDropPosition;
  insertAtTop: boolean;
  selectedTrackId: string | null;
  applyEdit: TimelineApplyEdit;
  patchRegistry: TimelinePatchRegistry;
  uploadAsset: TimelineUploadAsset;
  invalidateAssetRegistry: TimelineInvalidateAssetRegistry;
  resolveAssetUrl: (file: string) => Promise<string>;
  registerGenerationAsset: UseAssetManagementResult['registerGenerationAsset'];
  uploadImageGeneration: UseAssetManagementResult['uploadImageGeneration'];
  dropAsset: UseAssetManagementResult['handleAssetDrop'];
}): Promise<boolean> {
  if (!files.length || !dataRef.current) {
    return false;
  }

  const defaultClipDuration = 5;
  let timeOffset = 0;

  for (const file of files) {
    const kind = inferFileDropKind(file);
    let compatibleTrackId = dropPosition.isNewTrack
      ? null
      : getCompatibleTrackId(dataRef.current.tracks, dropPosition.trackId, kind, selectedTrackId);

    if (!compatibleTrackId) {
      compatibleTrackId = createTrackForDrop(dataRef, kind, insertAtTop)?.trackId ?? null;
    }

    if (!compatibleTrackId || !dataRef.current) {
      continue;
    }

    const clipTime = dropPosition.time + timeOffset;
    timeOffset += defaultClipDuration;

    const skeletonId = `uploading-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const skeletonMeta: ClipMeta = {
      asset: `uploading:${file.name}`,
      track: compatibleTrackId,
      clipType: kind === 'audio' ? 'media' : 'hold',
      hold: kind === 'audio' ? undefined : defaultClipDuration,
      from: kind === 'audio' ? 0 : undefined,
      to: kind === 'audio' ? defaultClipDuration : undefined,
    };
    const skeletonAction: TimelineAction = {
      id: skeletonId,
      start: clipTime,
      end: clipTime + defaultClipDuration,
      effectId: `effect-${skeletonId}`,
    };

    const nextRows = dataRef.current.rows.map((row) =>
      row.id === compatibleTrackId
        ? { ...row, actions: [...row.actions, skeletonAction] }
        : row,
    );
    applyEdit({
      type: 'rows',
      rows: nextRows,
      metaUpdates: { [skeletonId]: skeletonMeta },
    }, { save: false });

    pendingOpsRef.current += 1;
    void (async () => {
      try {
        if (isImageFile(file)) {
          const generationData = await uploadImageGeneration(file);
          const current = dataRef.current;
          if (!current) {
            return;
          }

          applyEdit({
            type: 'rows',
            rows: removeAction(current.rows, skeletonId),
            metaDeletes: [skeletonId],
          });
          const assetId = registerGenerationAsset(generationData);
          if (assetId) {
            dropAsset(assetId, compatibleTrackId ?? undefined, clipTime);
          }
          return;
        }

        const result = await uploadAsset(file);
        const sourceUrl = await resolveAssetUrl(result.entry.file);
        patchRegistry(result.assetId, result.entry, sourceUrl);

        const current = dataRef.current;
        if (!current) {
          return;
        }

        applyEdit({
          type: 'rows',
          rows: removeAction(current.rows, skeletonId),
          metaDeletes: [skeletonId],
        });
        dropAsset(result.assetId, compatibleTrackId ?? undefined, clipTime);
        void invalidateAssetRegistry();
      } catch (error) {
        console.error('[drop] Upload failed:', error);
        const current = dataRef.current;
        if (!current) {
          return;
        }

        applyEdit({
          type: 'rows',
          rows: removeAction(current.rows, skeletonId),
          metaDeletes: [skeletonId],
        }, { save: false });
      } finally {
        pendingOpsRef.current -= 1;
      }
    })();
  }

  return true;
}

function handleMultiGenerationDrop({
  generationItems,
  dataRef,
  dropPosition,
  insertAtTop,
  registerGenerationAsset,
  patchRegistry,
  dropAsset,
}: {
  generationItems: GenerationDropData[];
  dataRef: React.MutableRefObject<TimelineData | null>;
  dropPosition: TimelineDropPosition;
  insertAtTop: boolean;
  registerGenerationAsset: UseAssetManagementResult['registerGenerationAsset'];
  patchRegistry: TimelinePatchRegistry;
  dropAsset: UseAssetManagementResult['handleAssetDrop'];
}): boolean {
  if (!generationItems.length || !dataRef.current) {
    return false;
  }

  let targetTrackId = dropPosition.isNewTrack ? undefined : dropPosition.trackId;
  let forceNewTrack = dropPosition.isNewTrack;
  let timeOffset = 0;

  for (const generationData of generationItems) {
    const trackIdsBeforeDrop = new Set(dataRef.current.tracks.map((track) => track.id));
    const assetId = registerGenerationAsset(generationData);

    if (!assetId) {
      continue;
    }

    if (isVideoGeneration(generationData)) {
      const existingEntry = dataRef.current.registry.assets[assetId];
      if (existingEntry) {
        patchRegistry(assetId, {
          ...existingEntry,
          duration: getDroppedGenerationDuration(generationData),
        }, generationData.imageUrl);
      }
    }

    dropAsset(
      assetId,
      targetTrackId,
      dropPosition.time + timeOffset,
      forceNewTrack,
      forceNewTrack ? insertAtTop : false,
    );

    timeOffset += getDroppedGenerationDuration(generationData);

    if (!forceNewTrack || !dataRef.current) {
      continue;
    }

    const createdTrackId = dataRef.current.tracks.find((track) => !trackIdsBeforeDrop.has(track.id))?.id
      ?? (insertAtTop ? dataRef.current.tracks[0]?.id : dataRef.current.tracks[dataRef.current.tracks.length - 1]?.id);
    if (createdTrackId) {
      targetTrackId = createdTrackId;
    }
    forceNewTrack = false;
  }

  return true;
}

function handleSingleGenerationDrop({
  generationData,
  dataRef,
  dropPosition,
  insertAtTop,
  registerGenerationAsset,
  dropAsset,
}: {
  generationData: GenerationDropData;
  dataRef: React.MutableRefObject<TimelineData | null>;
  dropPosition: TimelineDropPosition;
  insertAtTop: boolean;
  registerGenerationAsset: UseAssetManagementResult['registerGenerationAsset'];
  dropAsset: UseAssetManagementResult['handleAssetDrop'];
}): boolean {
  if (!dataRef.current) {
    return false;
  }

  const assetId = registerGenerationAsset(generationData);
  if (!assetId) {
    return true;
  }

  dropAsset(
    assetId,
    dropPosition.isNewTrack ? undefined : dropPosition.trackId,
    dropPosition.time,
    dropPosition.isNewTrack,
    insertAtTop,
  );
  return true;
}

function handleAssetDrop({
  assetKey,
  assetKind,
  dataRef,
  dropPosition,
  insertAtTop,
  selectedTrackId,
  dropAsset,
}: {
  assetKey: string;
  assetKind: TrackKind;
  dataRef: React.MutableRefObject<TimelineData | null>;
  dropPosition: TimelineDropPosition;
  insertAtTop: boolean;
  selectedTrackId: string | null;
  dropAsset: UseAssetManagementResult['handleAssetDrop'];
}): boolean {
  if (!assetKey || !dataRef.current) {
    return false;
  }

  if (dropPosition.isNewTrack) {
    dropAsset(assetKey, undefined, dropPosition.time, true, insertAtTop);
    return true;
  }

  const compatibleTrackId = getCompatibleTrackId(
    dataRef.current.tracks,
    dropPosition.trackId,
    assetKind || 'visual',
    selectedTrackId,
  );
  if (!compatibleTrackId) {
    return true;
  }

  dropAsset(assetKey, compatibleTrackId, dropPosition.time);
  return true;
}

function finalizeExternalDrop({
  event,
  coordinator,
  autoScrollerRef,
  externalDragFrameRef,
  latestExternalDragRef,
  latestExternalPositionRef,
}: {
  event: React.DragEvent<HTMLDivElement>;
  coordinator: DragCoordinator;
  autoScrollerRef: React.MutableRefObject<ReturnType<typeof createAutoScroller> | null>;
  externalDragFrameRef: React.MutableRefObject<number | null>;
  latestExternalDragRef: React.MutableRefObject<{
    clientX: number;
    clientY: number;
    sourceKind: TrackKind | null;
  } | null>;
  latestExternalPositionRef: React.MutableRefObject<ReturnType<DragCoordinator['update']> | null>;
}): TimelineDropPosition {
  event.preventDefault();
  delete event.currentTarget.dataset.dragOver;
  autoScrollerRef.current?.stop();
  autoScrollerRef.current = null;
  if (externalDragFrameRef.current !== null) {
    window.cancelAnimationFrame(externalDragFrameRef.current);
    externalDragFrameRef.current = null;
  }

  if (latestExternalDragRef.current) {
    latestExternalPositionRef.current = coordinator.update({
      clientX: latestExternalDragRef.current.clientX,
      clientY: latestExternalDragRef.current.clientY,
      sourceKind: latestExternalDragRef.current.sourceKind,
    });
  }

  const dropPosition = coordinator.lastPosition
    ?? latestExternalPositionRef.current
    ?? coordinator.update({
      clientX: event.clientX,
      clientY: event.clientY,
      sourceKind: inferDragKind(event),
    });

  latestExternalDragRef.current = null;
  latestExternalPositionRef.current = null;
  coordinator.end();
  return dropPosition;
}

async function dispatchTimelineDrop({
  event,
  dataRef,
  pendingOpsRef,
  dropPosition,
  selectedTrackId,
  applyEdit,
  patchRegistry,
  uploadAsset,
  invalidateAssetRegistry,
  resolveAssetUrl,
  registerGenerationAsset,
  uploadImageGeneration,
  dropAsset,
  handleAddTextAt,
}: {
  event: React.DragEvent<HTMLDivElement>;
  dataRef: React.MutableRefObject<TimelineData | null>;
  pendingOpsRef: React.MutableRefObject<number>;
  dropPosition: TimelineDropPosition;
  selectedTrackId: string | null;
  applyEdit: TimelineApplyEdit;
  patchRegistry: TimelinePatchRegistry;
  uploadAsset: TimelineUploadAsset;
  invalidateAssetRegistry: TimelineInvalidateAssetRegistry;
  resolveAssetUrl: (file: string) => Promise<string>;
  registerGenerationAsset: UseAssetManagementResult['registerGenerationAsset'];
  uploadImageGeneration: UseAssetManagementResult['uploadImageGeneration'];
  dropAsset: UseAssetManagementResult['handleAssetDrop'];
  handleAddTextAt?: (trackId: string, time: number) => void;
}) {
  const insertAtTop = Boolean(dropPosition.isNewTrackTop);

  if (event.dataTransfer.types.includes('text-tool')) {
    handleTextToolDrop({ dataRef, dropPosition, insertAtTop, handleAddTextAt });
    return;
  }

  if (event.dataTransfer.types.includes('effect-layer')) {
    handleEffectLayerDrop({ dataRef, dropPosition, insertAtTop, selectedTrackId, applyEdit });
    return;
  }

  if (await handleFileDrop({
    files: Array.from(event.dataTransfer.files),
    dataRef,
    pendingOpsRef,
    dropPosition,
    insertAtTop,
    selectedTrackId,
    applyEdit,
    patchRegistry,
    uploadAsset,
    invalidateAssetRegistry,
    resolveAssetUrl,
    registerGenerationAsset,
    uploadImageGeneration,
    dropAsset,
  })) {
    return;
  }

  const multiGenerationData = getMultiGenerationDropData(event);
  if (multiGenerationData?.length) {
    handleMultiGenerationDrop({
      generationItems: multiGenerationData,
      dataRef,
      dropPosition,
      insertAtTop,
      registerGenerationAsset,
      patchRegistry,
      dropAsset,
    });
    return;
  }

  const generationData = getGenerationDropData(event);
  if (generationData) {
    handleSingleGenerationDrop({
      generationData,
      dataRef,
      dropPosition,
      insertAtTop,
      registerGenerationAsset,
      dropAsset,
    });
    return;
  }

  handleAssetDrop({
    assetKey: event.dataTransfer.getData('asset-key'),
    assetKind: event.dataTransfer.getData('asset-kind') as TrackKind,
    dataRef,
    dropPosition,
    insertAtTop,
    selectedTrackId,
    dropAsset,
  });
}

export interface UseExternalDropArgs {
  dataRef: React.MutableRefObject<TimelineData | null>;
  pendingOpsRef: React.MutableRefObject<number>;
  scale: number;
  scaleWidth: number;
  selectedTrackId: string | null;
  applyEdit: TimelineApplyEdit;
  patchRegistry: TimelinePatchRegistry;
  registerAsset: TimelineRegisterAsset;
  uploadAsset: TimelineUploadAsset;
  invalidateAssetRegistry: TimelineInvalidateAssetRegistry;
  resolveAssetUrl: (file: string) => Promise<string>;
  coordinator: DragCoordinator;
  registerGenerationAsset: UseAssetManagementResult['registerGenerationAsset'];
  uploadImageGeneration: UseAssetManagementResult['uploadImageGeneration'];
  handleAssetDrop: UseAssetManagementResult['handleAssetDrop'];
  handleAddTextAt?: (trackId: string, time: number) => void;
}

export interface UseExternalDropResult {
  onTimelineDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onTimelineDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onTimelineDrop: (event: React.DragEvent<HTMLDivElement>) => void;
}

export function useExternalDrop({
  dataRef,
  pendingOpsRef,
  selectedTrackId,
  applyEdit,
  patchRegistry,
  uploadAsset,
  invalidateAssetRegistry,
  resolveAssetUrl,
  coordinator,
  registerGenerationAsset,
  uploadImageGeneration,
  handleAssetDrop: dropAsset,
  handleAddTextAt,
}: UseExternalDropArgs): UseExternalDropResult {
  const externalDragFrameRef = useRef<number | null>(null);
  const autoScrollerRef = useRef<ReturnType<typeof createAutoScroller> | null>(null);
  const latestExternalDragRef = useRef<{
    clientX: number;
    clientY: number;
    sourceKind: TrackKind | null;
  } | null>(null);
  const latestExternalPositionRef = useRef<ReturnType<DragCoordinator['update']> | null>(null);

  const clearExternalDragState = useCallback(() => {
    if (externalDragFrameRef.current !== null) {
      window.cancelAnimationFrame(externalDragFrameRef.current);
      externalDragFrameRef.current = null;
    }
    autoScrollerRef.current?.stop();
    autoScrollerRef.current = null;
    latestExternalDragRef.current = null;
    latestExternalPositionRef.current = null;
    coordinator.end();
  }, [coordinator]);

  useEffect(() => {
    return () => {
      clearExternalDragState();
    };
  }, [clearExternalDragState]);

  const onTimelineDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const dragType = getDragType(event);
    const types = Array.from(event.dataTransfer.types);
    if (!types.includes('asset-key')
      && !types.includes('text-tool')
      && !types.includes('effect-layer')
      && dragType !== 'file'
      && !isGenerationDragType(dragType)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.dataset.dragOver = 'true';
    latestExternalDragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      sourceKind: inferDragKind(event),
    };
    if (!autoScrollerRef.current && coordinator.editAreaRef.current) {
      autoScrollerRef.current = createAutoScroller(coordinator.editAreaRef.current, (clientX, clientY) => {
        const currentDrag = latestExternalDragRef.current;
        if (!currentDrag) {
          return;
        }

        latestExternalPositionRef.current = coordinator.update({
          clientX,
          clientY,
          sourceKind: currentDrag.sourceKind,
        });
      });
    }
    autoScrollerRef.current?.update(event.clientX, event.clientY);

    if (externalDragFrameRef.current !== null) {
      return;
    }

    externalDragFrameRef.current = window.requestAnimationFrame(() => {
      externalDragFrameRef.current = null;
      const currentDrag = latestExternalDragRef.current;
      if (!currentDrag) {
        return;
      }

      latestExternalPositionRef.current = coordinator.update({
        clientX: currentDrag.clientX,
        clientY: currentDrag.clientY,
        sourceKind: currentDrag.sourceKind,
      });
    });
  }, [coordinator]);

  const onTimelineDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    delete event.currentTarget.dataset.dragOver;
    clearExternalDragState();
  }, [clearExternalDragState]);

  const onTimelineDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    const dropPosition = finalizeExternalDrop({
      event,
      coordinator,
      autoScrollerRef,
      externalDragFrameRef,
      latestExternalDragRef,
      latestExternalPositionRef,
    });
    await dispatchTimelineDrop({
      event,
      dataRef,
      pendingOpsRef,
      dropPosition,
      selectedTrackId,
      applyEdit,
      patchRegistry,
      uploadAsset,
      invalidateAssetRegistry,
      resolveAssetUrl,
      registerGenerationAsset,
      uploadImageGeneration,
      dropAsset,
      handleAddTextAt,
    });
  }, [
    applyEdit,
    coordinator,
    dataRef,
    dropAsset,
    invalidateAssetRegistry,
    pendingOpsRef,
    patchRegistry,
    registerGenerationAsset,
    resolveAssetUrl,
    selectedTrackId,
    handleAddTextAt,
    uploadAsset,
    uploadImageGeneration,
  ]);

  return {
    onTimelineDragOver,
    onTimelineDragLeave,
    onTimelineDrop,
  };
}
