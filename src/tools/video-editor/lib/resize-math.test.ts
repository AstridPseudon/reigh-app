import { describe, expect, it } from 'vitest';
import {
  applyClipEdgeMove,
  computeGroupChildBoundaryResize,
  computeGroupEdgeResize,
  snapBoundaryToSiblings,
} from '@/tools/video-editor/lib/resize-math';

describe('computeGroupChildBoundaryResize', () => {
  it('moves an interior right boundary symmetrically', () => {
    const result = computeGroupChildBoundaryResize({
      dir: 'right',
      dragged: { start: 1, end: 2 },
      adjacent: { start: 2, end: 3 },
      proposedBoundary: 2.3,
      minimumDuration: 0.05,
    });

    expect(result.wasClamped).toBe(false);
    expect(result.boundary).toBeCloseTo(2.3, 5);
    expect(result.dragged).toEqual({ start: 1, end: 2.3 });
    expect(result.adjacent).toEqual({ start: 2.3, end: 3 });
  });

  it('moves an interior left boundary symmetrically', () => {
    const result = computeGroupChildBoundaryResize({
      dir: 'left',
      dragged: { start: 1, end: 2 },
      adjacent: { start: 0, end: 1 },
      proposedBoundary: 1.3,
      minimumDuration: 0.05,
    });

    expect(result.wasClamped).toBe(false);
    expect(result.boundary).toBeCloseTo(1.3, 5);
    expect(result.dragged).toEqual({ start: 1.3, end: 2 });
    expect(result.adjacent).toEqual({ start: 0, end: 1.3 });
  });

  it('clamps the shared boundary so neither child drops below minimum duration', () => {
    const result = computeGroupChildBoundaryResize({
      dir: 'right',
      dragged: { start: 1, end: 2 },
      adjacent: { start: 2, end: 3 },
      proposedBoundary: 2.99,
      minimumDuration: 0.25,
    });

    expect(result.wasClamped).toBe(true);
    expect(result.boundary).toBeCloseTo(2.75, 5);
    expect(result.dragged).toEqual({ start: 1, end: 2.75 });
    expect(result.adjacent).toEqual({ start: 2.75, end: 3 });
  });
});

describe('computeGroupEdgeResize', () => {
  it('clamps the left edge at zero', () => {
    const result = computeGroupEdgeResize({
      dir: 'left',
      initial: { start: 2, end: 5 },
      proposedBoundary: -1,
      minimumDuration: 0.05,
    });

    expect(result.wasClamped).toBe(true);
    expect(result.start).toBe(0);
    expect(result.end).toBe(5);
  });

  it('enforces minimum duration on both directions', () => {
    const left = computeGroupEdgeResize({
      dir: 'left',
      initial: { start: 2, end: 5 },
      proposedBoundary: 4.99,
      minimumDuration: 0.5,
    });
    const right = computeGroupEdgeResize({
      dir: 'right',
      initial: { start: 2, end: 5 },
      proposedBoundary: 2.01,
      minimumDuration: 0.5,
    });

    expect(left.start).toBeCloseTo(4.5, 5);
    expect(left.end).toBe(5);
    expect(right.start).toBe(2);
    expect(right.end).toBeCloseTo(2.5, 5);
  });

  it('changes duration symmetrically for equivalent left and right proposals', () => {
    const left = computeGroupEdgeResize({
      dir: 'left',
      initial: { start: 10, end: 20 },
      proposedBoundary: 12,
      minimumDuration: 0.05,
    });
    const right = computeGroupEdgeResize({
      dir: 'right',
      initial: { start: 10, end: 20 },
      proposedBoundary: 18,
      minimumDuration: 0.05,
    });

    expect(left.end - left.start).toBeCloseTo(8, 5);
    expect(right.end - right.start).toBeCloseTo(8, 5);
  });
});

describe('applyClipEdgeMove', () => {
  it('returns a single updated clip for free resize and enforces maxEnd clamps', () => {
    const result = applyClipEdgeMove({
      kind: 'free',
      clipId: 'clip-a',
      initialStart: 1,
      initialEnd: 4,
      maxEnd: 4.5,
    }, 'right', 6);

    expect(result.wasClamped).toBe(true);
    expect(result.updates).toEqual([
      { clipId: 'clip-a', start: 1, end: 4.5 },
    ]);
  });

  it('returns dragged and adjacent clip updates for interior boundary moves', () => {
    const result = applyClipEdgeMove({
      kind: 'interior',
      pairStart: 1,
      pairEnd: 3,
      draggedClipId: 'clip-a',
      adjacentClipId: 'clip-b',
      draggedInitialStart: 1,
      draggedInitialEnd: 2,
      adjacentInitialStart: 2,
      adjacentInitialEnd: 3,
    }, 'right', 2.25);

    expect(result.wasClamped).toBe(false);
    expect(result.updates).toEqual([
      { clipId: 'clip-a', start: 1, end: 2.25 },
      { clipId: 'clip-b', start: 2.25, end: 3 },
    ]);
  });

  it('outer left edge resizes only the first child of the group', () => {
    const result = applyClipEdgeMove({
      kind: 'outer',
      shotId: 'shot-1',
      trackId: 'row-1',
      groupInitialStart: 10,
      groupInitialEnd: 20,
      groupClipIds: ['clip-a', 'clip-b'],
      groupChildrenSnapshot: [
        { clipId: 'clip-a', start: 10, end: 13 },
        { clipId: 'clip-b', start: 13, end: 20 },
      ],
    }, 'left', 8);

    expect(result.wasClamped).toBe(false);
    expect(result.updates).toEqual([{ clipId: 'clip-a', start: 8, end: 13 }]);
  });

  it('outer right edge resizes only the last child of the group', () => {
    const result = applyClipEdgeMove({
      kind: 'outer',
      shotId: 'shot-1',
      trackId: 'row-1',
      groupInitialStart: 10,
      groupInitialEnd: 20,
      groupClipIds: ['clip-a', 'clip-b', 'clip-c'],
      groupChildrenSnapshot: [
        { clipId: 'clip-a', start: 10, end: 13 },
        { clipId: 'clip-b', start: 13, end: 16 },
        { clipId: 'clip-c', start: 16, end: 20 },
      ],
    }, 'right', 18);

    expect(result.wasClamped).toBe(false);
    expect(result.updates).toEqual([{ clipId: 'clip-c', start: 16, end: 18 }]);
  });

  it('clamps outer edge resizes against the dragged child minimum duration', () => {
    const result = applyClipEdgeMove({
      kind: 'outer',
      shotId: 'shot-1',
      trackId: 'row-1',
      groupInitialStart: 10,
      groupInitialEnd: 12,
      groupClipIds: ['clip-a', 'clip-b'],
      groupChildrenSnapshot: [
        { clipId: 'clip-a', start: 10, end: 11 },
        { clipId: 'clip-b', start: 11, end: 12 },
      ],
    }, 'right', 11.01);

    expect(result.wasClamped).toBe(true);
    expect(result.updates).toEqual([{ clipId: 'clip-b', start: 11, end: 11.05 }]);
  });
});

describe('snapBoundaryToSiblings', () => {
  it('snaps to the nearest sibling boundary within the threshold', () => {
    expect(snapBoundaryToSiblings(4.92, [2, 5, 9], 0.1)).toBe(5);
  });

  it('keeps the original boundary when no sibling is close enough', () => {
    expect(snapBoundaryToSiblings(4.92, [2, 5, 9], 0.05)).toBe(4.92);
  });
});
