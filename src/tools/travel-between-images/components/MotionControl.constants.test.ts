import { describe, expect, it } from 'vitest';
import { DEFAULT_PHASE_CONFIG, DEFAULT_VACE_PHASE_CONFIG } from '../settings';
import {
  BUILTIN_DEFAULT_I2V_ID,
  BUILTIN_DEFAULT_VACE_ID,
  BUILTIN_I2V_PRESET,
  BUILTIN_VACE_PRESET,
  FEATURED_PRESET_IDS,
} from './MotionControl.constants';

describe('MotionControl.constants', () => {
  it('exports builtin presets that stay aligned with the shared default configs', () => {
    expect(BUILTIN_DEFAULT_I2V_ID).toBe('__builtin_default_i2v__');
    expect(BUILTIN_DEFAULT_VACE_ID).toBe('__builtin_default_vace__');

    expect(BUILTIN_I2V_PRESET).toEqual({
      id: BUILTIN_DEFAULT_I2V_ID,
      metadata: {
        name: 'Basic',
        description: 'Standard I2V generation',
        phaseConfig: DEFAULT_PHASE_CONFIG,
      },
    });

    expect(BUILTIN_VACE_PRESET).toEqual({
      id: BUILTIN_DEFAULT_VACE_ID,
      metadata: {
        name: 'Basic',
        description: 'Standard VACE generation with structure video',
        phaseConfig: DEFAULT_VACE_PHASE_CONFIG,
      },
    });
  });

  it('keeps the featured preset allowlist stable', () => {
    expect(FEATURED_PRESET_IDS).toEqual([
      'e1aad8bf-add9-4d7b-883b-d67d424028c4',
      '18b879a5-1251-41dc-b263-613358ced541',
    ]);
  });
});
