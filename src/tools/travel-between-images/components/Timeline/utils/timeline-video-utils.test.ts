import { describe, expect, it } from 'vitest';
import { calculateNewVideoPlacement, findTrailingVideoInfo } from './timeline-video-utils';

describe('timeline-video-utils', () => {
  it('starts new videos at frame zero when the timeline has no prior videos', () => {
    expect(calculateNewVideoPlacement(24, undefined, 80)).toEqual({
      start_frame: 0,
      end_frame: 24,
      lastVideoUpdate: undefined,
    });
  });

  it('clips the last video when the timeline is full and there is still safe room to trim', () => {
    expect(calculateNewVideoPlacement(15, [
      { path: 'one.mp4', start_frame: 0, end_frame: 40 },
      { path: 'two.mp4', start_frame: 40, end_frame: 80 },
    ], 75)).toEqual({
      start_frame: 70,
      end_frame: 85,
      lastVideoUpdate: {
        index: 1,
        newEndFrame: 70,
      },
    });
  });

  it('finds trailing videos from the FK column or legacy params and ignores incomplete outputs', () => {
    expect(findTrailingVideoInfo([
      { type: 'video/mp4', location: null, pair_shot_generation_id: 'shot-gen-9' },
      { type: 'video/mp4', location: 'https://cdn.example.com/fk.mp4', pair_shot_generation_id: 'shot-gen-9' },
    ], 'shot-gen-9')).toEqual({
      hasTrailing: true,
      videoUrl: 'https://cdn.example.com/fk.mp4',
    });

    expect(findTrailingVideoInfo([
      {
        type: 'video/webm',
        location: 'https://cdn.example.com/legacy.mp4',
        params: {
          individual_segment_params: {
            pair_shot_generation_id: 'shot-gen-7',
          },
        },
      },
    ], 'shot-gen-7')).toEqual({
      hasTrailing: true,
      videoUrl: 'https://cdn.example.com/legacy.mp4',
    });
  });

  it('returns a negative result when no completed trailing video matches the last image', () => {
    expect(findTrailingVideoInfo([
      { type: 'image/png', location: 'https://cdn.example.com/image.png', pair_shot_generation_id: 'shot-gen-1' },
      { type: 'video/mp4', location: 'https://cdn.example.com/other.mp4', pair_shot_generation_id: 'shot-gen-2' },
    ], 'shot-gen-1')).toEqual({
      hasTrailing: false,
      videoUrl: null,
    });
  });
});
