import { afterEach, describe, expect, it, vi } from 'vitest';
import * as editorUtils from '@/tools/video-editor/lib/editor-utils';
import {
  buildAugmentedData,
  buildConfigFromDragResult,
  planMultiDragMoves,
} from '@/tools/video-editor/lib/multi-drag-utils';
import type { ClipMeta, TimelineData } from '@/tools/video-editor/lib/timeline-data';
import type { TrackDefinition } from '@/tools/video-editor/types';
import type { TimelineRow } from '@/tools/video-editor/types/timeline-canvas';

const output = { resolution: '1920x1080', fps: 30, file: 'out.mp4' };

const makeTrack = (id: string, kind: TrackDefinition['kind'] = 'visual'): TrackDefinition => ({
  id,
  kind,
  label: id,
  scale: 1,
  fit: kind === 'visual' ? 'manual' : 'contain',
  opacity: 1,
  blendMode: 'normal',
});

const makeAction = (id: string, start: number, end: number) => ({
  id,
  start,
  end,
  effectId: `effect-${id}`,
});

function makeTimelineData(
  tracks: TrackDefinition[],
  rows: TimelineRow[],
  meta: Record<string, ClipMeta>,
): TimelineData {
  const clips = rows.flatMap((row) => {
    return row.actions.map((action) => {
      const clipMeta = meta[action.id] ?? { track: row.id };
      const duration = action.end - action.start;
      if (typeof clipMeta.hold === 'number') {
        return {
          id: action.id,
          at: action.start,
          track: row.id,
          clipType: clipMeta.clipType ?? 'hold',
          hold: duration,
        };
      }

      return {
        id: action.id,
        at: action.start,
        track: row.id,
        clipType: clipMeta.clipType ?? 'media',
        from: clipMeta.from ?? 0,
        to: clipMeta.to ?? duration,
        speed: clipMeta.speed,
      };
    });
  });

  const clipOrder = Object.fromEntries(rows.map((row) => [row.id, row.actions.map((action) => action.id)]));

  return {
    config: { output, tracks, clips },
    configVersion: 1,
    registry: { assets: {} },
    resolvedConfig: { output, tracks, clips, registry: {} },
    rows,
    meta,
    effects: {},
    assetMap: {},
    output,
    tracks,
    clipOrder,
    signature: 'sig-1',
    stableSignature: 'stable-1',
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildAugmentedData', () => {
  it('inserts a new track and empty row at the top', () => {
    const tracks = [makeTrack('V1'), makeTrack('V2')];
    const rows: TimelineRow[] = [
      { id: 'V1', actions: [makeAction('clip-a', 0, 2)] },
      { id: 'V2', actions: [makeAction('clip-b', 3, 5)] },
    ];
    const meta: Record<string, ClipMeta> = {
      'clip-a': { track: 'V1', clipType: 'hold', hold: 2 },
      'clip-b': { track: 'V2', clipType: 'hold', hold: 2 },
    };
    const data = makeTimelineData(tracks, rows, meta);

    const result = buildAugmentedData(data, 'visual', true);

    expect(result).not.toBeNull();
    expect(result?.newTrackId).toBe('V3');
    expect(result?.augmented.tracks.map((track) => track.id)).toEqual(['V3', 'V1', 'V2']);
    expect(result?.augmented.rows.map((row) => row.id)).toEqual(['V3', 'V1', 'V2']);
    expect(result?.augmented.rows[0]).toEqual({ id: 'V3', actions: [] });
    expect(result?.augmented.clipOrder).toMatchObject({
      V1: ['clip-a'],
      V2: ['clip-b'],
      V3: [],
    });
  });

  it('inserts a new track and empty row at the bottom', () => {
    const tracks = [makeTrack('V1'), makeTrack('V2')];
    const rows: TimelineRow[] = [
      { id: 'V1', actions: [makeAction('clip-a', 0, 2)] },
      { id: 'V2', actions: [makeAction('clip-b', 3, 5)] },
    ];
    const meta: Record<string, ClipMeta> = {
      'clip-a': { track: 'V1', clipType: 'hold', hold: 2 },
      'clip-b': { track: 'V2', clipType: 'hold', hold: 2 },
    };
    const data = makeTimelineData(tracks, rows, meta);

    const result = buildAugmentedData(data, 'visual', false);

    expect(result).not.toBeNull();
    expect(result?.newTrackId).toBe('V3');
    expect(result?.augmented.tracks.map((track) => track.id)).toEqual(['V1', 'V2', 'V3']);
    expect(result?.augmented.rows.map((row) => row.id)).toEqual(['V1', 'V2', 'V3']);
    expect(result?.augmented.rows.at(-1)).toEqual({ id: 'V3', actions: [] });
  });

  it('returns null when addTrack does not produce a new track', () => {
    const tracks = [makeTrack('V1')];
    const rows: TimelineRow[] = [{ id: 'V1', actions: [makeAction('clip-a', 0, 2)] }];
    const meta: Record<string, ClipMeta> = {
      'clip-a': { track: 'V1', clipType: 'hold', hold: 2 },
    };
    const data = makeTimelineData(tracks, rows, meta);

    vi.spyOn(editorUtils, 'addTrack').mockReturnValue(data.resolvedConfig);

    expect(buildAugmentedData(data, 'visual', true)).toBeNull();
  });
});

describe('buildConfigFromDragResult', () => {
  it('uses merged meta updates when serializing overlap-adjusted timing fields', () => {
    const tracks = [makeTrack('V1'), makeTrack('V2')];
    const rows: TimelineRow[] = [
      {
        id: 'V1',
        actions: [makeAction('clip-b', 5, 7)],
      },
      {
        id: 'V2',
        actions: [makeAction('clip-a', 2, 4)],
      },
    ];
    const meta: Record<string, ClipMeta> = {
      'clip-a': { track: 'V1', clipType: 'media', from: 0, to: 2, speed: 1 },
      'clip-b': { track: 'V1', clipType: 'media', from: 1, to: 3, speed: 1 },
    };
    const baseData = makeTimelineData(
      tracks,
      [
        { id: 'V1', actions: [makeAction('clip-a', 0, 2), makeAction('clip-b', 5, 7)] },
        { id: 'V2', actions: [] },
      ],
      meta,
    );

    const result = buildConfigFromDragResult(
      baseData.resolvedConfig,
      baseData.meta,
      rows,
      {
        'clip-a': { track: 'V2', from: 1.25, to: 3.25 },
      },
    );

    expect(result.clips.find((clip) => clip.id === 'clip-a')).toMatchObject({
      id: 'clip-a',
      at: 2,
      track: 'V2',
      from: 1.25,
      to: 3.25,
    });
    expect(result.clips.find((clip) => clip.id === 'clip-b')).toMatchObject({
      id: 'clip-b',
      at: 5,
      track: 'V1',
      from: 1,
      to: 3,
    });
  });
});

describe('planMultiDragMoves on augmented data', () => {
  it('moves the anchor to the new track and preserves relative row offsets for secondary clips', () => {
    const tracks = [makeTrack('V1'), makeTrack('V2')];
    const rows: TimelineRow[] = [
      { id: 'V1', actions: [makeAction('clip-a', 0, 2)] },
      { id: 'V2', actions: [makeAction('clip-b', 3, 5)] },
    ];
    const meta: Record<string, ClipMeta> = {
      'clip-a': { track: 'V1', clipType: 'hold', hold: 2 },
      'clip-b': { track: 'V2', clipType: 'hold', hold: 2 },
    };
    const data = makeTimelineData(tracks, rows, meta);
    const augmentedResult = buildAugmentedData(data, 'visual', true);

    expect(augmentedResult).not.toBeNull();

    const result = planMultiDragMoves(
      augmentedResult!.augmented,
      [
        { clipId: 'clip-a', rowId: 'V1', deltaTime: 0, initialStart: 0, initialEnd: 2 },
        { clipId: 'clip-b', rowId: 'V2', deltaTime: 3, initialStart: 3, initialEnd: 5 },
      ],
      'clip-a',
      augmentedResult!.newTrackId,
      'V1',
      1,
    );

    expect(result).toEqual({
      canMove: true,
      moves: [
        { clipId: 'clip-a', sourceRowId: 'V1', targetRowId: 'V3', newStart: 1 },
        { clipId: 'clip-b', sourceRowId: 'V2', targetRowId: 'V1', newStart: 4 },
      ],
    });
  });

  it('rejects the move when a secondary clip would require another new track', () => {
    const tracks = [makeTrack('V1'), makeTrack('V2'), makeTrack('V3')];
    const rows: TimelineRow[] = [
      { id: 'V1', actions: [makeAction('clip-top', 0, 2)] },
      { id: 'V2', actions: [makeAction('clip-anchor', 2, 4)] },
      { id: 'V3', actions: [] },
    ];
    const meta: Record<string, ClipMeta> = {
      'clip-top': { track: 'V1', clipType: 'hold', hold: 2 },
      'clip-anchor': { track: 'V2', clipType: 'hold', hold: 2 },
    };
    const data = makeTimelineData(tracks, rows, meta);
    const augmentedResult = buildAugmentedData(data, 'visual', true);

    expect(augmentedResult).not.toBeNull();

    const result = planMultiDragMoves(
      augmentedResult!.augmented,
      [
        { clipId: 'clip-anchor', rowId: 'V2', deltaTime: 0, initialStart: 2, initialEnd: 4 },
        { clipId: 'clip-top', rowId: 'V1', deltaTime: -2, initialStart: 0, initialEnd: 2 },
      ],
      'clip-anchor',
      augmentedResult!.newTrackId,
      'V2',
      0,
    );

    expect(result).toEqual({ canMove: false, moves: [] });
  });
});
