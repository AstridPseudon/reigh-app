import { describe, it, expect } from 'vitest';
import { TOOL_IDS } from '@/shared/lib/tooling/toolIds';
import { DEFAULT_STEERABLE_MOTION_SETTINGS } from '@/shared/types/steerableMotion';
import {
  normalizeVideoTravelSettings,
  videoTravelSettings,
} from './settings';

describe('videoTravelSettings', () => {
  it('targets the travel-between-images tool and shot scope', () => {
    expect(videoTravelSettings.id).toBe(TOOL_IDS.TRAVEL_BETWEEN_IMAGES);
    expect(videoTravelSettings.scope).toEqual(['shot']);
  });

  it('provides stable defaults for timeline generation flow', () => {
    expect(videoTravelSettings.defaults.generationMode).toBe('timeline');
    expect(videoTravelSettings.defaults.batchVideoFrames).toBe(61);
    expect(videoTravelSettings.defaults.batchVideoSteps).toBe(6);
    expect(videoTravelSettings.defaults.generationTypeMode).toBe('i2v');
    expect(videoTravelSettings.defaults.steerableMotionSettings).toEqual(DEFAULT_STEERABLE_MOTION_SETTINGS);
  });

  it('starts with clean content defaults for a new shot', () => {
    expect(videoTravelSettings.defaults.prompt).toBe('');
    expect(videoTravelSettings.defaults.negativePrompt).toBe('');
    expect(videoTravelSettings.defaults.pairConfigs).toEqual([]);
    expect(videoTravelSettings.defaults.shotImageIds).toEqual([]);
    expect(videoTravelSettings.defaults.loras).toEqual([]);
  });

  it('normalizes persisted settings into the canonical runtime shape', () => {
    const normalized = normalizeVideoTravelSettings({
      prompt: 'Travel prompt',
      batchVideoFrames: 49,
      steerableMotionSettings: { seed: 77 },
      pairConfigs: [
        { id: 'pair-1', prompt: 'pan', frames: 17, negativePrompt: 'blur', context: 4 },
        { prompt: 'missing-id' },
      ],
      shotImageIds: ['image-1', 2],
      loras: [
        { id: 'lora-1', name: 'Cinematic', path: '/tmp/cinematic', strength: 0.8 },
        { id: 'broken' },
      ],
      structure_video_path: 'https://example.com/guide.mp4',
      structure_video_motion_strength: 1.8,
      structure_video_type: 'flow',
    });

    expect(normalized.prompt).toBe('Travel prompt');
    expect(normalized.batchVideoFrames).toBe(49);
    expect(normalized.steerableMotionSettings.seed).toBe(77);
    expect(normalized.pairConfigs).toEqual([
      { id: 'pair-1', prompt: 'pan', frames: 17, negativePrompt: 'blur', context: 4 },
    ]);
    expect(normalized.shotImageIds).toEqual(['image-1']);
    expect(normalized.loras).toEqual([
      { id: 'lora-1', name: 'Cinematic', path: '/tmp/cinematic', strength: 0.8 },
    ]);
    expect(normalized.structureVideo).toEqual(expect.objectContaining({
      path: 'https://example.com/guide.mp4',
      motionStrength: 1.8,
      structureType: 'flow',
    }));
  });

  it('falls back to clean defaults for invalid persisted payloads', () => {
    const normalized = normalizeVideoTravelSettings('not-an-object');

    expect(normalized).toEqual(expect.objectContaining({
      prompt: '',
      generationMode: 'timeline',
      batchVideoFrames: 61,
      shotImageIds: [],
      loras: [],
    }));
  });
});
