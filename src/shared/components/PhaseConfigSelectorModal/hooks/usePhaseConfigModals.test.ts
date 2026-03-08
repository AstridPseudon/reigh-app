import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePhaseConfigModals } from './usePhaseConfigModals';

describe('usePhaseConfigModals', () => {
  it('initializes with closed modal states and defaults', () => {
    const { result } = renderHook(() => usePhaseConfigModals());

    expect(result.current.activePhaseForLoraSelection).toBeNull();
    expect(result.current.isLoraModalOpen).toBe(false);
    expect(result.current.focusedLoraInput).toBeNull();
    expect(result.current.isPresetModalOpen).toBe(false);
    expect(result.current.presetModalTab).toBe('browse');
    expect(result.current.modalIntent).toBe('load');
  });

  it('opens and closes lora modal while managing active phase index', () => {
    const { result } = renderHook(() => usePhaseConfigModals());

    act(() => {
      result.current.openLoraModal(2);
    });

    expect(result.current.activePhaseForLoraSelection).toBe(2);
    expect(result.current.isLoraModalOpen).toBe(true);

    act(() => {
      result.current.closeLoraModal();
    });

    expect(result.current.activePhaseForLoraSelection).toBeNull();
    expect(result.current.isLoraModalOpen).toBe(false);
  });

  it('opens and closes preset modal with selected intent/tab', () => {
    const { result } = renderHook(() => usePhaseConfigModals());

    act(() => {
      result.current.openPresetModal('overwrite', 'add-new');
    });

    expect(result.current.isPresetModalOpen).toBe(true);
    expect(result.current.modalIntent).toBe('overwrite');
    expect(result.current.presetModalTab).toBe('add-new');

    act(() => {
      result.current.closePresetModal();
    });

    expect(result.current.isPresetModalOpen).toBe(false);
  });

  it('updates focused lora input id', () => {
    const { result } = renderHook(() => usePhaseConfigModals());

    act(() => {
      result.current.setFocusedLoraInput('lora-0-1');
    });
    expect(result.current.focusedLoraInput).toBe('lora-0-1');

    act(() => {
      result.current.setFocusedLoraInput(null);
    });
    expect(result.current.focusedLoraInput).toBeNull();
  });
});
