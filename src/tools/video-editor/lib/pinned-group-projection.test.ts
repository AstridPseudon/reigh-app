import { describe, expect, it } from 'vitest';
import {
  categorizeSelection,
  findEnclosingPinnedGroup,
  orderClipIdsByAt,
} from '@/tools/video-editor/lib/pinned-group-projection';
import type { TimelineConfig } from '@/tools/video-editor/types';
import type { TimelineRow } from '@/tools/video-editor/types/timeline-canvas';

const buildConfig = (): TimelineConfig => ({
  output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' },
  tracks: [
    { id: 'V1', kind: 'visual', label: 'V1' },
    { id: 'V2', kind: 'visual', label: 'V2' },
  ],
  clips: [
    { id: 'clip-a', at: 0, track: 'V1', clipType: 'hold', hold: 1 },
    { id: 'clip-b', at: 1, track: 'V1', clipType: 'hold', hold: 2 },
    { id: 'clip-c', at: 3, track: 'V1', clipType: 'hold', hold: 1 },
    { id: 'free-1', at: 0, track: 'V2', clipType: 'hold', hold: 5 },
  ],
  pinnedShotGroups: [
    {
      shotId: 'shot-1',
      trackId: 'V1',
      clipIds: ['clip-a', 'clip-b', 'clip-c'],
      mode: 'images',
    },
  ],
});

describe('findEnclosingPinnedGroup', () => {
  it('returns the group containing a clip', () => {
    const config = buildConfig();
    const result = findEnclosingPinnedGroup(config, 'clip-b');
    expect(result).not.toBeNull();
    expect(result?.group.shotId).toBe('shot-1');
    expect(result?.groupKey).toEqual({ shotId: 'shot-1', trackId: 'V1' });
    expect(result?.index).toBe(0);
  });

  it('returns null when no group contains the clip', () => {
    expect(findEnclosingPinnedGroup(buildConfig(), 'free-1')).toBeNull();
    expect(findEnclosingPinnedGroup(buildConfig(), 'missing')).toBeNull();
  });

  it('handles configs without pinnedShotGroups', () => {
    const config: TimelineConfig = {
      output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' },
      tracks: [],
      clips: [],
    };
    expect(findEnclosingPinnedGroup(config, 'anything')).toBeNull();
  });
});

describe('categorizeSelection', () => {
  it('separates free clips from enclosing groups', () => {
    const result = categorizeSelection(['clip-a', 'free-1'], buildConfig());
    expect(result.freeClipIds).toEqual(['free-1']);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].groupKey).toEqual({ shotId: 'shot-1', trackId: 'V1' });
    // Entire group membership, not just the clicked clip.
    expect(result.groups[0].clipIds).toEqual(['clip-a', 'clip-b', 'clip-c']);
  });

  it('deduplicates groups when multiple members are selected', () => {
    const result = categorizeSelection(['clip-a', 'clip-b'], buildConfig());
    expect(result.freeClipIds).toEqual([]);
    expect(result.groups).toHaveLength(1);
  });

  it('handles an all-free selection', () => {
    const result = categorizeSelection(['free-1'], buildConfig());
    expect(result.freeClipIds).toEqual(['free-1']);
    expect(result.groups).toEqual([]);
  });
});

describe('orderClipIdsByAt', () => {
  it('orders ids by live `at` from clips[]', () => {
    const config = buildConfig();
    const reordered = orderClipIdsByAt(['clip-c', 'clip-a', 'clip-b'], { clips: config.clips });
    expect(reordered).toEqual(['clip-a', 'clip-b', 'clip-c']);
  });

  it('orders ids by live `at` from rows', () => {
    const rows: TimelineRow[] = [
      {
        id: 'V1',
        actions: [
          { id: 'clip-a', start: 5, end: 6, effectId: 'effect-clip-a' },
          { id: 'clip-b', start: 0, end: 1, effectId: 'effect-clip-b' },
          { id: 'clip-c', start: 2, end: 3, effectId: 'effect-clip-c' },
        ],
      },
    ];
    const reordered = orderClipIdsByAt(['clip-a', 'clip-b', 'clip-c'], { rows });
    expect(reordered).toEqual(['clip-b', 'clip-c', 'clip-a']);
  });

  it('falls back to original order for unknown ids', () => {
    const reordered = orderClipIdsByAt(['clip-a', 'missing', 'clip-b'], { clips: buildConfig().clips });
    expect(reordered).toEqual(['clip-a', 'clip-b', 'missing']);
  });

  it('uses stable original order when two clips share the same `at`', () => {
    const clips: TimelineConfig['clips'] = [
      { id: 'x', at: 1, track: 'V1', clipType: 'hold', hold: 1 },
      { id: 'y', at: 1, track: 'V1', clipType: 'hold', hold: 1 },
    ];
    expect(orderClipIdsByAt(['x', 'y'], { clips })).toEqual(['x', 'y']);
    expect(orderClipIdsByAt(['y', 'x'], { clips })).toEqual(['y', 'x']);
  });
});
