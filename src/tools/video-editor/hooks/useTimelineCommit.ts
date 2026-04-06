import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { TimelineEventBus } from '@/tools/video-editor/hooks/useTimelineEventBus';
import { buildTrackClipOrder } from '@/tools/video-editor/lib/coordinate-utils';
import { migrateToFlatTracks } from '@/tools/video-editor/lib/migrate';
import { serializeForDisk } from '@/tools/video-editor/lib/serialize';
import { buildDataFromCurrentRegistry } from '@/tools/video-editor/lib/timeline-save-utils';
import {
  assembleTimelineData,
  preserveUploadingClips,
  rowsToConfig,
  type ClipMeta,
  type ClipOrderMap,
  type TimelineData,
} from '@/tools/video-editor/lib/timeline-data';
import type { TimelineAction, TimelineRow } from '@/tools/video-editor/types/timeline-canvas';
import type { AssetRegistryEntry } from '@/tools/video-editor/types';

export type CommitHistoryOptions = {
  transactionId?: string;
  semantic?: boolean;
};

export type CommitDataOptions = {
  save?: boolean;
  selectedClipId?: string | null;
  selectedTrackId?: string | null;
  updateLastSavedSignature?: boolean;
  transactionId?: string;
  semantic?: boolean;
  skipHistory?: boolean;
};

export type ScheduleSaveFn = (
  nextData: TimelineData,
  options?: { preserveStatus?: boolean },
) => void;

export type TimelineEditMutation =
  | {
      type: 'rows';
      rows: TimelineRow[];
      metaUpdates?: Record<string, Partial<ClipMeta>>;
      metaDeletes?: string[];
      clipOrderOverride?: ClipOrderMap;
      pinnedShotGroupsOverride?: TimelineData['config']['pinnedShotGroups'];
    }
  | {
      type: 'config';
      resolvedConfig: TimelineData['resolvedConfig'];
      pinnedShotGroupsOverride?: TimelineData['config']['pinnedShotGroups'];
    }
  | {
      type: 'pinnedShotGroups';
      pinnedShotGroups: NonNullable<TimelineData['config']['pinnedShotGroups']>;
    };

export type ApplyEditOptions = {
  save?: boolean;
  selectedClipId?: string | null;
  selectedTrackId?: string | null;
  transactionId?: string;
  semantic?: boolean;
};

interface UseTimelineCommitOptions {
  eventBus: TimelineEventBus;
  lastSavedSignatureRef: MutableRefObject<string>;
}

function collectClipIds(rows: TimelineRow[]): Set<string> {
  const clipIds = new Set<string>();
  for (const row of rows) {
    for (const action of row.actions) {
      if (!action.id.startsWith('uploading-')) {
        clipIds.add(action.id);
      }
    }
  }
  return clipIds;
}

function getSnapshotDuration(meta: NonNullable<TimelineData['config']['pinnedShotGroups']>[number]['imageClipSnapshot'][number]['meta']) {
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

  return 5;
}

function reconcilePinnedShotGroupsInRows({
  current,
  rows,
  meta,
  clipOrder,
}: {
  current: TimelineData;
  rows: TimelineRow[];
  meta: Record<string, ClipMeta>;
  clipOrder: ClipOrderMap;
}): {
  rows: TimelineRow[];
  meta: Record<string, ClipMeta>;
  clipOrder: ClipOrderMap;
  pinnedShotGroups: TimelineData['config']['pinnedShotGroups'];
} {
  const pinnedShotGroups = current.config.pinnedShotGroups;
  if (!pinnedShotGroups?.length) {
    return { rows, meta, clipOrder, pinnedShotGroups };
  }

  let nextRows = rows.map((row) => ({ ...row, actions: [...row.actions] }));
  const nextMeta = { ...meta };
  const nextClipOrder: ClipOrderMap = Object.fromEntries(
    Object.entries(clipOrder).map(([trackId, clipIds]) => [trackId, [...clipIds]]),
  );
  const nextGroups: NonNullable<TimelineData['config']['pinnedShotGroups']> = [];

  for (const group of pinnedShotGroups) {
    const liveClipIds = group.clipIds.filter((clipId) => collectClipIds(nextRows).has(clipId));

    if (group.mode !== 'video') {
      if (liveClipIds.length > 0) {
        nextGroups.push({ ...group, clipIds: liveClipIds });
      }
      continue;
    }

    if (liveClipIds.length > 0) {
      nextGroups.push({ ...group, clipIds: liveClipIds });
      continue;
    }

    if (!group.imageClipSnapshot?.length) {
      continue;
    }

    const previousRow = current.rows.find((row) => row.id === group.trackId);
    const deletedVideoClipId = group.clipIds[0];
    const deletedVideoActionIndex = previousRow?.actions.findIndex((action) => action.id === deletedVideoClipId) ?? -1;
    const deletedVideoAction = deletedVideoActionIndex >= 0
      ? previousRow?.actions[deletedVideoActionIndex]
      : undefined;
    const nextRowIndex = nextRows.findIndex((row) => row.id === group.trackId);
    if (!deletedVideoAction || nextRowIndex < 0) {
      continue;
    }

    const idsBeforeDeleted = (previousRow?.actions.slice(0, deletedVideoActionIndex) ?? [])
      .map((action) => action.id)
      .filter((clipId) => collectClipIds(nextRows).has(clipId));
    const insertionIndex = idsBeforeDeleted.length;

    const restoredClipIds: string[] = [];
    let cursor = deletedVideoAction.start;
    const restoredActions: TimelineAction[] = group.imageClipSnapshot.map((snapshot) => {
      const duration = getSnapshotDuration(snapshot.meta);
      const action: TimelineAction = {
        id: snapshot.clipId,
        start: cursor,
        end: cursor + duration,
        effectId: `effect-${snapshot.clipId}`,
      };
      cursor = action.end;
      restoredClipIds.push(snapshot.clipId);
      nextMeta[snapshot.clipId] = {
        ...snapshot.meta,
        asset: snapshot.assetKey,
        track: group.trackId,
      };
      return action;
    });

    nextRows = nextRows.map((row, rowIndex) => {
      if (rowIndex !== nextRowIndex) {
        return row;
      }
      return {
        ...row,
        actions: [
          ...row.actions.slice(0, insertionIndex),
          ...restoredActions,
          ...row.actions.slice(insertionIndex),
        ],
      };
    });

    const currentTrackClipOrder = nextClipOrder[group.trackId] ?? [];
    nextClipOrder[group.trackId] = [
      ...currentTrackClipOrder.slice(0, insertionIndex),
      ...restoredClipIds,
      ...currentTrackClipOrder.slice(insertionIndex),
    ];

    nextGroups.push({
      ...group,
      clipIds: restoredClipIds,
      mode: 'images',
      videoAssetKey: undefined,
    });
  }

  return {
    rows: nextRows,
    meta: nextMeta,
    clipOrder: nextClipOrder,
    pinnedShotGroups: nextGroups.length > 0 ? nextGroups : undefined,
  };
}

export interface UseTimelineCommitResult {
  data: TimelineData | null;
  dataRef: MutableRefObject<TimelineData | null>;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  setSelectedClipId: Dispatch<SetStateAction<string | null>>;
  setSelectedTrackId: Dispatch<SetStateAction<string | null>>;
  applyEdit: (mutation: TimelineEditMutation, options?: ApplyEditOptions) => void;
  patchRegistry: (assetId: string, entry: AssetRegistryEntry, src?: string) => void;
  commitData: (nextData: TimelineData, options?: CommitDataOptions) => void;
  materializeData: (
    current: TimelineData,
    rows: TimelineRow[],
    meta: Record<string, ClipMeta>,
    clipOrder: ClipOrderMap,
  ) => TimelineData;
  editSeqRef: MutableRefObject<number>;
  pendingOpsRef: MutableRefObject<number>;
  selectedClipIdRef: MutableRefObject<string | null>;
  selectedTrackIdRef: MutableRefObject<string | null>;
}

export function useTimelineCommit({
  eventBus,
  lastSavedSignatureRef,
}: UseTimelineCommitOptions): UseTimelineCommitResult {
  const editSeqRef = useRef(0);
  const pendingOpsRef = useRef(0);
  const dataRef = useRef<TimelineData | null>(null);
  const selectedClipIdRef = useRef<string | null>(null);
  const selectedTrackIdRef = useRef<string | null>(null);

  const [data, setData] = useState<TimelineData | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  useLayoutEffect(() => {
    dataRef.current = data;
    selectedClipIdRef.current = selectedClipId;
    selectedTrackIdRef.current = selectedTrackId;
  }, [data, selectedClipId, selectedTrackId]);

  const withPinnedShotGroups = useCallback((
    config: TimelineData['config'],
    pinnedShotGroups: TimelineData['config']['pinnedShotGroups'],
  ): TimelineData['config'] => ({
    ...config,
    pinnedShotGroups: pinnedShotGroups && pinnedShotGroups.length > 0
      ? pinnedShotGroups
      : undefined,
  }), []);

  const materializeData = useCallback((
    current: TimelineData,
    rows: TimelineRow[],
    meta: Record<string, ClipMeta>,
    clipOrder: ClipOrderMap,
  ) => {
    const reconciled = reconcilePinnedShotGroupsInRows({
      current,
      rows,
      meta,
      clipOrder,
    });
    const config = rowsToConfig(
      reconciled.rows,
      reconciled.meta,
      current.output,
      reconciled.clipOrder,
      current.tracks,
      current.config.customEffects,
      reconciled.pinnedShotGroups,
    );

    return preserveUploadingClips(
      { ...current, rows: reconciled.rows, meta: reconciled.meta } as TimelineData,
      buildDataFromCurrentRegistry(config, current),
    );
  }, []);

  const commitData = useCallback((
    nextData: TimelineData,
    options?: CommitDataOptions,
  ) => {
    const shouldSave = options?.save ?? true;
    const currentData = dataRef.current;

    if (shouldSave && !options?.skipHistory && currentData) {
      eventBus.emit('beforeCommit', currentData, {
        transactionId: options?.transactionId,
        semantic: options?.semantic,
      });
    }

    dataRef.current = nextData;
    setData(nextData);

    if (options?.selectedClipId !== undefined) {
      selectedClipIdRef.current = options.selectedClipId;
      setSelectedClipId(options.selectedClipId);
    } else if (selectedClipIdRef.current && !nextData.meta[selectedClipIdRef.current]) {
      selectedClipIdRef.current = null;
      setSelectedClipId(null);
    }

    eventBus.emit('pruneSelection', new Set(Object.keys(nextData.meta)));

    if (options?.selectedTrackId !== undefined) {
      selectedTrackIdRef.current = options.selectedTrackId;
      setSelectedTrackId(options.selectedTrackId);
    } else {
      const fallbackTrackId = selectedTrackIdRef.current
        && nextData.tracks.some((track) => track.id === selectedTrackIdRef.current)
        ? selectedTrackIdRef.current
        : nextData.tracks[0]?.id ?? null;
      selectedTrackIdRef.current = fallbackTrackId;
      setSelectedTrackId(fallbackTrackId);
    }

    if (options?.updateLastSavedSignature) {
      lastSavedSignatureRef.current = nextData.stableSignature;
    }

    if (shouldSave) {
      editSeqRef.current += 1;
      eventBus.emit('scheduleSave', nextData);
    }
  }, [eventBus, lastSavedSignatureRef]);

  const applyEdit = useCallback((
    mutation: TimelineEditMutation,
    options?: ApplyEditOptions,
  ) => {
    const current = dataRef.current;
    if (!current) {
      return;
    }

    if (mutation.type === 'pinnedShotGroups') {
      commitData(
        preserveUploadingClips(
          current,
          buildDataFromCurrentRegistry(
            withPinnedShotGroups(current.config, mutation.pinnedShotGroups),
            current,
          ),
        ),
        {
          save: options?.save,
          selectedClipId: options?.selectedClipId,
          selectedTrackId: options?.selectedTrackId,
          transactionId: options?.transactionId,
          semantic: options?.semantic,
        },
      );
      return;
    }

    if (mutation.type === 'rows') {
      const nextMeta: Record<string, ClipMeta> = { ...current.meta };

      if (mutation.metaUpdates) {
        for (const [clipId, patch] of Object.entries(mutation.metaUpdates)) {
          nextMeta[clipId] = nextMeta[clipId]
            ? { ...nextMeta[clipId], ...patch }
            : (patch as ClipMeta);
        }
      }

      if (mutation.metaDeletes) {
        for (const clipId of mutation.metaDeletes) {
          delete nextMeta[clipId];
        }
      }

      const baseNextData = materializeData(
        current,
        mutation.rows,
        nextMeta,
        mutation.clipOrderOverride ?? buildTrackClipOrder(current.tracks, current.clipOrder, mutation.metaDeletes),
      );
      const nextData = mutation.pinnedShotGroupsOverride === undefined
        ? baseNextData
        : preserveUploadingClips(
            { ...current, rows: mutation.rows, meta: nextMeta } as TimelineData,
            buildDataFromCurrentRegistry(
              withPinnedShotGroups(baseNextData.config, mutation.pinnedShotGroupsOverride),
              current,
            ),
          );

      commitData(
        nextData,
        {
          save: options?.save,
          transactionId: options?.transactionId,
          semantic: options?.semantic,
        },
      );
      return;
    }

    commitData(
      preserveUploadingClips(
        current,
        buildDataFromCurrentRegistry(
          serializeForDisk(
            mutation.resolvedConfig,
            current.config.customEffects,
            mutation.pinnedShotGroupsOverride ?? current.config.pinnedShotGroups,
          ),
          current,
        ),
      ),
      {
        save: options?.save,
        selectedClipId: options?.selectedClipId,
        selectedTrackId: options?.selectedTrackId,
        transactionId: options?.transactionId,
        semantic: options?.semantic,
      },
    );
  }, [commitData, materializeData, withPinnedShotGroups]);

  const patchRegistry = useCallback((assetId: string, entry: AssetRegistryEntry, src?: string) => {
    const current = dataRef.current;
    if (!current) {
      return;
    }

    const nextRegistry = {
      ...current.registry,
      assets: {
        ...current.registry.assets,
        [assetId]: entry,
      },
    };
    const nextResolvedRegistry = {
      ...current.resolvedConfig.registry,
      [assetId]: {
        ...entry,
        src: src ?? current.resolvedConfig.registry[assetId]?.src ?? entry.file,
      },
    };
    const nextConfig = {
      ...current.config,
      customEffects: current.config.customEffects
        ? { ...current.config.customEffects }
        : undefined,
    };
    const migratedConfig = migrateToFlatTracks(nextConfig);
    migratedConfig.tracks = migratedConfig.tracks ?? [];

    const nextData = assembleTimelineData({
      config: migratedConfig,
      configVersion: current.configVersion,
      registry: nextRegistry,
      resolvedConfig: {
        output: { ...migratedConfig.output },
        tracks: migratedConfig.tracks,
        clips: migratedConfig.clips.map((clip) => ({
          ...clip,
          assetEntry: clip.asset ? nextResolvedRegistry[clip.asset] : undefined,
        })),
        // Reuse resolved entries for unchanged assets and patch the current asset in-place.
        registry: nextResolvedRegistry,
      },
      assetMap: Object.fromEntries(
        Object.entries(nextRegistry.assets ?? {}).map(([nextAssetId, nextEntry]) => [nextAssetId, nextEntry.file]),
      ),
      output: { ...migratedConfig.output },
    });

    commitData(nextData, {
      save: false,
      selectedClipId: selectedClipIdRef.current,
      selectedTrackId: selectedTrackIdRef.current,
    });
  }, [commitData]);

  return {
    data,
    dataRef,
    selectedClipId,
    selectedTrackId,
    setSelectedClipId,
    setSelectedTrackId,
    applyEdit,
    patchRegistry,
    commitData,
    materializeData,
    editSeqRef,
    pendingOpsRef,
    selectedClipIdRef,
    selectedTrackIdRef,
  };
}
