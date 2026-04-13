import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ShotGroup } from '@/tools/video-editor/hooks/useShotGroups';
import {
  applyClipEdgeMove,
  snapBoundaryToSiblings,
  type ClipEdgeResizeContext,
  type ClipEdgeResizeUpdate,
  type FreeClipEdgeResizeContext,
  type ResizeDir,
} from '@/tools/video-editor/lib/resize-math';
import { getSourceTime, type TimelineData } from '@/tools/video-editor/lib/timeline-data';
import type { TimelineAction, TimelineRow } from '@/tools/video-editor/types/timeline-canvas';
import type { ClipEdgeResizeSession } from '@/tools/video-editor/hooks/useClipResize';
import {
  EMPTY_RESIZE_PREVIEW_SNAPSHOT,
  SNAP_THRESHOLD_PX,
  type ResizeOverride,
} from '@/tools/video-editor/components/TimelineEditor/timeline-canvas-constants';

export interface ResizePreviewStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => Readonly<Record<string, ResizeOverride>>;
  merge: (updates: Record<string, ResizeOverride>) => void;
  clear: (overrideIds: string[]) => void;
}

interface ResizeUpdateDeps {
  rows: TimelineRow[];
  onActionResizing?: (params: {
    action: TimelineAction;
    row: TimelineRow;
    start: number;
    end: number;
    dir: ResizeDir;
  }) => void;
  pixelToTime: (pixel: number) => number;
  pixelsPerSecond: number;
  minDuration: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const getAudioResizeLimits = (
  data: TimelineData | null,
  action: TimelineAction,
  row: TimelineRow,
  dir: ResizeDir,
): Pick<FreeClipEdgeResizeContext, 'minStart' | 'maxEnd'> => {
  if (!data?.meta || !data?.tracks) {
    return {};
  }

  const clipMeta = data.meta[action.id];
  if (!clipMeta || typeof clipMeta.hold === 'number') {
    return {};
  }

  const trackKind = data.tracks.find((track) => track.id === row.id)?.kind
    ?? data.tracks.find((track) => track.id === clipMeta.track)?.kind;
  if (trackKind !== 'audio') {
    return {};
  }

  const speed = clipMeta.speed ?? 1;
  if (speed <= 0) {
    return {};
  }

  const from = clipMeta.from ?? 0;
  const to = getSourceTime({ from, start: action.start, speed }, action.end);

  if (dir === 'left') {
    return {
      minStart: action.end - (to / speed),
    };
  }

  const assetDuration = clipMeta.asset
    ? data.resolvedConfig.registry[clipMeta.asset]?.duration ?? data.registry.assets[clipMeta.asset]?.duration
    : undefined;
  if (typeof assetDuration !== 'number') {
    return {};
  }

  return {
    maxEnd: action.start + Math.max(0, assetDuration - from) / speed,
  };
};

const collectSiblingTimes = (
  actions: TimelineAction[],
  excludedClipIds: readonly string[],
): number[] => {
  const excluded = new Set(excludedClipIds);
  const siblingTimes = [0];
  for (const action of actions) {
    if (excluded.has(action.id)) {
      continue;
    }
    siblingTimes.push(action.start, action.end);
  }
  return siblingTimes;
};

const getGroupPreviewKey = (shotId: string, trackId: string): string => `${shotId}:${trackId}`;

const getUpdateForClip = (
  updates: ClipEdgeResizeUpdate[],
  clipId: string,
): ClipEdgeResizeUpdate | null => updates.find((update) => update.clipId === clipId) ?? null;

const getOverrideMapForUpdates = (
  session: ClipEdgeResizeSession,
  updates: ClipEdgeResizeUpdate[],
): Record<string, ResizeOverride> => {
  const overrides: Record<string, ResizeOverride> = Object.fromEntries(
    updates.map((update) => [update.clipId, { start: update.start, end: update.end }]),
  );

  if (session.context.kind === 'group' && updates.length > 0) {
    const start = Math.min(...updates.map((update) => update.start));
    const end = Math.max(...updates.map((update) => update.end));
    overrides[getGroupPreviewKey(session.context.shotId, session.context.trackId)] = { start, end };
  }

  return overrides;
};

const clampFreeBoundaryTime = (
  context: FreeClipEdgeResizeContext,
  edge: ResizeDir,
  boundaryTime: number,
  minimumDuration: number,
): { boundaryTime: number; limitClamped: boolean } => {
  if (edge === 'left') {
    let nextBoundaryTime = clamp(boundaryTime, 0, context.initialEnd - minimumDuration);
    let limitClamped = false;
    if (typeof context.minStart === 'number' && nextBoundaryTime < context.minStart) {
      nextBoundaryTime = context.minStart;
      limitClamped = true;
    }
    return { boundaryTime: nextBoundaryTime, limitClamped };
  }

  let nextBoundaryTime = Math.max(context.initialStart + minimumDuration, boundaryTime);
  let limitClamped = false;
  if (typeof context.maxEnd === 'number' && nextBoundaryTime > context.maxEnd) {
    nextBoundaryTime = context.maxEnd;
    limitClamped = true;
  }
  return { boundaryTime: nextBoundaryTime, limitClamped };
};

export const createResizePreviewStore = (): ResizePreviewStore => {
  let snapshot: Readonly<Record<string, ResizeOverride>> = EMPTY_RESIZE_PREVIEW_SNAPSHOT;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const commit = (next: Record<string, ResizeOverride>) => {
    snapshot = Object.keys(next).length === 0 ? EMPTY_RESIZE_PREVIEW_SNAPSHOT : next;
    emit();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    merge(updates) {
      let next: Record<string, ResizeOverride> | null = null;
      for (const [key, value] of Object.entries(updates)) {
        const current = snapshot[key];
        if (current?.start === value.start && current?.end === value.end) {
          continue;
        }

        if (!next) {
          next = snapshot === EMPTY_RESIZE_PREVIEW_SNAPSHOT ? {} : { ...snapshot };
        }
        next[key] = value;
      }

      if (next) {
        commit(next);
      }
    },
    clear(overrideIds) {
      let next: Record<string, ResizeOverride> | null = null;
      for (const overrideId of overrideIds) {
        if (!(overrideId in snapshot)) {
          continue;
        }

        if (!next) {
          next = { ...snapshot };
        }
        delete next[overrideId];
      }

      if (next) {
        commit(next);
      }
    },
  };
};

export const clearResizePreview = (
  resizePreviewStore: ResizePreviewStore,
  overrideIds: string[],
): void => {
  resizePreviewStore.clear(overrideIds);
};

export const getResizePreviewIds = (session: ClipEdgeResizeSession): string[] => {
  switch (session.context.kind) {
    case 'free':
      return [session.clipId];
    case 'group':
      return [
        getGroupPreviewKey(session.context.shotId, session.context.trackId),
        ...session.context.groupClipIds,
      ];
  }
};

export const getPreviewUpdatesFromSnapshot = (
  session: ClipEdgeResizeSession,
  snapshot: Readonly<Record<string, ResizeOverride>>,
): ClipEdgeResizeUpdate[] => {
  switch (session.context.kind) {
    case 'free': {
      const override = snapshot[session.clipId];
      return [{
        clipId: session.clipId,
        start: override?.start ?? session.context.initialStart,
        end: override?.end ?? session.context.initialEnd,
      }];
    }
    case 'group':
      return session.context.groupChildrenSnapshot.map((child) => {
        const override = snapshot[child.clipId];
        return {
          clipId: child.clipId,
          start: override?.start ?? child.start,
          end: override?.end ?? child.end,
        };
      });
  }
};

export const getGroupReleaseUpdates = (
  session: ClipEdgeResizeSession,
  updates: ClipEdgeResizeUpdate[],
): ClipEdgeResizeUpdate[] => {
  // For group contexts the unified apply already returns correct updates
  // for all clips, so just pass through.
  return updates;
};

export const resolveClipEdgeResizeContext = (
  rows: TimelineRow[],
  shotGroups: ShotGroup[],
  resizePreviewSnapshot: Readonly<Record<string, ResizeOverride>>,
  rowId: string,
  clipId: string,
  edge: ResizeDir,
  dataRef: MutableRefObject<TimelineData | null>,
): {
  initialBoundaryTime: number;
  context: ClipEdgeResizeContext;
  siblingTimes: number[];
} | null => {
  const row = rows.find((candidate) => candidate.id === rowId);
  const action = row?.actions.find((candidate) => candidate.id === clipId);
  if (!row || !action) {
    return null;
  }

  const positionedShotGroups = shotGroups.flatMap((group) => {
    const groupRow = rows[group.rowIndex];
    if (!groupRow || groupRow.id !== group.rowId) {
      return [];
    }

    const lastChild = group.children[group.children.length - 1];
    if (!lastChild) {
      return [];
    }

    const groupKey = getGroupPreviewKey(group.shotId, group.rowId);
    const preview = resizePreviewSnapshot[groupKey];
    return [{
      shotId: group.shotId,
      rowId: group.rowId,
      clipIds: group.clipIds,
      start: preview?.start ?? group.start,
      end: preview?.end ?? (group.start + lastChild.offset + lastChild.duration),
    }];
  });

  const groupForAction = shotGroups.find((candidate) => (
    candidate.rowId === rowId && candidate.clipIds.includes(clipId)
  ));
  if (groupForAction) {
    const groupChildrenSnapshot = groupForAction.clipIds
      .map((candidateClipId) => row.actions.find((candidate) => candidate.id === candidateClipId))
      .filter((candidate): candidate is TimelineAction => !!candidate)
      .map((candidate) => ({ clipId: candidate.id, start: candidate.start, end: candidate.end }));

    const draggedIndex = groupChildrenSnapshot.findIndex((child) => child.clipId === clipId);

    if (groupChildrenSnapshot.length > 0 && draggedIndex >= 0) {
      return {
        initialBoundaryTime: edge === 'left' ? action.start : action.end,
        siblingTimes: collectSiblingTimes(row.actions, groupForAction.clipIds),
        context: {
          kind: 'group',
          shotId: groupForAction.shotId,
          trackId: groupForAction.rowId,
          draggedClipId: action.id,
          draggedIndex,
          groupClipIds: [...groupForAction.clipIds],
          groupChildrenSnapshot,
        },
      };
    }
  }

  return {
    initialBoundaryTime: edge === 'left' ? action.start : action.end,
    siblingTimes: collectSiblingTimes(row.actions, [action.id]),
    context: {
      kind: 'free',
      clipId: action.id,
      initialStart: action.start,
      initialEnd: action.end,
      ...getAudioResizeLimits(dataRef.current, action, row, edge),
    },
  };
};

export const getResolvedResizeAction = (
  rows: TimelineRow[],
  rowId: string,
  clipId: string,
  updates: ClipEdgeResizeUpdate[],
): { row: TimelineRow; action: TimelineAction } | null => {
  const row = rows.find((candidate) => candidate.id === rowId);
  const action = row?.actions.find((candidate) => candidate.id === clipId);
  const update = getUpdateForClip(updates, clipId);
  if (!row || !action || !update) {
    return null;
  }

  return {
    row,
    action: { ...action, start: update.start, end: update.end },
  };
};

export const computeResizePreview = (
  session: ClipEdgeResizeSession,
  clientX: number,
  pixelToTime: (pixel: number) => number,
  pixelsPerSecond: number,
  minDuration: number,
): {
  updates: ClipEdgeResizeUpdate[];
  overrides: Record<string, ResizeOverride>;
  clampedHighlight: boolean;
} => {
  const rawBoundaryTime = pixelToTime(clientX - session.cursorOffsetPx);
  const snapThresholdSeconds = SNAP_THRESHOLD_PX / pixelsPerSecond;
  let boundaryTime = rawBoundaryTime;
  let limitClamped = false;

  if (session.context.kind === 'free') {
    const initialClamp = clampFreeBoundaryTime(session.context, session.edge, boundaryTime, minDuration);
    boundaryTime = initialClamp.boundaryTime;
    limitClamped = initialClamp.limitClamped;
  }

  if (session.siblingTimes.length > 0) {
    boundaryTime = snapBoundaryToSiblings(boundaryTime, session.siblingTimes, snapThresholdSeconds);
  }

  if (session.context.kind === 'free') {
    const snappedClamp = clampFreeBoundaryTime(session.context, session.edge, boundaryTime, minDuration);
    boundaryTime = snappedClamp.boundaryTime;
    limitClamped = limitClamped || snappedClamp.limitClamped;
  }

  const resizeResult = applyClipEdgeMove(session.context, session.edge, boundaryTime);
  const clampedHighlight = session.context.kind === 'group'
    ? resizeResult.wasClamped
    : session.context.kind === 'free'
      ? limitClamped
      : false;

  return {
    updates: resizeResult.updates,
    overrides: getOverrideMapForUpdates(session, resizeResult.updates),
    clampedHighlight,
  };
};

export const updateResize = (
  session: ClipEdgeResizeSession,
  clientX: number,
  deps: ResizeUpdateDeps,
  resizePreviewStore: ResizePreviewStore,
  setResizeClampedActionId: Dispatch<SetStateAction<string | null>>,
): void => {
  const preview = computeResizePreview(
    session,
    clientX,
    deps.pixelToTime,
    deps.pixelsPerSecond,
    deps.minDuration,
  );
  resizePreviewStore.merge(preview.overrides);
  setResizeClampedActionId((current) => (
    preview.clampedHighlight ? session.clipId : current === session.clipId ? null : current
  ));

  if (session.context.kind !== 'free') {
    return;
  }

  const context = getResolvedResizeAction(deps.rows, session.rowId, session.clipId, preview.updates);
  if (!context) {
    return;
  }

  deps.onActionResizing?.({
    action: context.action,
    row: context.row,
    start: context.action.start,
    end: context.action.end,
    dir: session.edge,
  });
};
