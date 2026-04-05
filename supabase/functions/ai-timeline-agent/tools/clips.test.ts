import { describe, expect, it } from 'vitest';
import { resolveClipGenerationIds } from './clips.ts';

describe('resolveClipGenerationIds', () => {
  it('falls back to generation_id when the clip lookup misses', () => {
    const result = resolveClipGenerationIds(
      [
        { clip_id: 'clip-1', generation_id: 'gen-direct-1' },
        { clip_id: 'gallery-gen-2', generation_id: 'gen-direct-2' },
      ],
      {
        assets: {
          'asset-1': {
            file: 'https://example.com/image.png',
            generationId: 'gen-from-timeline',
          },
        },
      },
      {
        output: { file: 'out.mp4', fps: 30, resolution: '1920x1080' },
        clips: [
          {
            id: 'clip-1',
            asset: 'asset-1',
            at: 0,
            track: 'V1',
            clipType: 'hold',
            hold: 5,
          },
        ],
        tracks: [],
      },
    );

    expect(result).toEqual(['gen-from-timeline', 'gen-direct-2']);
  });
});
