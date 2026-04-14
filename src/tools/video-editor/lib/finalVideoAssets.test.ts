import { describe, expect, it } from 'vitest';
import { getDurationSecondsFromFinalVideoParams } from '@/tools/video-editor/lib/finalVideoAssets';

describe('getDurationSecondsFromFinalVideoParams', () => {
  it('reads direct duration_seconds from root params', () => {
    expect(getDurationSecondsFromFinalVideoParams({
      duration_seconds: 4.25,
    })).toBe(4.25);
  });

  it('prefers trimmed duration over original duration style fields', () => {
    expect(getDurationSecondsFromFinalVideoParams({
      original_duration: 9,
      trimmed_duration: 3.5,
    })).toBe(3.5);
  });

  it('reads nested metadata from orchestrator details', () => {
    expect(getDurationSecondsFromFinalVideoParams({
      orchestrator_details: {
        metadata: {
          duration_seconds: 6,
        },
      },
    })).toBe(6);
  });

  it('derives seconds from total_frames and frame_rate when needed', () => {
    expect(getDurationSecondsFromFinalVideoParams({
      full_orchestrator_payload: {
        total_frames: 96,
        frame_rate: 24,
      },
    })).toBe(4);
  });

  it('supports numeric strings from persisted JSON', () => {
    expect(getDurationSecondsFromFinalVideoParams({
      metadata: {
        duration_seconds: '5.75',
      },
    })).toBe(5.75);
  });

  it('returns null when params do not contain a usable duration', () => {
    expect(getDurationSecondsFromFinalVideoParams({
      prompt: 'no duration here',
    })).toBeNull();
  });
});
