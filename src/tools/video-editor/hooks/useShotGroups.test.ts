// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Shot } from '@/domains/generation/types';
import type { ClipMeta } from '@/tools/video-editor/lib/timeline-data';
import type { AssetRegistry } from '@/tools/video-editor/types';
import type { TimelineAction, TimelineRow } from '@/tools/video-editor/types/timeline-canvas';
import { getShotColor, useShotGroups } from './useShotGroups';

function buildAction(id: string, start: number, end: number): TimelineAction {
  return { id, start, end, effectId: `effect-${id}` };
}

function buildShot(id: string, name: string, generationIds: string[] = []): Shot {
  return {
    id,
    name,
    images: generationIds.map((generationId, index) => ({
      id: `${id}-image-${index}`,
      generation_id: generationId,
      type: 'image',
      timeline_frame: index * 50,
    })),
  } as Shot;
}

const EMPTY_META: Record<string, ClipMeta> = {};
const EMPTY_REGISTRY: AssetRegistry = { assets: {} };

function buildMeta(trackId: string, assetMap: Record<string, string | undefined>): Record<string, ClipMeta> {
  return Object.fromEntries(
    Object.entries(assetMap).map(([clipId, asset]) => [clipId, { track: trackId, asset, clipType: 'media' }]),
  );
}

function buildRegistry(generationMap: Record<string, string | undefined>): AssetRegistry {
  return {
    assets: Object.fromEntries(
      Object.entries(generationMap).map(([assetId, generationId]) => [assetId, { file: `${assetId}.png`, generationId }]),
    ),
  };
}

describe('useShotGroups', () => {
  it('returns deterministic colors and different colors for distinct sample shot ids', () => {
    expect(getShotColor('shot-a')).toBe(getShotColor('shot-a'));
    expect(new Set(['shot-a', 'shot-b', 'shot-c'].map((shotId) => getShotColor(shotId))).size).toBe(3);
  });

  it('returns empty array when pinnedShotGroups is undefined', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 1)] }];
    const { result } = renderHook(() => useShotGroups(rows, EMPTY_META, EMPTY_REGISTRY, [buildShot('shot-1', 'Shot 1')]));
    expect(result.current).toEqual([]);
  });

  it('returns pinned groups', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 2)] }];
    const { result } = renderHook(() => useShotGroups(
      rows, EMPTY_META, EMPTY_REGISTRY,
      [buildShot('shot-1', 'Shot 1')],
      [{ shotId: 'shot-1', trackId: 'V1', clipIds: ['clip-1'], mode: 'video' }],
    ));

    expect(result.current).toEqual([{
      shotId: 'shot-1',
      shotName: 'Shot 1',
      rowId: 'V1',
      rowIndex: 0,
      clipIds: ['clip-1'],
      color: getShotColor('shot-1'),
      isPinned: true,
      mode: 'video',
    }]);
  });

  it('filters out pinned groups whose trackId does not match any row', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 2)] }];
    const { result } = renderHook(() => useShotGroups(
      rows, EMPTY_META, EMPTY_REGISTRY,
      [buildShot('shot-1', 'Shot 1')],
      [{ shotId: 'shot-1', trackId: 'V2', clipIds: ['clip-1'], mode: 'images' }],
    ));
    expect(result.current).toEqual([]);
  });

  it('filters out dead clip ids that are not present in the row actions', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 1), buildAction('clip-2', 1, 2)] }];
    const { result } = renderHook(() => useShotGroups(
      rows, EMPTY_META, EMPTY_REGISTRY,
      [buildShot('shot-1', 'Shot 1')],
      [{ shotId: 'shot-1', trackId: 'V1', clipIds: ['clip-1', 'clip-ghost', 'clip-2'], mode: 'images' }],
    ));

    expect(result.current).toEqual([{
      shotId: 'shot-1',
      shotName: 'Shot 1',
      rowId: 'V1',
      rowIndex: 0,
      clipIds: ['clip-1', 'clip-2'],
      color: getShotColor('shot-1'),
      isPinned: true,
      mode: 'images',
    }]);
  });

  it('infers groups for unambiguous consecutive images', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 1), buildAction('clip-2', 1, 2)] }];
    const meta = buildMeta('V1', { 'clip-1': 'asset-a', 'clip-2': 'asset-b' });
    const registry = buildRegistry({ 'asset-a': 'gen-a', 'asset-b': 'gen-b' });
    const shots = [buildShot('shot-1', 'Shot 1', ['gen-a', 'gen-b'])];
    const { result } = renderHook(() => useShotGroups(rows, meta, registry, shots));

    expect(result.current).toEqual([{
      shotId: 'shot-1',
      shotName: 'Shot 1',
      rowId: 'V1',
      rowIndex: 0,
      clipIds: ['clip-1', 'clip-2'],
      color: getShotColor('shot-1'),
      isPinned: false,
    }]);
  });

  it('does not infer groups for ambiguous generations (in multiple shots)', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 1), buildAction('clip-2', 1, 2)] }];
    const meta = buildMeta('V1', { 'clip-1': 'asset-a', 'clip-2': 'asset-b' });
    const registry = buildRegistry({ 'asset-a': 'gen-a', 'asset-b': 'gen-b' });
    // gen-a is in both shots — ambiguous
    const shots = [
      buildShot('shot-1', 'Shot 1', ['gen-a', 'gen-b']),
      buildShot('shot-2', 'Shot 2', ['gen-a']),
    ];
    const { result } = renderHook(() => useShotGroups(rows, meta, registry, shots));

    // gen-a is ambiguous (in 2 shots), gen-b is unambiguous but alone — no group of 2+
    expect(result.current).toEqual([]);
  });

  it('skips video clips in inference', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 1), buildAction('clip-2', 1, 2)] }];
    const meta = buildMeta('V1', { 'clip-1': 'asset-a', 'clip-2': 'asset-b' });
    const registry: AssetRegistry = {
      assets: {
        'asset-a': { file: 'a.png', generationId: 'gen-a' },
        'asset-b': { file: 'b.mp4', generationId: 'gen-b', type: 'video/mp4' },
      },
    };
    const shots = [buildShot('shot-1', 'Shot 1', ['gen-a', 'gen-b'])];
    const { result } = renderHook(() => useShotGroups(rows, meta, registry, shots));

    // clip-2 is video, so only clip-1 matches — not enough for a group
    expect(result.current).toEqual([]);
  });
});
