import { describe, expect, it } from 'vitest';
import { asMotionMode, asPhaseConfig } from './segmentTypeCoercers';

const validPhaseConfig = {
  num_phases: 2,
  steps_per_phase: [3, 3],
  flow_shift: 5,
  sample_solver: 'euler',
  model_switch_phase: 1,
  phases: [
    {
      phase: 1,
      guidance_scale: 1,
      loras: [],
    },
    {
      phase: 2,
      guidance_scale: 1,
      loras: [],
    },
  ],
};

describe('segmentTypeCoercers', () => {
  it('accepts only the supported motion modes', () => {
    expect(asMotionMode('basic')).toBe('basic');
    expect(asMotionMode('presets')).toBe('presets');
    expect(asMotionMode('advanced')).toBe('advanced');
    expect(asMotionMode('scene')).toBeUndefined();
    expect(asMotionMode(null)).toBeUndefined();
  });

  it('returns a phase config only for structurally valid candidates', () => {
    expect(asPhaseConfig(validPhaseConfig)).toEqual(validPhaseConfig);
    expect(asPhaseConfig({
      ...validPhaseConfig,
      steps_per_phase: ['bad'],
    })).toBeUndefined();
    expect(asPhaseConfig(null)).toBeUndefined();
    expect(asPhaseConfig(['not-a-record'])).toBeUndefined();
  });
});
