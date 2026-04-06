import { describe, expect, it } from 'vitest';
import { serializeForDisk, validateSerializedConfig } from '@/tools/video-editor/lib/serialize';
import type { ResolvedTimelineConfig } from '@/tools/video-editor/types';

describe('video-editor serialization', () => {
  it('preserves exact source fields and strips resolved-only data', () => {
    const resolved = {
      output: {
        resolution: '1280x720',
        fps: 30,
        file: 'out.mp4',
        background_scale: 1,
      },
      tracks: [
        {
          id: 'V1',
          kind: 'visual',
          label: 'V1',
          scale: 1,
          fit: 'manual',
          opacity: 1,
          blendMode: 'normal',
          extra: 'strip-me',
        },
      ],
      clips: [
        {
          id: 'clip-1',
          at: 1,
          track: 'V1',
          clipType: 'hold',
          asset: 'asset-1',
          hold: 5,
          opacity: 0.8,
          transition: { type: 'crossfade', duration: 0.4 },
          continuous: { type: 'custom:glow', intensity: 0.6 },
          assetEntry: { file: 'foo.png', src: 'https://example.com/foo.png' },
          extra: 'strip-me',
        },
      ],
      registry: {
        'asset-1': { file: 'foo.png', src: 'https://example.com/foo.png' },
      },
    } as unknown as ResolvedTimelineConfig;

    const serialized = serializeForDisk(resolved, {
      glow: { code: 'export default function Effect(){ return null; }', category: 'continuous' },
    });

    expect(serialized.output.background_scale).toBe(1);
    expect(serialized.customEffects).toEqual({
      glow: { code: 'export default function Effect(){ return null; }', category: 'continuous' },
    });
    expect(serialized.clips[0]).not.toHaveProperty('assetEntry');
    expect(serialized.clips[0]).not.toHaveProperty('extra');
    expect(serialized.tracks?.[0]).not.toHaveProperty('extra');
    expect(() => validateSerializedConfig(serialized)).not.toThrow();
  });

  it('round-trips pinnedShotGroups through serializeForDisk and validation', () => {
    const resolved = {
      output: {
        resolution: '1280x720',
        fps: 30,
        file: 'out.mp4',
      },
      tracks: [
        {
          id: 'V1',
          kind: 'visual',
          label: 'V1',
        },
      ],
      clips: [
        {
          id: 'clip-1',
          at: 0,
          track: 'V1',
          clipType: 'hold',
          asset: 'asset-1',
          hold: 5,
        },
      ],
      registry: {
        'asset-1': { file: 'foo.png', src: 'https://example.com/foo.png' },
      },
    } as unknown as ResolvedTimelineConfig;

    const pinnedShotGroups = [
      {
        shotId: 'shot-1',
        trackId: 'V1',
        clipIds: ['clip-1'],
        mode: 'images' as const,
        imageClipSnapshot: [
          {
            clipId: 'clip-1',
            assetKey: 'asset-1',
            meta: {
              clipType: 'hold' as const,
              hold: 5,
            },
          },
        ],
      },
    ];

    const serialized = serializeForDisk(resolved, undefined, pinnedShotGroups);

    expect(() => validateSerializedConfig(serialized)).not.toThrow();
    expect(serialized.pinnedShotGroups).toEqual(pinnedShotGroups);
  });
});
