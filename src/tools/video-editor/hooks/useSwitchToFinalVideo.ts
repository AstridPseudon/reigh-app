import { useCallback } from 'react';
import { generateUUID } from '@/shared/lib/taskCreation/ids';
import { updateClipOrder } from '@/tools/video-editor/lib/coordinate-utils';
import { getNextClipId, type ClipMeta } from '@/tools/video-editor/lib/timeline-data';
import type {
  TimelineApplyEdit,
  TimelineDataRef,
  TimelinePatchRegistry,
  TimelineRegisterAsset,
} from '@/tools/video-editor/hooks/timeline-state-types';
import type { ShotFinalVideo } from '@/tools/video-editor/hooks/useFinalVideoAvailable';
import type { AssetRegistryEntry, PinnedShotGroup, PinnedShotImageClipSnapshot, TimelineConfig } from '@/tools/video-editor/types';
import type { TimelineAction } from '@/tools/video-editor/types/timeline-canvas';

interface UseSwitchToFinalVideoArgs {
  applyEdit: TimelineApplyEdit;
  dataRef: TimelineDataRef;
  finalVideoMap: Map<string, ShotFinalVideo>;
  patchRegistry: TimelinePatchRegistry;
  registerAsset: TimelineRegisterAsset;
}

function getClipDuration(meta: ClipMeta, action: TimelineAction): number {
  if (typeof meta.hold === 'number' && Number.isFinite(meta.hold) && meta.hold > 0) {
    return meta.hold;
  }

  if (
    typeof meta.from === 'number'
    && typeof meta.to === 'number'
    && Number.isFinite(meta.from)
    && Number.isFinite(meta.to)
    && meta.to > meta.from
  ) {
    return Math.max(0.05, (meta.to - meta.from) / Math.max(meta.speed ?? 1, 0.01));
  }

  return Math.max(0.05, action.end - action.start);
}

function snapshotClipMeta(meta: ClipMeta): PinnedShotImageClipSnapshot['meta'] {
  return {
    clipType: meta.clipType,
    from: meta.from,
    to: meta.to,
    speed: meta.speed,
    hold: meta.hold,
    volume: meta.volume,
    x: meta.x,
    y: meta.y,
    width: meta.width,
    height: meta.height,
    cropTop: meta.cropTop,
    cropBottom: meta.cropBottom,
    cropLeft: meta.cropLeft,
    cropRight: meta.cropRight,
    opacity: meta.opacity,
    text: meta.text,
    entrance: meta.entrance,
    exit: meta.exit,
    continuous: meta.continuous,
    transition: meta.transition,
    effects: meta.effects,
  };
}

function updatePinnedGroup({
  config,
  shotId,
  trackId,
  clipIds,
  mode,
  videoAssetKey,
  imageClipSnapshot,
}: {
  config: Pick<TimelineConfig, 'pinnedShotGroups'>;
  shotId: string;
  trackId: string;
  clipIds: string[];
  mode: PinnedShotGroup['mode'];
  videoAssetKey?: string;
  imageClipSnapshot?: PinnedShotGroup['imageClipSnapshot'];
}) {
  const pinnedShotGroups = config.pinnedShotGroups ?? [];
  const nextGroup: PinnedShotGroup = {
    shotId,
    trackId,
    clipIds: [...clipIds],
    mode,
    ...(videoAssetKey ? { videoAssetKey } : {}),
    ...(imageClipSnapshot ? {
      imageClipSnapshot: imageClipSnapshot.map((snapshot) => ({
        ...snapshot,
        meta: { ...snapshot.meta },
      })),
    } : {}),
  };

  const existingIndex = pinnedShotGroups.findIndex((group) => (
    group.shotId === shotId
    && group.trackId === trackId
  ));

  if (existingIndex < 0) {
    return [...pinnedShotGroups, nextGroup];
  }

  return pinnedShotGroups.map((group, index) => (index === existingIndex ? nextGroup : group));
}

function registerFinalVideoAsset(
  finalVideo: ShotFinalVideo,
  patchRegistry: TimelinePatchRegistry,
  registerAsset: TimelineRegisterAsset,
): string {
  const assetKey = generateUUID();
  const assetEntry: AssetRegistryEntry = {
    file: finalVideo.location,
    type: 'video/mp4',
    generationId: finalVideo.id,
  };
  patchRegistry(assetKey, assetEntry, finalVideo.location);
  void registerAsset(assetKey, assetEntry).catch((error) => {
    console.error('[TimelineEditor] Failed to persist final video asset:', error);
  });
  return assetKey;
}

export function useSwitchToFinalVideo({
  applyEdit,
  dataRef,
  finalVideoMap,
  patchRegistry,
  registerAsset,
}: UseSwitchToFinalVideoArgs) {
  const switchToFinalVideo = useCallback(({ shotId, clipIds, rowId }: { shotId: string; clipIds: string[]; rowId: string }) => {
    const finalVideo = finalVideoMap.get(shotId);
    const current = dataRef.current;
    if (!finalVideo || !current || clipIds.length === 0 || !current.rows.some((row) => row.id === rowId)) {
      return;
    }

    const existingPinnedGroups = current.config.pinnedShotGroups ?? [];
    const pinnedGroup = existingPinnedGroups.find((group) => group.shotId === shotId && group.trackId === rowId);
    const sourceClipIds = pinnedGroup?.mode === 'images'
      ? pinnedGroup.clipIds
      : clipIds;
    const clipIdSet = new Set(sourceClipIds);
    const targetRow = current.rows.find((row) => row.id === rowId);
    if (!targetRow) {
      return;
    }

    const imageActions = targetRow.actions.filter((action) => clipIdSet.has(action.id));
    if (imageActions.length !== sourceClipIds.length) {
      return;
    }

    const startTime = Math.min(...imageActions.map((action) => action.start));
    const endTime = Math.max(...imageActions.map((action) => action.end));
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
      return;
    }
    const groupStart = startTime;

    const imageClipSnapshot = sourceClipIds.flatMap((sourceClipId) => {
      const sourceMeta = current.meta[sourceClipId];
      const sourceAction = imageActions.find((action) => action.id === sourceClipId);
      if (!sourceMeta) {
        return [];
      }
      if (!sourceAction) {
        return [];
      }

      return [{
        clipId: sourceClipId,
        assetKey: sourceMeta.asset,
        start: sourceAction.start,
        end: sourceAction.end,
        meta: snapshotClipMeta(sourceMeta),
      }];
    });
    if (imageClipSnapshot.length !== sourceClipIds.length) {
      return;
    }

    const assetKey = registerFinalVideoAsset(finalVideo, patchRegistry, registerAsset);

    const videoClipId = getNextClipId(current.meta);
    const targetTrack = current.tracks.find((track) => track.id === rowId);
    const isManualVisualTrack = targetTrack?.kind === 'visual' && targetTrack.fit === 'manual';
    const videoMeta: ClipMeta = {
      asset: assetKey,
      track: rowId,
      clipType: 'media',
      from: 0,
      to: endTime - startTime,
      speed: 1,
      volume: 1,
      opacity: 1,
      x: isManualVisualTrack ? 100 : undefined,
      y: isManualVisualTrack ? 100 : undefined,
      width: isManualVisualTrack ? 320 : undefined,
      height: isManualVisualTrack ? 240 : undefined,
    };
    const videoAction: TimelineAction = {
      id: videoClipId,
      start: groupStart,
      end: groupStart + (endTime - startTime),
      effectId: `effect-${videoClipId}`,
    };

    const insertionIndex = targetRow.actions.findIndex((action) => clipIdSet.has(action.id));
    const nextRows = current.rows.map((row) => {
      const remainingActions = row.actions.filter((action) => !clipIdSet.has(action.id));
      if (row.id !== rowId) {
        return remainingActions.length === row.actions.length ? row : { ...row, actions: remainingActions };
      }

      const nextActions = insertionIndex < 0
        ? [...remainingActions, videoAction]
        : [...remainingActions.slice(0, insertionIndex), videoAction, ...remainingActions.slice(insertionIndex)];
      return { ...row, actions: nextActions };
    });
    const nextClipOrder = updateClipOrder(current.clipOrder, rowId, (ids) => {
      const filtered = ids.filter((id) => !clipIdSet.has(id));
      const orderInsertionIndex = ids.findIndex((id) => clipIdSet.has(id));
      return orderInsertionIndex < 0
        ? [...filtered, videoClipId]
        : [...filtered.slice(0, orderInsertionIndex), videoClipId, ...filtered.slice(orderInsertionIndex)];
    });

    const nextPinnedShotGroups = updatePinnedGroup({
      config: current.config,
      shotId,
      trackId: rowId,
      clipIds: [videoClipId],
      mode: 'video',
      videoAssetKey: assetKey,
      imageClipSnapshot,
    });

    applyEdit({
      type: 'rows',
      rows: nextRows,
      metaUpdates: { [videoClipId]: videoMeta },
      metaDeletes: sourceClipIds,
      clipOrderOverride: nextClipOrder,
      pinnedShotGroupsOverride: nextPinnedShotGroups,
    });
  }, [applyEdit, dataRef, finalVideoMap, patchRegistry, registerAsset]);

  const updateToLatestVideo = useCallback(({ shotId, rowId }: { shotId: string; rowId: string }) => {
    const current = dataRef.current;
    const finalVideo = finalVideoMap.get(shotId);
    if (!current || !finalVideo) {
      return;
    }

    const existingPinnedGroups = current.config.pinnedShotGroups ?? [];
    const pinnedGroup = existingPinnedGroups.find((group) => (
      group.shotId === shotId
      && group.trackId === rowId
      && group.mode === 'video'
      && typeof group.videoAssetKey === 'string'
      && group.videoAssetKey.length > 0
    ));
    const videoClipId = pinnedGroup?.clipIds[0];
    const targetRow = current.rows.find((row) => row.id === rowId);
    const videoAction = videoClipId ? targetRow?.actions.find((action) => action.id === videoClipId) : undefined;
    const videoMeta = videoClipId ? current.meta[videoClipId] : undefined;
    const currentGenerationId = pinnedGroup?.videoAssetKey
      ? current.registry.assets[pinnedGroup.videoAssetKey]?.generationId
      : undefined;
    if (!pinnedGroup || !videoClipId || !videoAction || !videoMeta || currentGenerationId === finalVideo.id) {
      return;
    }

    const assetKey = registerFinalVideoAsset(finalVideo, patchRegistry, registerAsset);
    const nextPinnedShotGroups = existingPinnedGroups.map((group) => (
      group.shotId === shotId && group.trackId === rowId
        ? { ...group, videoAssetKey: assetKey }
        : group
    ));

    applyEdit({
      type: 'rows',
      rows: current.rows,
      metaUpdates: {
        [videoClipId]: {
          asset: assetKey,
        },
      },
      pinnedShotGroupsOverride: nextPinnedShotGroups,
    });
  }, [applyEdit, dataRef, finalVideoMap, patchRegistry, registerAsset]);

  const switchToImages = useCallback(({ shotId, rowId }: { shotId: string; rowId: string }) => {
    const current = dataRef.current;
    if (!current) {
      return;
    }

    const existingPinnedGroups = current.config.pinnedShotGroups ?? [];
    const pinnedGroup = existingPinnedGroups.find((group) => (
      group.shotId === shotId
      && group.trackId === rowId
      && group.mode === 'video'
    ));
    const targetRow = current.rows.find((row) => row.id === rowId);
    const videoClipId = pinnedGroup?.clipIds[0];
    const videoActionIndex = targetRow?.actions.findIndex((action) => action.id === videoClipId) ?? -1;
    const videoAction = videoActionIndex >= 0 ? targetRow?.actions[videoActionIndex] : undefined;
    if (!pinnedGroup || !targetRow || !videoClipId || !videoAction || !pinnedGroup.imageClipSnapshot?.length) {
      return;
    }

    const restoredMetaUpdates: Record<string, ClipMeta> = {};
    let cursor = videoAction.start;
    const restoredActions = pinnedGroup.imageClipSnapshot.map((snapshot) => {
      const clipMeta: ClipMeta = {
        ...snapshot.meta,
        asset: snapshot.assetKey,
        track: rowId,
      };
      restoredMetaUpdates[snapshot.clipId] = clipMeta;
      const duration = getClipDuration(clipMeta, videoAction);
      const start = typeof snapshot.start === 'number' ? snapshot.start : cursor;
      const end = typeof snapshot.end === 'number' ? snapshot.end : start + duration;
      cursor = end;

      return {
        id: snapshot.clipId,
        start,
        end,
        effectId: `effect-${snapshot.clipId}`,
      };
    });
    const orderedRestoredActions = [...restoredActions].sort((left, right) => {
      if (left.start !== right.start) {
        return left.start - right.start;
      }
      return left.id.localeCompare(right.id);
    });
    const restoredClipIds = orderedRestoredActions.map((action) => action.id);
    const nextPinnedShotGroups = updatePinnedGroup({
      config: current.config,
      shotId,
      trackId: rowId,
      clipIds: restoredClipIds,
      mode: 'images',
      imageClipSnapshot: pinnedGroup.imageClipSnapshot,
    });

    const nextRows = current.rows.map((row) => {
      if (row.id !== rowId) {
        return row;
      }

      const remainingActions = row.actions.filter((action) => action.id !== videoClipId);
      return {
        ...row,
        actions: [
          ...remainingActions.slice(0, videoActionIndex),
          ...orderedRestoredActions,
          ...remainingActions.slice(videoActionIndex),
        ],
      };
    });
    const nextClipOrder = updateClipOrder(current.clipOrder, rowId, (ids) => {
      const filtered = ids.filter((id) => id !== videoClipId);
      const insertionIndex = ids.indexOf(videoClipId);
      return insertionIndex < 0
        ? [...filtered, ...restoredClipIds]
        : [...filtered.slice(0, insertionIndex), ...restoredClipIds, ...filtered.slice(insertionIndex)];
    });

    applyEdit({
      type: 'rows',
      rows: nextRows,
      metaUpdates: restoredMetaUpdates,
      metaDeletes: [videoClipId],
      clipOrderOverride: nextClipOrder,
      pinnedShotGroupsOverride: nextPinnedShotGroups,
    });
  }, [applyEdit, dataRef]);

  return {
    switchToFinalVideo,
    updateToLatestVideo,
    switchToImages,
  };
}
