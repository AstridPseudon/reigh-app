import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { TimelineAction, TimelineRow } from '@xzdarcy/timeline-engine';
import { useProjectSelectionContext } from '@/shared/contexts/ProjectContext';
import { getGenerationDropData, getDragType } from '@/shared/lib/dnd/dragDrop';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { uploadImageToStorage } from '@/shared/lib/media/imageUploader';
import { generateClientThumbnail, uploadImageWithThumbnail } from '@/shared/media/clientThumbnailGenerator';
import { createExternalUploadGeneration } from '@/integrations/supabase/repositories/generationMutationsRepository';
import { generateUUID } from '@/shared/lib/taskCreation/ids';
import {
  getVisualTracks,
  splitClipAtPlayhead,
  toggleClipMute,
  updateClipInConfig,
} from '@/tools/video-editor/lib/editor-utils';
import type { AssetRegistryEntry, ClipType, TrackKind } from '@/tools/video-editor/types';
import {
  buildRowTrackPatches,
  getCompatibleTrackId,
  rawRowIndexFromY,
  ROW_HEIGHT,
  TIMELINE_START_LEFT,
  updateClipOrder,
} from '@/tools/video-editor/lib/coordinate-utils';
import {
  getNextClipId,
  getSourceTime,
  inferTrackType,
  type ClipMeta,
  type TimelineData,
} from '@/tools/video-editor/lib/timeline-data';
import type { ActionDragState, UseTimelineDataResult } from '@/tools/video-editor/hooks/useTimelineData';

export interface UseTimelineEditingArgs {
  dataRef: React.MutableRefObject<TimelineData | null>;
  resolvedConfig: TimelineData['resolvedConfig'] | null;
  data: TimelineData | null;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  selectedTrack: UseTimelineDataResult['selectedTrack'];
  currentTime: number;
  scale: number;
  scaleWidth: number;
  crossTrackActive: React.MutableRefObject<boolean>;
  actionDragStateRef: React.MutableRefObject<Record<string, ActionDragState>>;
  resizeStartRef: React.MutableRefObject<Record<string, { start: number; from: number }>>;
  setSelectedClipId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedTrackId: React.Dispatch<React.SetStateAction<string | null>>;
  applyTimelineEdit: UseTimelineDataResult['applyTimelineEdit'];
  applyResolvedConfigEdit: UseTimelineDataResult['applyResolvedConfigEdit'];
  patchRegistry: UseTimelineDataResult['patchRegistry'];
  registerAsset: UseTimelineDataResult['registerAsset'];
  uploadAsset: UseTimelineDataResult['uploadAsset'];
  invalidateAssetRegistry: UseTimelineDataResult['invalidateAssetRegistry'];
  resolveAssetUrl: (file: string) => Promise<string>;
}

export interface UseTimelineEditingResult {
  onActionMoveStart: ({ action, row }: { action: TimelineAction; row: TimelineRow }) => void;
  onActionMoving: ({ action, row, start, end }: { action: TimelineAction; row: TimelineRow; start: number; end: number }) => boolean | undefined;
  onActionMoveEnd: ({ action }: { action: TimelineAction; row: TimelineRow; start: number; end: number }) => void;
  onActionResizeStart: ({ action }: { action: TimelineAction }) => void;
  onActionResizeEnd: ({ action, row }: { action: TimelineAction; row: TimelineRow; dir: string }) => void;
  onChange: (nextRows: TimelineRow[]) => boolean | undefined;
  onOverlayChange: (actionId: string, patch: Partial<ClipMeta>) => void;
  onTimelineDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onTimelineDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onTimelineDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  registerGenerationAsset: (data: ReturnType<typeof getGenerationDropData>) => string | null;
  handleAssetDrop: (assetKey: string, trackId: string | undefined, time: number) => void;
  handleDeleteClip: (clipId: string) => void;
  handleSelectedClipChange: (patch: Partial<ClipMeta> & { at?: number }) => void;
  handleResetClipPosition: () => void;
  handleSplitSelectedClip: () => void;
  handleSplitClipAtTime: (clipId: string, timeSeconds: number) => void;
  handleToggleMute: () => void;
  handleAddText: () => void;
  clearActionDragState: (clipId: string) => void;
}

export function useTimelineEditing({
  dataRef,
  resolvedConfig,
  data,
  selectedClipId,
  selectedTrackId,
  selectedTrack,
  currentTime,
  scale,
  scaleWidth,
  crossTrackActive,
  actionDragStateRef,
  resizeStartRef,
  setSelectedClipId,
  setSelectedTrackId,
  applyTimelineEdit,
  applyResolvedConfigEdit,
  patchRegistry,
  registerAsset,
  uploadAsset,
  invalidateAssetRegistry,
  resolveAssetUrl,
}: UseTimelineEditingArgs): UseTimelineEditingResult {
  const { selectedProjectId } = useProjectSelectionContext();
  const currentTimeRef = useRef(currentTime);
  const timelineDomCacheRef = useRef<{
    wrapper: HTMLDivElement | null;
    editArea: HTMLElement | null;
    grid: HTMLElement | null;
  }>({
    wrapper: null,
    editArea: null,
    grid: null,
  });
  const dragPreviewFrameRef = useRef<number | null>(null);
  const latestDragPreviewRef = useRef<{
    wrapper: HTMLDivElement;
    time: number;
    rowRect: { top: number; height: number };
    trackName: string;
    wrapperRect: DOMRect;
    pixelsPerSecond: number;
    isNewTrack?: boolean;
    isKindMismatch?: boolean;
  } | null>(null);
  const dropIndicatorRef = useRef<{
    root: HTMLDivElement;
    row: HTMLDivElement;
    line: HTMLDivElement;
    ghost: HTMLDivElement;
    ghostLabel: HTMLSpanElement;
    label: HTMLDivElement;
  } | null>(null);

  useLayoutEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const getTimelineDomNodes = useCallback((wrapper: HTMLDivElement) => {
    const cached = timelineDomCacheRef.current;
    if (
      cached.wrapper !== wrapper
      || !cached.editArea?.isConnected
      || !cached.grid?.isConnected
    ) {
      const editArea = wrapper.querySelector<HTMLElement>('.timeline-editor-edit-area');
      const grid = editArea?.querySelector<HTMLElement>('.ReactVirtualized__Grid')
        ?? wrapper.querySelector<HTMLElement>('.ReactVirtualized__Grid');
      timelineDomCacheRef.current = { wrapper, editArea, grid };
      return timelineDomCacheRef.current;
    }

    return cached;
  }, []);

  const ensureDropIndicator = useCallback(() => {
    if (dropIndicatorRef.current) {
      return dropIndicatorRef.current;
    }

    const root = document.createElement('div');
    root.dataset.dropIndicator = 'true';
    root.style.position = 'fixed';
    root.style.top = '0';
    root.style.left = '0';
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '99999';

    const row = document.createElement('div');
    row.className = 'drop-indicator-row';

    const line = document.createElement('div');
    line.className = 'drop-indicator-line';

    const ghost = document.createElement('div');
    ghost.className = 'drop-indicator-ghost';

    const ghostLabel = document.createElement('span');
    ghostLabel.className = 'drop-indicator-ghost-label';
    ghost.appendChild(ghostLabel);

    const label = document.createElement('div');
    label.className = 'drop-indicator-label';

    root.appendChild(row);
    root.appendChild(line);
    root.appendChild(ghost);
    root.appendChild(label);
    document.body.appendChild(root);

    dropIndicatorRef.current = { root, row, line, ghost, ghostLabel, label };
    return dropIndicatorRef.current;
  }, []);

  const clearDropIndicator = useCallback(() => {
    if (dragPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(dragPreviewFrameRef.current);
      dragPreviewFrameRef.current = null;
    }
    latestDragPreviewRef.current = null;
    dropIndicatorRef.current?.root.remove();
    dropIndicatorRef.current = null;
  }, []);

  const getDropPosition = useCallback((wrapper: HTMLDivElement, clientX: number, clientY: number) => {
    const { editArea, grid } = getTimelineDomNodes(wrapper);
    const rect = (editArea ?? wrapper).getBoundingClientRect();
    const scrollLeft = grid?.scrollLeft ?? 0;
    const scrollTop = grid?.scrollTop ?? 0;
    const pixelsPerSecond = scaleWidth / scale;
    const defaultClipDuration = 5;
    const halfClipPx = (defaultClipDuration * pixelsPerSecond) / 2;
    const dropX = clientX - rect.left;
    const time = Math.max(0, (dropX + scrollLeft - TIMELINE_START_LEFT - halfClipPx) / pixelsPerSecond);

    const editAreaRect = (editArea ?? wrapper).getBoundingClientRect();
    const rowCount = dataRef.current?.rows.length ?? 0;
    const raw = rawRowIndexFromY(clientY, editAreaRect.top, scrollTop, ROW_HEIGHT);
    // Allow rowIndex >= rowCount so external drops below all tracks can trigger new-track creation
    const rowIndex = raw >= rowCount ? rowCount : Math.min(raw, rowCount - 1);
    const clampedRow = Math.min(rowIndex, rowCount - 1);
    const rowScreenTop = editAreaRect.top + clampedRow * ROW_HEIGHT - scrollTop;
    const rowRect = { top: rowScreenTop, height: ROW_HEIGHT, left: editAreaRect.left, width: editAreaRect.width } as DOMRect;

    const trackId = clampedRow >= 0 ? dataRef.current?.rows[clampedRow]?.id : undefined;
    const trackKind = clampedRow >= 0 ? dataRef.current?.tracks[clampedRow]?.kind : undefined;
    const trackName = dataRef.current?.tracks[clampedRow]?.label ?? dataRef.current?.tracks[clampedRow]?.id ?? '';
    const isNewTrack = rowIndex >= rowCount;

    return { time, rowIndex, rowRect, trackId, trackKind, trackName, pixelsPerSecond, wrapperRect: wrapper.getBoundingClientRect(), isNewTrack };
  }, [dataRef, getTimelineDomNodes, scale, scaleWidth]);

  useEffect(() => {
    return () => {
      clearDropIndicator();
    };
  }, [clearDropIndicator]);

  const clearActionDragState = useCallback((clipId: string) => {
    delete actionDragStateRef.current[clipId];
  }, [actionDragStateRef]);

  const onActionMoveStart = useCallback(({ action, row }: { action: TimelineAction; row: TimelineRow }) => {
    if (action.id.startsWith('uploading-')) return;
    actionDragStateRef.current[action.id] = {
      rowId: row.id,
      initialStart: action.start,
      initialEnd: action.end,
      latestStart: action.start,
      latestEnd: action.end,
    };
  }, [actionDragStateRef]);

  const onActionMoving = useCallback(({ action, row, start, end }: {
    action: TimelineAction;
    row: TimelineRow;
    start: number;
    end: number;
  }) => {
    if (action.id.startsWith('uploading-')) return false;
    actionDragStateRef.current[action.id] = {
      rowId: row.id,
      initialStart: actionDragStateRef.current[action.id]?.initialStart ?? action.start,
      initialEnd: actionDragStateRef.current[action.id]?.initialEnd ?? action.end,
      latestStart: start,
      latestEnd: end,
    };

    if (crossTrackActive.current) {
      return false;
    }

    return undefined;
  }, [actionDragStateRef, crossTrackActive]);

  const onActionMoveEnd = useCallback(({ action }: { action: TimelineAction; row: TimelineRow; start: number; end: number }) => {
    if (!crossTrackActive.current) {
      clearActionDragState(action.id);
    }
  }, [clearActionDragState, crossTrackActive]);

  const onActionResizeStart = useCallback(({ action }: { action: TimelineAction }) => {
    if (action.id.startsWith('uploading-')) return;
    const clipMeta = dataRef.current?.meta[action.id];
    if (!clipMeta || typeof clipMeta.hold === 'number') {
      return;
    }

    resizeStartRef.current[action.id] = {
      start: action.start,
      from: clipMeta.from ?? 0,
    };
  }, [dataRef, resizeStartRef]);

  const onActionResizeEnd = useCallback(({ action, row }: { action: TimelineAction; row: TimelineRow; dir: string }) => {
    if (action.id.startsWith('uploading-')) return;
    const current = dataRef.current;
    const clipMeta = current?.meta[action.id];
    if (!current || !clipMeta) {
      return;
    }

    const metaUpdates: Record<string, Partial<ClipMeta>> = {
      ...buildRowTrackPatches(current.rows),
      [action.id]: {
        track: row.id,
      },
    };

    if (typeof clipMeta.hold !== 'number') {
      const origin = resizeStartRef.current[action.id];
      if (origin && action.start !== origin.start) {
        metaUpdates[action.id] = {
          ...metaUpdates[action.id],
          from: Math.max(0, origin.from + (action.start - origin.start) * (clipMeta.speed ?? 1)),
        };
      }

      metaUpdates[action.id] = {
        ...metaUpdates[action.id],
        to: getSourceTime(
          {
            from: clipMeta.from ?? 0,
            start: action.start,
            speed: clipMeta.speed ?? 1,
          },
          action.end,
        ),
      };
    }

    const nextRows = current.rows.map((entry) => {
      if (entry.id !== row.id) {
        return entry;
      }

      return {
        ...entry,
        actions: entry.actions.map((candidate) => {
          return candidate.id === action.id
            ? { ...candidate, start: action.start, end: action.end }
            : candidate;
        }),
      };
    });

    applyTimelineEdit(nextRows, metaUpdates);
    delete resizeStartRef.current[action.id];
  }, [applyTimelineEdit, dataRef, resizeStartRef]);

  const onChange = useCallback((nextRows: TimelineRow[]) => {
    if (crossTrackActive.current) {
      return false;
    }

    applyTimelineEdit(nextRows, buildRowTrackPatches(nextRows));
    return undefined;
  }, [applyTimelineEdit, crossTrackActive]);

  const onOverlayChange = useCallback((actionId: string, patch: Partial<ClipMeta>) => {
    const current = dataRef.current;
    if (!current) {
      return;
    }

    applyTimelineEdit(current.rows, { [actionId]: patch });
  }, [applyTimelineEdit, dataRef]);

  const registerGenerationAsset = useCallback((generationData: ReturnType<typeof getGenerationDropData>) => {
    if (!generationData) {
      return null;
    }

    const mimeType = (() => {
      const metadataContentType = typeof generationData.metadata?.content_type === 'string'
        ? generationData.metadata.content_type
        : null;
      if (metadataContentType?.includes('/')) {
        return metadataContentType;
      }
      if (metadataContentType === 'video' || generationData.variantType === 'video' || /\.(mp4|mov|webm|m4v)$/i.test(generationData.imageUrl)) {
        return 'video/mp4';
      }
      if (metadataContentType === 'audio' || /\.(mp3|wav|aac|m4a)$/i.test(generationData.imageUrl)) {
        return 'audio/mpeg';
      }
      return 'image/png';
    })();

    const assetId = generateUUID();
    const entry: AssetRegistryEntry = {
      file: generationData.imageUrl,
      type: mimeType,
      generationId: generationData.generationId,
      variantId: generationData.variantId,
    };

    patchRegistry(assetId, entry, generationData.imageUrl);
    void registerAsset(assetId, entry).catch((error) => {
      console.error('[video-editor] Failed to persist generation asset:', error);
    });

    return assetId;
  }, [patchRegistry, registerAsset]);

  const uploadImageGeneration = useCallback(async (file: File) => {
    if (!selectedProjectId) {
      throw new Error('External image drop requires a selected project');
    }

    let imageUrl = '';
    let thumbnailUrl = '';

    try {
      const thumbnailResult = await generateClientThumbnail(file, 300, 0.8);
      const uploadResult = await uploadImageWithThumbnail(file, thumbnailResult.thumbnailBlob);
      imageUrl = uploadResult.imageUrl;
      thumbnailUrl = uploadResult.thumbnailUrl;
    } catch (error) {
      normalizeAndPresentError(error, { context: `video-editor:external-drop:${file.name}`, showToast: false });
      imageUrl = await uploadImageToStorage(file, 3);
      thumbnailUrl = imageUrl;
    }

    const generation = await createExternalUploadGeneration({
      imageUrl,
      thumbnailUrl,
      fileType: 'image',
      projectId: selectedProjectId,
      generationParams: {
        prompt: `Uploaded ${file.name}`,
        extra: {
          source: 'external_upload',
          original_filename: file.name,
          file_type: file.type || 'image',
          file_size: file.size,
        },
      },
    });

    return {
      generationId: generation.id,
      variantType: 'image',
      imageUrl,
      thumbUrl: thumbnailUrl,
      metadata: {
        content_type: file.type || 'image',
        original_filename: file.name,
      },
    };
  }, [selectedProjectId]);

  const handleAssetDrop = useCallback((assetKey: string, trackId: string | undefined, time: number) => {
    const current = dataRef.current;
    if (!current) {
      return;
    }

    const assetEntry = current.registry.assets[assetKey];
    const assetKind = inferTrackType(assetEntry?.file ?? assetKey);
    const resolvedTrackId = getCompatibleTrackId(current.tracks, trackId, assetKind, selectedTrackId);
    if (!resolvedTrackId) {
      return;
    }

    const track = current.tracks.find((candidate) => candidate.id === resolvedTrackId);
    if (!track) {
      return;
    }

    const clipId = getNextClipId(current.meta);
    const isImage = assetEntry?.type?.startsWith('image');
    const isManual = track.fit === 'manual';
    const clipType: ClipType = isImage ? 'hold' : 'media';
    const baseDuration = Math.max(1, Math.min(assetEntry?.duration ?? 5, assetKind === 'audio' ? assetEntry?.duration ?? 10 : 5));

    let clipMeta: ClipMeta;
    let duration: number;

    if (track.kind === 'audio') {
      duration = assetEntry?.duration ?? 10;
      clipMeta = {
        asset: assetKey,
        track: resolvedTrackId,
        clipType: 'media',
        from: 0,
        to: duration,
        speed: 1,
        volume: 1,
      };
    } else if (isImage) {
      duration = 5;
      clipMeta = {
        asset: assetKey,
        track: resolvedTrackId,
        clipType,
        hold: duration,
        opacity: 1,
        x: isManual ? 100 : undefined,
        y: isManual ? 100 : undefined,
        width: isManual ? 320 : undefined,
        height: isManual ? 240 : undefined,
      };
    } else {
      duration = baseDuration;
      clipMeta = {
        asset: assetKey,
        track: resolvedTrackId,
        clipType,
        from: 0,
        to: duration,
        speed: 1,
        volume: 1,
        opacity: 1,
        x: isManual ? 100 : undefined,
        y: isManual ? 100 : undefined,
        width: isManual ? 320 : undefined,
        height: isManual ? 240 : undefined,
      };
    }

    const action: TimelineAction = {
      id: clipId,
      start: time,
      end: time + duration,
      effectId: `effect-${clipId}`,
    };

    const nextRows = current.rows.map((row) => (row.id === resolvedTrackId ? { ...row, actions: [...row.actions, action] } : row));
    const nextClipOrder = updateClipOrder(current.clipOrder, resolvedTrackId, (ids) => [...ids, clipId]);
    applyTimelineEdit(nextRows, { [clipId]: clipMeta }, undefined, nextClipOrder);
    setSelectedClipId(clipId);
    setSelectedTrackId(resolvedTrackId);
  }, [applyTimelineEdit, dataRef, selectedTrackId, setSelectedClipId, setSelectedTrackId]);

  const inferDragKind = useCallback((event: React.DragEvent<HTMLDivElement>): TrackKind | null => {
    const types = Array.from(event.dataTransfer.types);
    // Check encoded asset-kind:audio or asset-kind:visual from AssetPanel drag
    if (types.some((t) => t === 'asset-kind:audio')) return 'audio';
    if (types.some((t) => t === 'asset-kind:visual')) return 'visual';
    // Legacy fallback: plain asset-kind type exists but value not readable during dragover
    if (types.includes('asset-key')) return null; // can't determine — don't show reject
    // Generation drags are always visual
    if (getDragType(event) === 'generation') return 'visual';
    // File drags: check MIME types (readable during dragover)
    if (event.dataTransfer.items.length > 0) {
      for (let i = 0; i < event.dataTransfer.items.length; i++) {
        const item = event.dataTransfer.items[i];
        if (item.type.startsWith('audio/')) return 'audio';
      }
      return 'visual';
    }
    return null;
  }, []);

  const onTimelineDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const dragType = getDragType(event);
    const types = Array.from(event.dataTransfer.types);
    if (!types.includes('asset-key') && dragType !== 'file' && dragType !== 'generation') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const wrapper = event.currentTarget;
    wrapper.dataset.dragOver = 'true';

    const preview = getDropPosition(wrapper, event.clientX, event.clientY);
    const dragKind = inferDragKind(event);
    const isKindMismatch = dragKind !== null && preview.trackKind !== undefined && dragKind !== preview.trackKind && !preview.isNewTrack;
    latestDragPreviewRef.current = {
      wrapper,
      time: preview.time,
      rowRect: {
        top: preview.rowRect?.top ?? preview.wrapperRect.top,
        height: preview.rowRect?.height ?? 36,
      },
      trackName: preview.trackName,
      wrapperRect: preview.wrapperRect,
      pixelsPerSecond: preview.pixelsPerSecond,
      isNewTrack: preview.isNewTrack,
      isKindMismatch,
    };

    // Show/hide new-track affordance
    const { editArea } = getTimelineDomNodes(wrapper);
    if (preview.isNewTrack) {
      editArea?.classList.add('drop-target-new-track');
    } else {
      editArea?.classList.remove('drop-target-new-track');
    }

    if (dragPreviewFrameRef.current !== null) {
      return;
    }

    dragPreviewFrameRef.current = window.requestAnimationFrame(() => {
      dragPreviewFrameRef.current = null;
      const currentPreview = latestDragPreviewRef.current;
      if (!currentPreview) {
        return;
      }

      const { editArea: editAreaInner, grid } = getTimelineDomNodes(currentPreview.wrapper);
      const indicator = ensureDropIndicator();
      const editRect = (editAreaInner ?? currentPreview.wrapper).getBoundingClientRect();
      const scrollLeft = grid?.scrollLeft ?? 0;
      const clipScreenLeft = editRect.left + TIMELINE_START_LEFT + currentPreview.time * currentPreview.pixelsPerSecond - scrollLeft;
      const defaultDur = 5;
      const ghostWidth = Math.max(0, Math.min(defaultDur * currentPreview.pixelsPerSecond, currentPreview.wrapperRect.right - clipScreenLeft));
      const ghostCenter = clipScreenLeft + ghostWidth / 2;

      // Apply reject styling when kind doesn't match
      indicator.row.className = currentPreview.isKindMismatch
        ? 'drop-indicator-row drop-indicator-row--reject'
        : 'drop-indicator-row';

      indicator.row.style.left = `${currentPreview.wrapperRect.left}px`;
      indicator.row.style.top = `${currentPreview.rowRect.top}px`;
      indicator.row.style.width = `${currentPreview.wrapperRect.width}px`;
      indicator.row.style.height = `${currentPreview.rowRect.height}px`;

      // Hide position indicators for new-track drops (the CSS affordance is enough)
      if (currentPreview.isNewTrack) {
        indicator.line.style.display = 'none';
        indicator.ghost.style.display = 'none';
        indicator.label.style.display = 'none';
      } else {
        indicator.line.style.display = '';
        indicator.ghost.style.display = '';
        indicator.label.style.display = '';

        indicator.line.style.left = `${ghostCenter}px`;
        indicator.line.style.top = `${currentPreview.rowRect.top}px`;
        indicator.line.style.height = `${currentPreview.rowRect.height}px`;

        indicator.ghost.style.left = `${clipScreenLeft}px`;
        indicator.ghost.style.top = `${currentPreview.rowRect.top + 2}px`;
        indicator.ghost.style.width = `${ghostWidth}px`;
        indicator.ghost.style.height = `${Math.max(0, currentPreview.rowRect.height - 4)}px`;
        indicator.ghostLabel.textContent = `${currentPreview.time.toFixed(1)}s`;

        indicator.label.style.left = `${ghostCenter - 30}px`;
        indicator.label.style.top = `${currentPreview.rowRect.top - 16}px`;
        indicator.label.textContent = `${currentPreview.trackName} · ${currentPreview.time.toFixed(1)}s`;
      }
    });
  }, [ensureDropIndicator, getDropPosition, getTimelineDomNodes, inferDragKind]);

  const onTimelineDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    delete event.currentTarget.dataset.dragOver;
    const { editArea } = getTimelineDomNodes(event.currentTarget);
    editArea?.classList.remove('drop-target-new-track');
    clearDropIndicator();
  }, [clearDropIndicator, getTimelineDomNodes]);

  const onTimelineDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    delete event.currentTarget.dataset.dragOver;
    const { editArea: dropEditArea } = getTimelineDomNodes(event.currentTarget);
    dropEditArea?.classList.remove('drop-target-new-track');
    clearDropIndicator();

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0 && dataRef.current) {
      const { time, rowIndex } = getDropPosition(event.currentTarget, event.clientX, event.clientY);

      const defaultClipDuration = 5;
      let timeOffset = 0;

      for (const file of files) {
        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
        const kind: TrackKind = ['.mp3', '.wav', '.aac', '.m4a'].includes(ext) ? 'audio' : 'visual';
        const isImageFile = file.type.startsWith('image/')
          || ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif'].includes(ext);
        const targetTrackId = rowIndex >= 0 ? dataRef.current.rows[rowIndex]?.id : undefined;
        const compatibleTrackId = getCompatibleTrackId(dataRef.current.tracks, targetTrackId, kind, selectedTrackId);
        if (!compatibleTrackId) {
          continue;
        }

        const clipTime = time + timeOffset;
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
        applyTimelineEdit(nextRows, { [skeletonId]: skeletonMeta }, undefined, undefined, { save: false });

        void (async () => {
          try {
            if (isImageFile) {
              const generationData = await uploadImageGeneration(file);
              const current = dataRef.current!;
              const cleanRows = current.rows.map((row) => ({
                ...row,
                actions: row.actions.filter((action) => action.id !== skeletonId),
              }));
              applyTimelineEdit(cleanRows, undefined, [skeletonId]);
              const assetId = registerGenerationAsset(generationData);
              if (assetId) {
                handleAssetDrop(assetId, compatibleTrackId, clipTime);
              }
              return;
            }

            const result = await uploadAsset(file);
            const src = await resolveAssetUrl(result.entry.file);
            patchRegistry(result.assetId, result.entry, src);
            const current = dataRef.current!;
            const cleanRows = current.rows.map((row) => ({
              ...row,
              actions: row.actions.filter((action) => action.id !== skeletonId),
            }));
            applyTimelineEdit(cleanRows, undefined, [skeletonId]);
            handleAssetDrop(result.assetId, compatibleTrackId, clipTime);
            void invalidateAssetRegistry();
          } catch (error) {
            console.error('[drop] Upload failed:', error);
            const current = dataRef.current!;
            const cleanRows = current.rows.map((row) => ({
              ...row,
              actions: row.actions.filter((action) => action.id !== skeletonId),
            }));
            applyTimelineEdit(cleanRows, undefined, [skeletonId], undefined, { save: false });
          }
        })();
      }
      return;
    }

    const generationData = getGenerationDropData(event);
    if (generationData && dataRef.current) {
      const { time, rowIndex } = getDropPosition(event.currentTarget, event.clientX, event.clientY);
      const targetTrackId = rowIndex >= 0 ? dataRef.current.rows[rowIndex]?.id : undefined;
      const assetId = registerGenerationAsset(generationData);
      if (assetId) {
        handleAssetDrop(assetId, targetTrackId, time);
      }
      return;
    }

    const assetKey = event.dataTransfer.getData('asset-key');
    const assetKind = event.dataTransfer.getData('asset-kind') as TrackKind;
    if (!assetKey || !dataRef.current) {
      return;
    }

    const { time, rowIndex } = getDropPosition(event.currentTarget, event.clientX, event.clientY);
    const targetTrackId = rowIndex >= 0 ? dataRef.current.rows[rowIndex]?.id : undefined;
    const compatibleTrackId = getCompatibleTrackId(dataRef.current.tracks, targetTrackId, assetKind || 'visual', selectedTrackId);
    if (!compatibleTrackId) return;
    handleAssetDrop(assetKey, compatibleTrackId, time);
  }, [
    applyTimelineEdit,
    clearDropIndicator,
    dataRef,
    getDropPosition,
    getTimelineDomNodes,
    handleAssetDrop,
    invalidateAssetRegistry,
    patchRegistry,
    registerGenerationAsset,
    resolveAssetUrl,
    selectedTrackId,
    uploadAsset,
    uploadImageGeneration,
  ]);

  const handleDeleteClip = useCallback((clipId: string) => {
    if (clipId.startsWith('uploading-')) return;
    const current = dataRef.current;
    if (!current) {
      return;
    }

    const nextRows = current.rows.map((row) => ({
      ...row,
      actions: row.actions.filter((action) => action.id !== clipId),
    }));
    applyTimelineEdit(nextRows, undefined, [clipId]);
    if (selectedClipId === clipId) {
      setSelectedClipId(null);
    }
  }, [applyTimelineEdit, dataRef, selectedClipId, setSelectedClipId]);

  const handleSelectedClipChange = useCallback((patch: Partial<ClipMeta> & { at?: number }) => {
    const current = dataRef.current;
    if (!current || !selectedClipId) {
      return;
    }

    const clipRow = current.rows.find((row) => row.actions.some((action) => action.id === selectedClipId));
    if (!clipRow) {
      return;
    }

    const nextRows = current.rows.map((row) => {
      if (row.id !== clipRow.id || patch.at === undefined) {
        return row;
      }

      return {
        ...row,
        actions: row.actions.map((action) => {
          if (action.id !== selectedClipId) {
            return action;
          }

          const duration = action.end - action.start;
          return {
            ...action,
            start: patch.at,
            end: patch.at + duration,
          };
        }),
      };
    });

    const { at: _at, ...metaPatch } = patch;
    applyTimelineEdit(nextRows, { [selectedClipId]: metaPatch });
  }, [applyTimelineEdit, dataRef, selectedClipId]);

  const handleResetClipPosition = useCallback(() => {
    if (!selectedClipId || !resolvedConfig) {
      return;
    }

    const nextConfig = updateClipInConfig(resolvedConfig, selectedClipId, (clip) => ({
      ...clip,
      x: undefined,
      y: undefined,
      width: undefined,
      height: undefined,
      cropTop: undefined,
      cropBottom: undefined,
      cropLeft: undefined,
      cropRight: undefined,
    }));
    applyResolvedConfigEdit(nextConfig, { selectedClipId });
  }, [applyResolvedConfigEdit, resolvedConfig, selectedClipId]);

  const handleSplitSelectedClip = useCallback(() => {
    if (!selectedClipId || !resolvedConfig) {
      return;
    }

    const splitResult = splitClipAtPlayhead(resolvedConfig, selectedClipId, currentTimeRef.current);
    if (!splitResult.nextSelectedClipId) {
      return;
    }

    applyResolvedConfigEdit(splitResult.config, { selectedClipId: splitResult.nextSelectedClipId });
  }, [applyResolvedConfigEdit, resolvedConfig, selectedClipId]);

  const handleSplitClipAtTime = useCallback((clipId: string, timeSeconds: number) => {
    if (!resolvedConfig) {
      return;
    }

    const splitResult = splitClipAtPlayhead(resolvedConfig, clipId, timeSeconds);
    if (!splitResult.nextSelectedClipId) {
      return;
    }

    applyResolvedConfigEdit(splitResult.config, { selectedClipId: splitResult.nextSelectedClipId });
  }, [applyResolvedConfigEdit, resolvedConfig]);

  const handleToggleMute = useCallback(() => {
    if (!selectedClipId || !resolvedConfig) {
      return;
    }

    const nextConfig = toggleClipMute(resolvedConfig, selectedClipId);
    applyResolvedConfigEdit(nextConfig, { selectedClipId });
  }, [applyResolvedConfigEdit, resolvedConfig, selectedClipId]);

  const handleAddText = useCallback(() => {
    const current = dataRef.current;
    if (!current) {
      return;
    }

    const visualTrack = selectedTrack?.kind === 'visual'
      ? selectedTrack
      : getVisualTracks(current.resolvedConfig)[0];
    if (!visualTrack) {
      return;
    }

    const clipId = getNextClipId(current.meta);
    const action: TimelineAction = {
      id: clipId,
      start: currentTimeRef.current,
      end: currentTimeRef.current + 5,
      effectId: `effect-${clipId}`,
    };
    const nextRows = current.rows.map((row) => (
      row.id === visualTrack.id
        ? { ...row, actions: [...row.actions, action] }
        : row
    ));
    const nextClipOrder = updateClipOrder(current.clipOrder, visualTrack.id, (ids) => [...ids, clipId]);
    applyTimelineEdit(nextRows, {
      [clipId]: {
        track: visualTrack.id,
        clipType: 'text',
        text: {
          content: 'Double-click to edit',
          fontSize: 64,
          color: '#ffffff',
          align: 'center',
        },
        x: 120,
        y: 120,
        width: 640,
        height: 180,
        opacity: 1,
      },
    }, undefined, nextClipOrder);
    setSelectedClipId(clipId);
    setSelectedTrackId(visualTrack.id);
  }, [applyTimelineEdit, dataRef, selectedTrack, setSelectedClipId, setSelectedTrackId]);

  return {
    onActionMoveStart,
    onActionMoving,
    onActionMoveEnd,
    onActionResizeStart,
    onActionResizeEnd,
    onChange,
    onOverlayChange,
    onTimelineDragOver,
    onTimelineDragLeave,
    onTimelineDrop,
    registerGenerationAsset,
    handleAssetDrop,
    handleDeleteClip,
    handleSelectedClipChange,
    handleResetClipPosition,
    handleSplitSelectedClip,
    handleSplitClipAtTime,
    handleToggleMute,
    handleAddText,
    clearActionDragState,
  };
}
