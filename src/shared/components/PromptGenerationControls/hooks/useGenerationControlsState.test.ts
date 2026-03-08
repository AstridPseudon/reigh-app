import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGenerationControlsState } from './useGenerationControlsState';

describe('useGenerationControlsState', () => {
  it('starts with defaults and emits composed values', () => {
    const onValuesChange = vi.fn();

    const { result } = renderHook(() =>
      useGenerationControlsState({
        initialValues: undefined,
        onValuesChange,
        remixMode: false,
      }),
    );

    expect(result.current.overallPromptText).toBe('');
    expect(result.current.remixPromptText).toBe('More like this');
    expect(result.current.numberToGenerate).toBe(16);
    expect(result.current.includeExistingContext).toBe(true);
    expect(result.current.replaceCurrentPrompts).toBe(false);
    expect(result.current.temperature).toBe(0.8);

    act(() => {
      result.current.emitChange();
    });

    expect(onValuesChange).toHaveBeenCalledWith(
      expect.objectContaining({
        addSummary: true,
        remixPromptText: 'More like this',
        temperature: 0.8,
      }),
    );
  });

  it('hydrates from initial values and emits hydrated payload once', async () => {
    const onValuesChange = vi.fn();

    const { result } = renderHook(() =>
      useGenerationControlsState({
        initialValues: {
          overallPromptText: 'seed prompt',
          remixPromptText: 'remix',
          rulesToRememberText: 'rules',
          numberToGenerate: 5,
          includeExistingContext: false,
          replaceCurrentPrompts: true,
          temperature: 1.0,
          showAdvanced: true,
        },
        onValuesChange,
        remixMode: false,
      }),
    );

    await waitFor(() => {
      expect(onValuesChange).toHaveBeenCalledWith(
        expect.objectContaining({
          overallPromptText: 'seed prompt',
          remixPromptText: 'remix',
          numberToGenerate: 5,
          includeExistingContext: false,
          replaceCurrentPrompts: true,
          temperature: 1.0,
          showAdvanced: true,
          addSummary: true,
        }),
      );
    });

    expect(result.current.overallPromptText).toBe('seed prompt');
    expect(result.current.rulesToRememberText).toBe('rules');
  });

  it('forces include/replace options in remix mode and emits override values', async () => {
    const onValuesChange = vi.fn();

    const { result } = renderHook(() =>
      useGenerationControlsState({
        initialValues: {
          includeExistingContext: false,
          replaceCurrentPrompts: false,
          remixPromptText: 'remix me',
        },
        onValuesChange,
        remixMode: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.includeExistingContext).toBe(true);
      expect(result.current.replaceCurrentPrompts).toBe(true);
    });

    expect(onValuesChange).toHaveBeenCalledWith(
      expect.objectContaining({
        includeExistingContext: true,
        replaceCurrentPrompts: true,
        addSummary: true,
      }),
    );
  });

  it('snaps temperature to nearest supported option before emitting change', () => {
    const onValuesChange = vi.fn();

    const { result } = renderHook(() =>
      useGenerationControlsState({
        initialValues: { temperature: 0.8 },
        onValuesChange,
        remixMode: false,
      }),
    );

    act(() => {
      result.current.setTemperatureWithSnap(0.91);
    });

    expect(result.current.temperature).toBe(1.0);
    expect(onValuesChange).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 1.0 }),
    );
  });
});
