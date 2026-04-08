// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useClipResize, type ClipEdgeResizeSession } from './useClipResize';
import { applyClipEdgeMove, type ClipEdgeResizeContext, type ResizeDir } from '../lib/resize-math';
import { configToRows, type TimelineData } from '../lib/timeline-data';
import { getConfigSignature, getStableConfigSignature } from '../lib/config-utils';
import type { TimelineApplyEdit } from './timeline-state-types';
import type { TimelineConfig } from '../types';
import type { TimelineAction, TimelineRow } from '../types/timeline-canvas';

function makeData(opts: {
  groupClipIds: string[];
  groupMode?: 'images' | 'video';
  freeClips?: Array<{ id: string; at: number; hold: number }>;
}): TimelineData {
  const { groupClipIds, groupMode = 'images', freeClips = [] } = opts;

  const config: TimelineConfig = {
    output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' },
    tracks: [
      { id: 'V1', kind: 'visual', label: 'V1' },
      { id: 'V2', kind: 'visual', label: 'V2' },
    ],
    clips: [
      ...groupClipIds.map((id, index) => ({
        id,
        at: index,
        track: 'V1' as const,
        clipType: 'hold' as const,
        hold: 1,
      })),
      ...freeClips.map((clip) => ({
        id: clip.id,
        at: clip.at,
        track: 'V2' as const,
        clipType: 'hold' as const,
        hold: clip.hold,
      })),
    ],
    pinnedShotGroups: [
      {
        shotId: 'shot-1',
        trackId: 'V1',
        clipIds: [...groupClipIds],
        mode: groupMode,
      },
    ],
  };

  const rowData = configToRows(config);
  const resolvedConfig = {
    output: { ...config.output },
    tracks: (config.tracks ?? []).map((track) => ({ ...track })),
    clips: config.clips.map((clip) => ({ ...clip, assetEntry: undefined })),
    registry: {},
  };
  return {
    config,
    configVersion: 1,
    registry: { assets: {} },
    resolvedConfig,
    rows: rowData.rows,
    meta: rowData.meta,
    effects: rowData.effects,
    assetMap: {},
    output: { ...config.output },
    tracks: (config.tracks ?? []).map((track) => ({ ...track })),
    clipOrder: rowData.clipOrder,
    signature: getConfigSignature(resolvedConfig),
    stableSignature: getStableConfigSignature(config, { assets: {} }),
  };
}

function getRow(rows: TimelineRow[], rowId: string): TimelineRow {
  const row = rows.find((candidate) => candidate.id === rowId);
  if (!row) {
    throw new Error(`expected row ${rowId}`);
  }
  return row;
}

function getAction(rows: TimelineRow[], rowId: string, actionId: string): TimelineAction {
  const action = getRow(rows, rowId).actions.find((candidate) => candidate.id === actionId);
  if (!action) {
    throw new Error(`expected action ${actionId}`);
  }
  return action;
}

function buildSession(args: {
  rowId: string;
  clipId: string;
  edge: ResizeDir;
  context: ClipEdgeResizeContext;
}): ClipEdgeResizeSession {
  return {
    pointerId: 1,
    rowId: args.rowId,
    clipId: args.clipId,
    edge: args.edge,
    cursorOffsetPx: 0,
    initialBoundaryTime: 0,
    context: args.context,
    siblingTimes: [],
  };
}

function buildOuterContext(
  rows: TimelineRow[],
  rowId: string,
  clipIds: string[],
): ClipEdgeResizeContext {
  const groupActions = clipIds.map((clipId) => getAction(rows, rowId, clipId));
  return {
    kind: 'outer',
    shotId: 'shot-1',
    trackId: rowId,
    groupInitialStart: Math.min(...groupActions.map((action) => action.start)),
    groupInitialEnd: Math.max(...groupActions.map((action) => action.end)),
    groupClipIds: [...clipIds],
    groupChildrenSnapshot: groupActions.map((action) => ({
      clipId: action.id,
      start: action.start,
      end: action.end,
    })),
  };
}

function buildInteriorContext(
  rows: TimelineRow[],
  rowId: string,
  draggedClipId: string,
  adjacentClipId: string,
  edge: ResizeDir,
): ClipEdgeResizeContext {
  const dragged = getAction(rows, rowId, draggedClipId);
  const adjacent = getAction(rows, rowId, adjacentClipId);
  return {
    kind: 'interior',
    pairStart: edge === 'left' ? adjacent.start : dragged.start,
    pairEnd: edge === 'left' ? dragged.end : adjacent.end,
    draggedClipId,
    adjacentClipId,
    draggedInitialStart: dragged.start,
    draggedInitialEnd: dragged.end,
    adjacentInitialStart: adjacent.start,
    adjacentInitialEnd: adjacent.end,
  };
}

function buildFreeContext(
  rows: TimelineRow[],
  rowId: string,
  clipId: string,
): ClipEdgeResizeContext {
  const action = getAction(rows, rowId, clipId);
  return {
    kind: 'free',
    clipId,
    initialStart: action.start,
    initialEnd: action.end,
  };
}

function expectRowBounds(
  rows: TimelineRow[],
  rowId: string,
  clipId: string,
  bounds: { start: number; end: number },
) {
  const action = getAction(rows, rowId, clipId);
  expect(action.start).toBeCloseTo(bounds.start, 5);
  expect(action.end).toBeCloseTo(bounds.end, 5);
}

describe('useClipResize — unified clip-edge commit path', () => {
  it('commits free clip resize from unified updates', () => {
    const data = makeData({
      groupClipIds: ['a', 'b', 'c'],
      freeClips: [{ id: 'free-1', at: 5, hold: 2 }],
    });
    const dataRef = { current: data };
    const applyEdit = vi.fn<Parameters<TimelineApplyEdit>>();

    const { result } = renderHook(() => useClipResize({ dataRef, applyEdit }));

    const row = getRow(data.rows, 'V2');
    const action = getAction(data.rows, 'V2', 'free-1');
    const session = buildSession({
      rowId: 'V2',
      clipId: 'free-1',
      edge: 'right',
      context: buildFreeContext(data.rows, 'V2', 'free-1'),
    });

    act(() => {
      result.current.onActionResizeStart({ action, row, dir: 'right' });
    });
    act(() => {
      result.current.onClipEdgeResizeEnd({
        session,
        updates: applyClipEdgeMove(session.context, session.edge, 7.5).updates,
        cancelled: false,
      });
    });

    expect(applyEdit).toHaveBeenCalledOnce();
    const [mutation] = applyEdit.mock.calls[0];
    if (mutation.type !== 'rows') {
      throw new Error('expected rows mutation');
    }

    expect(mutation.metaUpdates?.['free-1']).toMatchObject({ hold: expect.closeTo(2.5, 5) });
    expectRowBounds(mutation.rows, 'V2', 'free-1', { start: 5, end: 7.5 });
  });

  it('commits outer-left grouped resize by scaling all children from unified updates', () => {
    const data = makeData({ groupClipIds: ['a', 'b', 'c'] });
    const dataRef = { current: data };
    const applyEdit = vi.fn<Parameters<TimelineApplyEdit>>();

    const { result } = renderHook(() => useClipResize({ dataRef, applyEdit }));

    const row = getRow(data.rows, 'V1');
    const action = getAction(data.rows, 'V1', 'a');
    const session = buildSession({
      rowId: 'V1',
      clipId: 'a',
      edge: 'left',
      context: buildOuterContext(data.rows, 'V1', ['a', 'b', 'c']),
    });

    act(() => {
      result.current.onActionResizeStart({ action, row, dir: 'left' });
    });
    act(() => {
      result.current.onClipEdgeResizeEnd({
        session,
        updates: applyClipEdgeMove(session.context, session.edge, 0.3).updates,
        cancelled: false,
      });
    });

    expect(applyEdit).toHaveBeenCalledOnce();
    const [mutation] = applyEdit.mock.calls[0];
    if (mutation.type !== 'rows') {
      throw new Error('expected rows mutation');
    }

    expect(mutation.metaUpdates?.a).toMatchObject({ hold: expect.closeTo(0.9, 5) });
    expect(mutation.metaUpdates?.b).toMatchObject({ hold: expect.closeTo(0.9, 5) });
    expect(mutation.metaUpdates?.c).toMatchObject({ hold: expect.closeTo(0.9, 5) });
    expectRowBounds(mutation.rows, 'V1', 'a', { start: 0.3, end: 1.2 });
    expectRowBounds(mutation.rows, 'V1', 'b', { start: 1.2, end: 2.1 });
    expectRowBounds(mutation.rows, 'V1', 'c', { start: 2.1, end: 3 });
  });

  it('commits outer-right grouped resize by scaling all children from unified updates', () => {
    const data = makeData({ groupClipIds: ['a', 'b', 'c'] });
    const dataRef = { current: data };
    const applyEdit = vi.fn<Parameters<TimelineApplyEdit>>();

    const { result } = renderHook(() => useClipResize({ dataRef, applyEdit }));

    const row = getRow(data.rows, 'V1');
    const action = getAction(data.rows, 'V1', 'c');
    const session = buildSession({
      rowId: 'V1',
      clipId: 'c',
      edge: 'right',
      context: buildOuterContext(data.rows, 'V1', ['a', 'b', 'c']),
    });

    act(() => {
      result.current.onActionResizeStart({ action, row, dir: 'right' });
    });
    act(() => {
      result.current.onClipEdgeResizeEnd({
        session,
        updates: applyClipEdgeMove(session.context, session.edge, 3.5).updates,
        cancelled: false,
      });
    });

    expect(applyEdit).toHaveBeenCalledOnce();
    const [mutation] = applyEdit.mock.calls[0];
    if (mutation.type !== 'rows') {
      throw new Error('expected rows mutation');
    }

    expect(mutation.metaUpdates?.a).toMatchObject({ hold: expect.closeTo(3.5 / 3, 5) });
    expect(mutation.metaUpdates?.b).toMatchObject({ hold: expect.closeTo(3.5 / 3, 5) });
    expect(mutation.metaUpdates?.c).toMatchObject({ hold: expect.closeTo(3.5 / 3, 5) });
    expectRowBounds(mutation.rows, 'V1', 'a', { start: 0, end: 3.5 / 3 });
    expectRowBounds(mutation.rows, 'V1', 'b', { start: 3.5 / 3, end: 7 / 3 });
    expectRowBounds(mutation.rows, 'V1', 'c', { start: 7 / 3, end: 3.5 });
  });

  it('commits interior right-edge resize for the dragged and adjacent clips', () => {
    const data = makeData({ groupClipIds: ['a', 'b', 'c'] });
    const dataRef = { current: data };
    const applyEdit = vi.fn<Parameters<TimelineApplyEdit>>();

    const { result } = renderHook(() => useClipResize({ dataRef, applyEdit }));

    const row = getRow(data.rows, 'V1');
    const action = getAction(data.rows, 'V1', 'b');
    const session = buildSession({
      rowId: 'V1',
      clipId: 'b',
      edge: 'right',
      context: buildInteriorContext(data.rows, 'V1', 'b', 'c', 'right'),
    });

    act(() => {
      result.current.onActionResizeStart({ action, row, dir: 'right' });
    });
    act(() => {
      result.current.onClipEdgeResizeEnd({
        session,
        updates: applyClipEdgeMove(session.context, session.edge, 2.3).updates,
        cancelled: false,
      });
    });

    expect(applyEdit).toHaveBeenCalledOnce();
    const [mutation] = applyEdit.mock.calls[0];
    if (mutation.type !== 'rows') {
      throw new Error('expected rows mutation');
    }

    expect(mutation.metaUpdates?.b).toMatchObject({ hold: expect.closeTo(1.3, 5) });
    expect(mutation.metaUpdates?.c).toMatchObject({ hold: expect.closeTo(0.7, 5) });
    expectRowBounds(mutation.rows, 'V1', 'a', { start: 0, end: 1 });
    expectRowBounds(mutation.rows, 'V1', 'b', { start: 1, end: 2.3 });
    expectRowBounds(mutation.rows, 'V1', 'c', { start: 2.3, end: 3 });
  });

  it('commits interior left-edge resize for the dragged and adjacent clips', () => {
    const data = makeData({ groupClipIds: ['a', 'b', 'c'] });
    const dataRef = { current: data };
    const applyEdit = vi.fn<Parameters<TimelineApplyEdit>>();

    const { result } = renderHook(() => useClipResize({ dataRef, applyEdit }));

    const row = getRow(data.rows, 'V1');
    const action = getAction(data.rows, 'V1', 'b');
    const session = buildSession({
      rowId: 'V1',
      clipId: 'b',
      edge: 'left',
      context: buildInteriorContext(data.rows, 'V1', 'b', 'a', 'left'),
    });

    act(() => {
      result.current.onActionResizeStart({ action, row, dir: 'left' });
    });
    act(() => {
      result.current.onClipEdgeResizeEnd({
        session,
        updates: applyClipEdgeMove(session.context, session.edge, 1.3).updates,
        cancelled: false,
      });
    });

    expect(applyEdit).toHaveBeenCalledOnce();
    const [mutation] = applyEdit.mock.calls[0];
    if (mutation.type !== 'rows') {
      throw new Error('expected rows mutation');
    }

    expect(mutation.metaUpdates?.a).toMatchObject({ hold: expect.closeTo(1.3, 5) });
    expect(mutation.metaUpdates?.b).toMatchObject({ hold: expect.closeTo(0.7, 5) });
    expectRowBounds(mutation.rows, 'V1', 'a', { start: 0, end: 1.3 });
    expectRowBounds(mutation.rows, 'V1', 'b', { start: 1.3, end: 2 });
    expectRowBounds(mutation.rows, 'V1', 'c', { start: 2, end: 3 });
  });
});
