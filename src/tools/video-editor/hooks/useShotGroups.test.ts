// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Shot } from '@/domains/generation/types';
import type { TimelineAction, TimelineRow } from '@/tools/video-editor/types/timeline-canvas';
import { getShotColor, useShotGroups } from './useShotGroups';

function buildAction(id: string, start: number, end: number): TimelineAction {
  return { id, start, end, effectId: `effect-${id}` };
}

function buildShot(id: string, name: string): Shot {
  return { id, name, images: [] } as Shot;
}

describe('useShotGroups', () => {
  it('returns deterministic colors and different colors for distinct sample shot ids', () => {
    expect(getShotColor('shot-a')).toBe(getShotColor('shot-a'));
    expect(new Set(['shot-a', 'shot-b', 'shot-c'].map((shotId) => getShotColor(shotId))).size).toBe(3);
  });

  it('returns empty array when pinnedShotGroups is undefined', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 1)] }];
    const { result } = renderHook(() => useShotGroups(rows, [buildShot('shot-1', 'Shot 1')]));
    expect(result.current).toEqual([]);
  });

  it('returns pinned groups', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 2)] }];
    const { result } = renderHook(() => useShotGroups(
      rows,
      [buildShot('shot-1', 'Shot 1')],
      [{
        shotId: 'shot-1',
        trackId: 'V1',
        clipIds: ['clip-1'],
        mode: 'video',
      }],
    ));

    expect(result.current).toEqual([{
      shotId: 'shot-1',
      shotName: 'Shot 1',
      rowId: 'V1',
      rowIndex: 0,
      start: 0,
      clipIds: ['clip-1'],
      children: [{ clipId: 'clip-1', offset: 0, duration: 2 }],
      color: getShotColor('shot-1'),
      mode: 'video',
    }]);
  });

  it('resolves stale track ids against the live rows', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 2)] }];
    const { result } = renderHook(() => useShotGroups(
      rows,
      [buildShot('shot-1', 'Shot 1')],
      [{
        shotId: 'shot-1',
        trackId: 'V2',
        clipIds: ['clip-1'],
        mode: 'images',
      }],
    ));
    expect(result.current).toEqual([{
      shotId: 'shot-1',
      shotName: 'Shot 1',
      rowId: 'V1',
      rowIndex: 0,
      start: 0,
      clipIds: ['clip-1'],
      children: [{ clipId: 'clip-1', offset: 0, duration: 2 }],
      color: getShotColor('shot-1'),
      mode: 'images',
    }]);
  });

  it('derives group start and children from the live row actions instead of legacy projection fields', () => {
    const rows: TimelineRow[] = [{
      id: 'V1',
      actions: [
        buildAction('clip-2', 1, 2),
        buildAction('clip-1', 3, 5),
      ],
    }];
    const { result } = renderHook(() => useShotGroups(
      rows,
      [buildShot('shot-1', 'Shot 1')],
      [{
        shotId: 'shot-1',
        trackId: 'V1',
        clipIds: ['clip-1', 'clip-2'],
        mode: 'images',
      }],
    ));

    expect(result.current).toEqual([{
      shotId: 'shot-1',
      shotName: 'Shot 1',
      rowId: 'V1',
      rowIndex: 0,
      start: 1,
      clipIds: ['clip-2', 'clip-1'],
      children: [
        { clipId: 'clip-2', offset: 0, duration: 1 },
        { clipId: 'clip-1', offset: 2, duration: 2 },
      ],
      color: getShotColor('shot-1'),
      mode: 'images',
    }]);
  });

  it('filters out pinned groups whose live row actions are missing', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [] }];
    const { result } = renderHook(() => useShotGroups(
      rows,
      [buildShot('shot-1', 'Shot 1')],
      [{
        shotId: 'shot-1',
        trackId: 'V1',
        clipIds: ['clip-1', 'clip-2'],
        mode: 'images',
      }],
    ));

    expect(result.current).toEqual([]);
  });
});
