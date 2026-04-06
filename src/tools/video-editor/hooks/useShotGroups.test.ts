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

function buildShot(id: string, name: string, generationIds: string[]): Shot {
  return {
    id,
    name,
    images: generationIds.map((generationId, index) => ({
      id: `${id}-image-${index}`,
      generation_id: generationId,
    })),
  } as Shot;
}

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
  it('returns one group for adjacent clips in the same shot order on one track', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 1), buildAction('clip-2', 1, 2), buildAction('clip-3', 2, 3)] }];
    const { result } = renderHook(() => useShotGroups(
      rows,
      buildMeta('V1', { 'clip-1': 'asset-1', 'clip-2': 'asset-2', 'clip-3': 'asset-3' }),
      buildRegistry({ 'asset-1': 'gen-1', 'asset-2': 'gen-2', 'asset-3': 'gen-3' }),
      [buildShot('shot-1', 'Shot 1', ['gen-1', 'gen-2', 'gen-3'])],
    ));

    expect(result.current).toEqual([{
      shotId: 'shot-1',
      shotName: 'Shot 1',
      rowId: 'V1',
      rowIndex: 0,
      clipIds: ['clip-1', 'clip-2', 'clip-3'],
      color: getShotColor('shot-1'),
    }]);
  });

  it('does not group clips when the gap exceeds the threshold', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 1), buildAction('clip-2', 1.6, 2.6)] }];
    const { result } = renderHook(() => useShotGroups(
      rows,
      buildMeta('V1', { 'clip-1': 'asset-1', 'clip-2': 'asset-2' }),
      buildRegistry({ 'asset-1': 'gen-1', 'asset-2': 'gen-2' }),
      [buildShot('shot-1', 'Shot 1', ['gen-1', 'gen-2'])],
    ));

    expect(result.current).toEqual([]);
  });

  it('does not group clips when their order disagrees with the shot image order', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-2', 0, 1), buildAction('clip-1', 1, 2)] }];
    const { result } = renderHook(() => useShotGroups(
      rows,
      buildMeta('V1', { 'clip-1': 'asset-1', 'clip-2': 'asset-2' }),
      buildRegistry({ 'asset-1': 'gen-1', 'asset-2': 'gen-2' }),
      [buildShot('shot-1', 'Shot 1', ['gen-1', 'gen-2'])],
    ));

    expect(result.current).toEqual([]);
  });

  it('returns separate groups for different shots on the same track', () => {
    const rows: TimelineRow[] = [{
      id: 'V1',
      actions: [buildAction('clip-1', 0, 1), buildAction('clip-2', 1, 2), buildAction('clip-3', 3, 4), buildAction('clip-4', 4, 5)],
    }];
    const { result } = renderHook(() => useShotGroups(
      rows,
      buildMeta('V1', { 'clip-1': 'asset-1', 'clip-2': 'asset-2', 'clip-3': 'asset-3', 'clip-4': 'asset-4' }),
      buildRegistry({ 'asset-1': 'gen-1', 'asset-2': 'gen-2', 'asset-3': 'gen-3', 'asset-4': 'gen-4' }),
      [buildShot('shot-a', 'Shot A', ['gen-1', 'gen-2']), buildShot('shot-b', 'Shot B', ['gen-3', 'gen-4'])],
    ));

    expect(result.current.map((group) => ({ shotId: group.shotId, clipIds: group.clipIds }))).toEqual([
      { shotId: 'shot-a', clipIds: ['clip-1', 'clip-2'] },
      { shotId: 'shot-b', clipIds: ['clip-3', 'clip-4'] },
    ]);
  });

  it('does not create groups for a single matching clip', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 1)] }];
    const { result } = renderHook(() => useShotGroups(
      rows,
      buildMeta('V1', { 'clip-1': 'asset-1' }),
      buildRegistry({ 'asset-1': 'gen-1' }),
      [buildShot('shot-1', 'Shot 1', ['gen-1'])],
    ));

    expect(result.current).toEqual([]);
  });

  it('does not group clips across tracks even if they belong to the same shot', () => {
    const rows: TimelineRow[] = [
      { id: 'V1', actions: [buildAction('clip-1', 0, 1)] },
      { id: 'V2', actions: [buildAction('clip-2', 1, 2)] },
    ];
    const meta = {
      ...buildMeta('V1', { 'clip-1': 'asset-1' }),
      ...buildMeta('V2', { 'clip-2': 'asset-2' }),
    };
    const { result } = renderHook(() => useShotGroups(
      rows,
      meta,
      buildRegistry({ 'asset-1': 'gen-1', 'asset-2': 'gen-2' }),
      [buildShot('shot-1', 'Shot 1', ['gen-1', 'gen-2'])],
    ));

    expect(result.current).toEqual([]);
  });

  it('returns deterministic colors and different colors for distinct sample shot ids', () => {
    expect(getShotColor('shot-a')).toBe(getShotColor('shot-a'));
    expect(new Set(['shot-a', 'shot-b', 'shot-c'].map((shotId) => getShotColor(shotId))).size).toBe(3);
  });

  it('ignores clips without generation ids instead of throwing', () => {
    const rows: TimelineRow[] = [{ id: 'V1', actions: [buildAction('clip-1', 0, 1), buildAction('clip-2', 1, 2), buildAction('clip-3', 2, 3)] }];
    const { result } = renderHook(() => useShotGroups(
      rows,
      buildMeta('V1', { 'clip-1': 'asset-1', 'clip-2': 'asset-2', 'clip-3': 'asset-3' }),
      buildRegistry({ 'asset-1': 'gen-1', 'asset-2': undefined, 'asset-3': 'gen-3' }),
      [buildShot('shot-1', 'Shot 1', ['gen-1', 'gen-2', 'gen-3'])],
    ));

    expect(result.current).toEqual([]);
  });
});
