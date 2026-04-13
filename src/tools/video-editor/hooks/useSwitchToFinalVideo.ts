import { useCallback } from 'react';
import { toast } from '@/shared/components/ui/runtime/sonner';
import { generateUUID } from '@/shared/lib/taskCreation/ids';
import {
  buildSwitchShotGroupToFinalVideoMutation,
  buildSwitchShotGroupToImagesMutation,
  buildUpdateShotGroupToLatestVideoMutation,
} from '@/tools/video-editor/lib/shot-group-commands';
import type {
  TimelineApplyEdit,
  TimelineDataRef,
  TimelinePatchRegistry,
  TimelineRegisterAsset,
  TimelineUnpatchRegistry,
} from '@/tools/video-editor/hooks/timeline-state-types';
import type { ShotFinalVideo } from '@/tools/video-editor/hooks/useFinalVideoAvailable';
import type { AssetRegistryEntry } from '@/tools/video-editor/types';

interface UseSwitchToFinalVideoArgs {
  applyEdit: TimelineApplyEdit;
  dataRef: TimelineDataRef;
  finalVideoMap: Map<string, ShotFinalVideo>;
  patchRegistry: TimelinePatchRegistry;
  unpatchRegistry: TimelineUnpatchRegistry;
  registerAsset: TimelineRegisterAsset;
}

function registerFinalVideoAsset(
  finalVideo: ShotFinalVideo,
  patchRegistry: TimelinePatchRegistry,
  registerAsset: TimelineRegisterAsset,
): { assetKey: string; persistPromise: Promise<void> } {
  const assetKey = generateUUID();
  const assetEntry: AssetRegistryEntry = {
    file: finalVideo.location,
    type: 'video/mp4',
    generationId: finalVideo.id,
    ...(finalVideo.thumbnailUrl ? { thumbnailUrl: finalVideo.thumbnailUrl } : {}),
  };
  patchRegistry(assetKey, assetEntry, finalVideo.location);
  return {
    assetKey,
    persistPromise: registerAsset(assetKey, assetEntry),
  };
}

function buildRestoreShotGroupVideoMutation({
  currentData,
  shotId,
  rowId,
  assetKey,
  targetGenerationId,
}: {
  currentData: TimelineDataRef['current'];
  shotId: string;
  rowId: string;
  assetKey: string;
  targetGenerationId?: string;
}) {
  if (targetGenerationId) {
    const rollbackMutation = buildUpdateShotGroupToLatestVideoMutation({
      currentData,
      shotId,
      rowId,
      assetKey,
      targetGenerationId,
    });
    if (rollbackMutation) {
      return rollbackMutation;
    }
  }

  if (!currentData) {
    return null;
  }

  const pinnedShotGroups = currentData.config.pinnedShotGroups ?? [];
  const pinnedGroup = pinnedShotGroups.find((group) => (
    group.shotId === shotId
    && group.trackId === rowId
    && group.mode === 'video'
    && typeof group.videoAssetKey === 'string'
    && group.videoAssetKey.length > 0
  ));
  const videoClipId = pinnedGroup?.clipIds[0];
  const hasVideoClip = Boolean(
    videoClipId
    && currentData.rows.find((row) => row.id === rowId)?.actions.some((action) => action.id === videoClipId)
    && currentData.meta[videoClipId],
  );
  if (!pinnedGroup || !videoClipId || !hasVideoClip) {
    return null;
  }

  return {
    type: 'rows' as const,
    rows: currentData.rows,
    metaUpdates: {
      [videoClipId]: {
        asset: assetKey,
      },
    },
    pinnedShotGroupsOverride: pinnedShotGroups.map((group) => (
      group.shotId === shotId && group.trackId === rowId
        ? { ...group, videoAssetKey: assetKey }
        : group
    )),
  };
}

export function useSwitchToFinalVideo({
  applyEdit,
  dataRef,
  finalVideoMap,
  patchRegistry,
  unpatchRegistry,
  registerAsset,
}: UseSwitchToFinalVideoArgs) {
  const switchToFinalVideo = useCallback(({ shotId, clipIds, rowId }: { shotId: string; clipIds: string[]; rowId: string }) => {
    const finalVideo = finalVideoMap.get(shotId);
    if (!finalVideo) {
      return;
    }

    const { assetKey, persistPromise } = registerFinalVideoAsset(finalVideo, patchRegistry, registerAsset);
    const mutation = buildSwitchShotGroupToFinalVideoMutation({
      currentData: dataRef.current,
      shotId,
      rowId,
      clipIds,
      assetKey,
    });
    if (!mutation) {
      void persistPromise.catch((error) => {
        console.error('[TimelineEditor] Failed to persist final video asset:', error);
        unpatchRegistry(assetKey);
        toast.error('Failed to save asset');
      });
      return;
    }

    applyEdit(mutation);
    void persistPromise.catch((error) => {
      console.error('[TimelineEditor] Failed to persist final video asset:', error);
      const rollbackMutation = buildSwitchShotGroupToImagesMutation({
        currentData: dataRef.current,
        shotId,
        rowId,
      });
      if (rollbackMutation) {
        applyEdit(rollbackMutation);
      }
      unpatchRegistry(assetKey);
      toast.error('Failed to save asset');
    });
  }, [applyEdit, dataRef, finalVideoMap, patchRegistry, registerAsset, unpatchRegistry]);

  const updateToLatestVideo = useCallback(({ shotId, rowId }: { shotId: string; rowId: string }) => {
    const finalVideo = finalVideoMap.get(shotId);
    if (!finalVideo) {
      return;
    }

    const oldVideoAssetKey = dataRef.current?.config.pinnedShotGroups?.find((group) => (
      group.shotId === shotId
      && group.trackId === rowId
      && group.mode === 'video'
    ))?.videoAssetKey;
    const oldVideoGenerationId = oldVideoAssetKey
      ? dataRef.current?.registry.assets[oldVideoAssetKey]?.generationId
      : undefined;
    const { assetKey, persistPromise } = registerFinalVideoAsset(finalVideo, patchRegistry, registerAsset);
    const mutation = buildUpdateShotGroupToLatestVideoMutation({
      currentData: dataRef.current,
      shotId,
      rowId,
      assetKey,
      targetGenerationId: finalVideo.id,
    });
    if (!mutation) {
      void persistPromise.catch((error) => {
        console.error('[TimelineEditor] Failed to persist final video asset:', error);
        unpatchRegistry(assetKey);
        toast.error('Failed to save asset');
      });
      return;
    }

    applyEdit(mutation);
    void persistPromise.catch((error) => {
      console.error('[TimelineEditor] Failed to persist final video asset:', error);
      const rollbackMutation = oldVideoAssetKey
        ? buildRestoreShotGroupVideoMutation({
            currentData: dataRef.current,
            shotId,
            rowId,
            assetKey: oldVideoAssetKey,
            targetGenerationId: oldVideoGenerationId,
          })
        : null;
      if (rollbackMutation) {
        applyEdit(rollbackMutation);
      }
      unpatchRegistry(assetKey);
      toast.error('Failed to save asset');
    });
  }, [applyEdit, dataRef, finalVideoMap, patchRegistry, registerAsset, unpatchRegistry]);

  const switchToImages = useCallback(({ shotId, rowId }: { shotId: string; rowId: string }) => {
    const mutation = buildSwitchShotGroupToImagesMutation({
      currentData: dataRef.current,
      shotId,
      rowId,
    });
    if (!mutation) {
      return;
    }

    applyEdit(mutation);
  }, [applyEdit, dataRef]);

  return {
    switchToFinalVideo,
    updateToLatestVideo,
    switchToImages,
  };
}
