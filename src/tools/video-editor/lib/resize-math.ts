export type ResizeDir = 'left' | 'right';

export interface ResizeRange {
  start: number;
  end: number;
}

const MIN_CLIP_EDGE_RESIZE_DURATION = 0.05;

interface GroupChildBoundaryResizeArgs {
  dir: ResizeDir;
  dragged: ResizeRange;
  adjacent: ResizeRange;
  proposedBoundary: number;
  minimumDuration: number;
}

interface GroupEdgeResizeArgs {
  dir: ResizeDir;
  initial: ResizeRange;
  proposedBoundary: number;
  minimumDuration: number;
  minimumStart?: number;
}

interface GroupChildBoundaryResizeResult {
  boundary: number;
  wasClamped: boolean;
  dragged: ResizeRange;
  adjacent: ResizeRange;
}

interface GroupEdgeResizeResult extends ResizeRange {
  boundary: number;
  wasClamped: boolean;
}

export interface ClipEdgeResizeUpdate extends ResizeRange {
  clipId: string;
}

export interface FreeClipEdgeResizeContext {
  kind: 'free';
  clipId: string;
  initialStart: number;
  initialEnd: number;
  minStart?: number;
  maxEnd?: number;
}

export interface InteriorClipEdgeResizeContext {
  kind: 'interior';
  pairStart: number;
  pairEnd: number;
  draggedClipId: string;
  adjacentClipId: string;
  draggedInitialStart: number;
  draggedInitialEnd: number;
  adjacentInitialStart: number;
  adjacentInitialEnd: number;
}

export interface OuterClipEdgeResizeContext {
  kind: 'outer';
  shotId: string;
  trackId: string;
  groupInitialStart: number;
  groupInitialEnd: number;
  groupClipIds: string[];
  groupChildrenSnapshot: ClipEdgeResizeUpdate[];
}

export type ClipEdgeResizeContext =
  | FreeClipEdgeResizeContext
  | InteriorClipEdgeResizeContext
  | OuterClipEdgeResizeContext;

export interface ApplyClipEdgeMoveResult {
  updates: ClipEdgeResizeUpdate[];
  wasClamped: boolean;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function computeGroupChildBoundaryResize({
  dir,
  dragged,
  adjacent,
  proposedBoundary,
  minimumDuration,
}: GroupChildBoundaryResizeArgs): GroupChildBoundaryResizeResult {
  const pairStart = dir === 'left' ? adjacent.start : dragged.start;
  const pairEnd = dir === 'left' ? dragged.end : adjacent.end;
  const boundary = clamp(proposedBoundary, pairStart + minimumDuration, pairEnd - minimumDuration);

  return {
    boundary,
    wasClamped: boundary !== proposedBoundary,
    dragged: dir === 'left'
      ? { start: boundary, end: dragged.end }
      : { start: dragged.start, end: boundary },
    adjacent: dir === 'left'
      ? { start: adjacent.start, end: boundary }
      : { start: boundary, end: adjacent.end },
  };
}

export function computeGroupEdgeResize({
  dir,
  initial,
  proposedBoundary,
  minimumDuration,
  minimumStart = 0,
}: GroupEdgeResizeArgs): GroupEdgeResizeResult {
  const boundary = dir === 'left'
    ? clamp(proposedBoundary, minimumStart, initial.end - minimumDuration)
    : Math.max(initial.start + minimumDuration, proposedBoundary);

  return {
    boundary,
    wasClamped: boundary !== proposedBoundary,
    start: dir === 'left' ? boundary : initial.start,
    end: dir === 'right' ? boundary : initial.end,
  };
}

export function snapBoundaryToSiblings(
  boundaryTime: number,
  siblingTimes: number[],
  thresholdSeconds: number,
): number {
  if (thresholdSeconds < 0) {
    return boundaryTime;
  }

  let snappedBoundary = boundaryTime;
  let closestDistance = thresholdSeconds;

  for (const siblingTime of siblingTimes) {
    const distance = Math.abs(boundaryTime - siblingTime);
    if (distance < closestDistance) {
      closestDistance = distance;
      snappedBoundary = siblingTime;
    }
  }

  return snappedBoundary;
}

const applyFreeClipEdgeMove = (
  context: FreeClipEdgeResizeContext,
  edge: ResizeDir,
  newBoundaryTime: number,
): ApplyClipEdgeMoveResult => {
  if (edge === 'left') {
    const resized = computeGroupEdgeResize({
      dir: edge,
      initial: { start: context.initialStart, end: context.initialEnd },
      proposedBoundary: newBoundaryTime,
      minimumDuration: MIN_CLIP_EDGE_RESIZE_DURATION,
      minimumStart: context.minStart ?? 0,
    });

    return {
      updates: [{ clipId: context.clipId, start: resized.start, end: resized.end }],
      wasClamped: resized.wasClamped,
    };
  }

  const resized = computeGroupEdgeResize({
    dir: edge,
    initial: { start: context.initialStart, end: context.initialEnd },
    proposedBoundary: newBoundaryTime,
    minimumDuration: MIN_CLIP_EDGE_RESIZE_DURATION,
  });

  let end = resized.end;
  let wasClamped = resized.wasClamped;
  if (typeof context.maxEnd === 'number') {
    const maximumEnd = Math.max(context.initialStart + MIN_CLIP_EDGE_RESIZE_DURATION, context.maxEnd);
    if (end > maximumEnd) {
      end = maximumEnd;
      wasClamped = true;
    }
  }

  return {
    updates: [{ clipId: context.clipId, start: resized.start, end }],
    wasClamped,
  };
};

const applyInteriorClipEdgeMove = (
  context: InteriorClipEdgeResizeContext,
  edge: ResizeDir,
  newBoundaryTime: number,
): ApplyClipEdgeMoveResult => {
  const resized = computeGroupChildBoundaryResize({
    dir: edge,
    dragged: { start: context.draggedInitialStart, end: context.draggedInitialEnd },
    adjacent: { start: context.adjacentInitialStart, end: context.adjacentInitialEnd },
    proposedBoundary: newBoundaryTime,
    minimumDuration: MIN_CLIP_EDGE_RESIZE_DURATION,
  });

  return {
    updates: [
      { clipId: context.draggedClipId, start: resized.dragged.start, end: resized.dragged.end },
      { clipId: context.adjacentClipId, start: resized.adjacent.start, end: resized.adjacent.end },
    ],
    wasClamped: resized.wasClamped,
  };
};

const applyOuterClipEdgeMove = (
  context: OuterClipEdgeResizeContext,
  edge: ResizeDir,
  newBoundaryTime: number,
): ApplyClipEdgeMoveResult => {
  const draggedChild = edge === 'left'
    ? context.groupChildrenSnapshot[0]
    : context.groupChildrenSnapshot[context.groupChildrenSnapshot.length - 1];
  if (!draggedChild) {
    return { updates: [], wasClamped: false };
  }

  const resized = computeGroupEdgeResize({
    dir: edge,
    initial: { start: draggedChild.start, end: draggedChild.end },
    proposedBoundary: newBoundaryTime,
    minimumDuration: MIN_CLIP_EDGE_RESIZE_DURATION,
  });

  return {
    updates: [{
      clipId: draggedChild.clipId,
      start: resized.start,
      end: resized.end,
    }],
    wasClamped: resized.wasClamped,
  };
};

export function applyClipEdgeMove(
  context: ClipEdgeResizeContext,
  edge: ResizeDir,
  newBoundaryTime: number,
): ApplyClipEdgeMoveResult {
  switch (context.kind) {
    case 'free':
      return applyFreeClipEdgeMove(context, edge, newBoundaryTime);
    case 'interior':
      return applyInteriorClipEdgeMove(context, edge, newBoundaryTime);
    case 'outer':
      return applyOuterClipEdgeMove(context, edge, newBoundaryTime);
  }
}
