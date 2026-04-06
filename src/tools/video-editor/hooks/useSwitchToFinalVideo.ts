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
import type { AssetRegistryEntry } from '@/tools/video-editor/types';
import type { TimelineAction } from '@/tools/video-editor/types/timeline-canvas';

interface UseSwitchToFinalVideoArgs {
  applyEdit: TimelineApplyEdit;
  dataRef: TimelineDataRef;
  finalVideoMap: Map<string, ShotFinalVideo>;
  patchRegistry: TimelinePatchRegistry;
  registerAsset: TimelineRegisterAsset;
}

export function useSwitchToFinalVideo({
  applyEdit,
  dataRef,
  finalVideoMap,
  patchRegistry,
  registerAsset,
}: UseSwitchToFinalVideoArgs) {
  return useCallback(({ shotId, clipIds, rowId }: { shotId: string; clipIds: string[]; rowId: string }) => {
    const finalVideo = finalVideoMap.get(shotId);
    const current = dataRef.current;
    if (!finalVideo || !current || clipIds.length === 0 || !current.rows.some((row) => row.id === rowId)) {
      return;
    }

    const clipIdSet = new Set(clipIds);
    let startTime = Number.POSITIVE_INFINITY;
    let endTime = Number.NEGATIVE_INFINITY;
    let matchedClipCount = 0;
    for (const row of current.rows) {
      for (const action of row.actions) {
        if (clipIdSet.has(action.id)) {
          startTime = Math.min(startTime, action.start);
          endTime = Math.max(endTime, action.end);
          matchedClipCount += 1;
        }
      }
    }
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || matchedClipCount !== clipIdSet.size || endTime <= startTime) {
      return;
    }

    const assetKey = generateUUID();
    const assetEntry: AssetRegistryEntry = { file: finalVideo.location, type: 'video/mp4', generationId: finalVideo.id };
    patchRegistry(assetKey, assetEntry, finalVideo.location);
    void registerAsset(assetKey, assetEntry).catch((error) => {
      console.error('[TimelineEditor] Failed to persist final video asset:', error);
    });

    const clipId = getNextClipId(current.meta);
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
    const videoAction: TimelineAction = { id: clipId, start: startTime, end: endTime, effectId: `effect-${clipId}` };

    const nextRows = current.rows.map((row) => {
      const remainingActions = row.actions.filter((action) => !clipIdSet.has(action.id));
      if (row.id !== rowId) {
        return remainingActions.length === row.actions.length ? row : { ...row, actions: remainingActions };
      }
      const insertionIndex = row.actions.findIndex((action) => clipIdSet.has(action.id));
      const nextActions = insertionIndex < 0
        ? [...remainingActions, videoAction]
        : [...remainingActions.slice(0, insertionIndex), videoAction, ...remainingActions.slice(insertionIndex)];
      return { ...row, actions: nextActions };
    });
    const nextClipOrder = updateClipOrder(current.clipOrder, rowId, (ids) => {
      const filtered = ids.filter((id) => !clipIdSet.has(id));
      const insertionIndex = ids.findIndex((id) => clipIdSet.has(id));
      return insertionIndex < 0
        ? [...filtered, clipId]
        : [...filtered.slice(0, insertionIndex), clipId, ...filtered.slice(insertionIndex)];
    });

    applyEdit({
      type: 'rows',
      rows: nextRows,
      metaUpdates: { [clipId]: videoMeta },
      metaDeletes: clipIds,
      clipOrderOverride: nextClipOrder,
    });
  }, [applyEdit, dataRef, finalVideoMap, patchRegistry, registerAsset]);
}
