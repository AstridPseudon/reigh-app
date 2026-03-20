import { describe, expect, it } from 'vitest';
import { checkBoundaryFreshness } from './joinSegmentFreshness';

describe('joinSegmentFreshness', () => {
  it('allows crossfade when the successor still points at the predecessor primary variant', () => {
    expect(checkBoundaryFreshness('variant-a', {
      continuation_predecessor_variant_id: 'variant-a',
      continuation_config: {
        overlap_frames: 24,
      },
    })).toEqual({
      canCrossfade: true,
      overlapFrames: 24,
    });
  });

  it('falls back to legacy overlap metadata when continuation_config is absent', () => {
    expect(checkBoundaryFreshness('variant-a', {
      continuation_predecessor_variant_id: 'variant-b',
      frame_overlap_from_previous: 10,
    })).toEqual({
      canCrossfade: false,
      overlapFrames: 10,
    });
  });

  it('rejects crossfade when overlap metadata is missing', () => {
    expect(checkBoundaryFreshness('variant-a', {
      continuation_predecessor_variant_id: 'variant-a',
    })).toEqual({
      canCrossfade: false,
      overlapFrames: 0,
    });
  });
});
