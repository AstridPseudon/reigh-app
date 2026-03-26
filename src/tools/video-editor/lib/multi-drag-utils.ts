import type { TrackKind } from '@/tools/video-editor/types';
import type { ClipMeta, ClipOrderMap, TimelineData } from '@/tools/video-editor/lib/timeline-data';
import type { TimelineRow } from '@/tools/video-editor/types/timeline-canvas';
import { moveClipBetweenTracks } from '@/tools/video-editor/lib/coordinate-utils';
import { resolveGroupOverlaps, type GroupMovedClip } from '@/tools/video-editor/lib/resolve-overlaps';

// ── Types ────────────────────────────────────────────────────────────

export interface ClipOffset {
  clipId: string;
  rowId: string;
  /** Time delta from anchor clip's initial start. */
  deltaTime: number;
  initialStart: number;
  initialEnd: number;
}

export interface PlannedMove {
  clipId: string;
  sourceRowId: string;
  targetRowId: string;
  newStart: number;
}

export interface MultiDragResult {
  canMove: boolean;
  moves: PlannedMove[];
}

/** Lightweight rect for rendering secondary ghost indicators. */
export interface GhostRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// ── Planning ─────────────────────────────────────────────────────────

/**
 * Given a set of dragged clips, an anchor target row, and a time delta,
 * compute where every clip should land. Returns `canMove: false` if any
 * clip would go out of bounds or land on an incompatible track kind.
 *
 * Works for both same-track and cross-track drags — the caller just
 * provides the anchor's resolved target row and time.
 */
export function planMultiDragMoves(
  data: TimelineData,
  clipOffsets: readonly ClipOffset[],
  anchorClipId: string,
  anchorTargetRowId: string,
  anchorSourceRowId: string,
  timeDelta: number,
): MultiDragResult {
  const rowIds = data.rows.map((r) => r.id);
  const trackById = new Map(data.tracks.map((t) => [t.id, t]));
  const anchorSourceIndex = rowIds.indexOf(anchorSourceRowId);
  const anchorTargetIndex = rowIds.indexOf(anchorTargetRowId);
  const trackDelta = anchorTargetIndex - anchorSourceIndex;

  if (trackDelta === 0 && timeDelta === 0) {
    return { canMove: false, moves: [] };
  }

  const moves: PlannedMove[] = [];

  for (const offset of clipOffsets) {
    const sourceIndex = rowIds.indexOf(offset.rowId);
    const targetIndex = sourceIndex + trackDelta;

    if (targetIndex < 0 || targetIndex >= rowIds.length) {
      return { canMove: false, moves: [] };
    }

    const targetRowId = rowIds[targetIndex];
    const sourceTrack = trackById.get(offset.rowId);
    const targetTrack = trackById.get(targetRowId);

    if (!sourceTrack || !targetTrack || sourceTrack.kind !== targetTrack.kind) {
      return { canMove: false, moves: [] };
    }

    moves.push({
      clipId: offset.clipId,
      sourceRowId: offset.rowId,
      targetRowId,
      newStart: offset.initialStart + timeDelta,
    });
  }

  return { canMove: true, moves };
}

// ── Applying ─────────────────────────────────────────────────────────

/**
 * Apply a set of planned moves to the timeline rows, resolve overlaps,
 * and update clip ordering. Returns the new rows, meta updates, and
 * clip order — ready to pass to `applyTimelineEdit`.
 */
export function applyMultiDragMoves(
  data: TimelineData,
  moves: PlannedMove[],
): {
  nextRows: TimelineRow[];
  metaUpdates: Record<string, Partial<ClipMeta>>;
  nextClipOrder: ClipOrderMap;
} {
  const movedClipIds = new Set(moves.map((m) => m.clipId));

  // Remove all moved clips from their source rows
  let nextRows = data.rows.map((row) => ({
    ...row,
    actions: row.actions.filter((a) => !movedClipIds.has(a.id)),
  }));

  // Build a map of actions to add per target row (single pass)
  const actionsToAdd = new Map<string, typeof data.rows[0]['actions']>();
  const metaUpdates: Record<string, Partial<ClipMeta>> = {};

  for (const move of moves) {
    const originalRow = data.rows.find((r) => r.id === move.sourceRowId);
    const action = originalRow?.actions.find((a) => a.id === move.clipId);
    if (!action) continue;

    const duration = action.end - action.start;
    const newStart = Math.max(0, move.newStart);
    const movedAction = { ...action, start: newStart, end: newStart + duration };

    const existing = actionsToAdd.get(move.targetRowId) ?? [];
    existing.push(movedAction);
    actionsToAdd.set(move.targetRowId, existing);

    if (move.sourceRowId !== move.targetRowId) {
      metaUpdates[move.clipId] = { track: move.targetRowId };
    }
  }

  // Add moved actions to target rows (single pass over rows)
  nextRows = nextRows.map((row) => {
    const additions = actionsToAdd.get(row.id);
    return additions ? { ...row, actions: [...row.actions, ...additions] } : row;
  });

  // Resolve overlaps per target row
  const targetRowIds = new Set(moves.map((m) => m.targetRowId));
  for (const targetRowId of targetRowIds) {
    const rowMoves = moves.filter((m) => m.targetRowId === targetRowId);
    const groupMoved: GroupMovedClip[] = rowMoves.map((m) => {
      const originalRow = data.rows.find((r) => r.id === m.sourceRowId);
      const action = originalRow?.actions.find((a) => a.id === m.clipId);
      const duration = action ? action.end - action.start : 0;
      const newStart = Math.max(0, m.newStart);
      return { rowId: targetRowId, clipId: m.clipId, newStart, newEnd: newStart + duration };
    });
    nextRows = resolveGroupOverlaps(nextRows, groupMoved, data.meta);
  }

  // Update clip order for cross-track moves
  let nextClipOrder = data.clipOrder;
  for (const move of moves) {
    if (move.sourceRowId !== move.targetRowId) {
      nextClipOrder = moveClipBetweenTracks(nextClipOrder, move.clipId, move.sourceRowId, move.targetRowId);
    }
  }

  return { nextRows, metaUpdates, nextClipOrder };
}

// ── Ghost indicators ─────────────────────────────────────────────────

/**
 * Compute ghost rectangles for secondary (non-anchor) clips during a
 * multi-drag, using the anchor's screen position as the reference point.
 */
export function computeSecondaryGhosts(
  clipOffsets: readonly ClipOffset[],
  anchorClipId: string,
  anchorSourceRowId: string,
  anchorTargetRowId: string,
  anchorGhostLeft: number,
  anchorRowTop: number,
  rowHeight: number,
  pixelsPerSecond: number,
  rowIds: readonly string[],
): GhostRect[] {
  const anchorSourceIndex = rowIds.indexOf(anchorSourceRowId);
  const anchorTargetIndex = rowIds.indexOf(anchorTargetRowId);
  const trackDelta = anchorTargetIndex - anchorSourceIndex;

  const ghosts: GhostRect[] = [];

  for (const offset of clipOffsets) {
    if (offset.clipId === anchorClipId) continue;

    const sourceIndex = rowIds.indexOf(offset.rowId);
    const targetIndex = sourceIndex + trackDelta;
    if (targetIndex < 0 || targetIndex >= rowIds.length) continue;

    const rowDelta = targetIndex - anchorTargetIndex;
    const clipDuration = offset.initialEnd - offset.initialStart;

    ghosts.push({
      left: anchorGhostLeft + (offset.deltaTime * pixelsPerSecond),
      top: anchorRowTop + (rowDelta * rowHeight) + 2,
      width: clipDuration * pixelsPerSecond,
      height: Math.max(0, rowHeight - 4),
    });
  }

  return ghosts;
}
