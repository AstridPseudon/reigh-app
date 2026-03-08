import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BUILTIN_I2V_PRESET,
  BUILTIN_VACE_PRESET,
  SEGMENT_I2V_FEATURED_PRESET_IDS,
  SEGMENT_VACE_FEATURED_PRESET_IDS,
} from '../../segmentSettingsUtils';
import { useAdvancedSettingsState } from '../useAdvancedSettingsState';

function buildSettings(overrides: Record<string, unknown> = {}) {
  return {
    prompt: '',
    negativePrompt: '',
    motionMode: 'basic',
    amountOfMotion: 50,
    phaseConfig: undefined,
    selectedPhasePresetId: null,
    loras: [],
    numFrames: 61,
    randomSeed: true,
    makePrimaryVariant: false,
    ...overrides,
  };
}

describe('useAdvancedSettingsState', () => {
  it('uses i2v generation mode and i2v preset defaults when model is not vace', () => {
    const { result } = renderHook(() =>
      useAdvancedSettingsState({
        modelName: 'Wan 2.2 I2V',
        settings: buildSettings() as never,
      }),
    );

    expect(result.current.generationMode).toBe('i2v');
    expect(result.current.builtinPreset).toBe(BUILTIN_I2V_PRESET);
    expect(result.current.featuredPresetIds).toEqual(SEGMENT_I2V_FEATURED_PRESET_IDS);
  });

  it('switches to vace mode/presets and supports lora modal toggling', () => {
    const { result } = renderHook(() =>
      useAdvancedSettingsState({
        modelName: 'WAN VACE Model',
        settings: buildSettings() as never,
      }),
    );

    expect(result.current.generationMode).toBe('vace');
    expect(result.current.builtinPreset).toBe(BUILTIN_VACE_PRESET);
    expect(result.current.featuredPresetIds).toEqual(SEGMENT_VACE_FEATURED_PRESET_IDS);
    expect(result.current.isLoraModalOpen).toBe(false);

    act(() => {
      result.current.openLoraModal();
    });
    expect(result.current.isLoraModalOpen).toBe(true);

    act(() => {
      result.current.closeLoraModal();
    });
    expect(result.current.isLoraModalOpen).toBe(false);
  });

  it('derives effective loras from settings first, then shot defaults', () => {
    const { result: withLocalLoras } = renderHook(() =>
      useAdvancedSettingsState({
        modelName: 'i2v',
        settings: buildSettings({ loras: [{ id: 'local', name: 'Local', path: '/local', strength: 0.3 }] }) as never,
        shotDefaults: { loras: [{ id: 'default', name: 'Default', path: '/default', strength: 0.7 }] } as never,
      }),
    );

    expect(withLocalLoras.current.effectiveLoras).toEqual([
      { id: 'local', name: 'Local', path: '/local', strength: 0.3 },
    ]);

    const { result: withDefaultLoras } = renderHook(() =>
      useAdvancedSettingsState({
        modelName: 'i2v',
        settings: buildSettings({ loras: undefined }) as never,
        shotDefaults: { loras: [{ id: 'default', name: 'Default', path: '/default', strength: 0.7 }] } as never,
      }),
    );

    expect(withDefaultLoras.current.effectiveLoras).toEqual([
      { id: 'default', name: 'Default', path: '/default', strength: 0.7 },
    ]);
  });

  it('computes motion and lora default usage flags correctly', () => {
    const { result } = renderHook(() =>
      useAdvancedSettingsState({
        modelName: 'i2v',
        settings: buildSettings({ motionMode: undefined, phaseConfig: undefined, loras: undefined }) as never,
        shotDefaults: {
          motionMode: 'advanced',
          phaseConfig: { flow_shift: 5 },
          loras: [{ id: 'default', name: 'Default', path: '/default', strength: 0.7 }],
        } as never,
      }),
    );

    expect(result.current.isUsingMotionDefaults).toBe(true);
    expect(result.current.isUsingLorasDefault).toBe(true);
  });
});
