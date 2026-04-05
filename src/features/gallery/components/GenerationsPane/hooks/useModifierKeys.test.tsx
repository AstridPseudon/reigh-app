// @vitest-environment jsdom
import { act, fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useModifierKeys } from './useModifierKeys';

describe('useModifierKeys', () => {
  it('tracks multi-select modifier keys and resets state on blur', () => {
    const { result } = renderHook(() => useModifierKeys());

    expect(result.current).toEqual({
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      isMultiSelectModifier: false,
    });

    act(() => {
      fireEvent.keyDown(window, { key: 'Meta', metaKey: true });
    });

    expect(result.current).toEqual({
      shiftKey: false,
      metaKey: true,
      ctrlKey: false,
      isMultiSelectModifier: true,
    });

    act(() => {
      fireEvent.blur(window);
    });

    expect(result.current).toEqual({
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      isMultiSelectModifier: false,
    });
  });

  it('removes the registered listeners on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useModifierKeys());

    const keydownListener = addEventListenerSpy.mock.calls.find(([type]) => type === 'keydown')?.[1];
    const keyupListener = addEventListenerSpy.mock.calls.find(([type]) => type === 'keyup')?.[1];
    const blurListener = addEventListenerSpy.mock.calls.find(([type]) => type === 'blur')?.[1];

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', keydownListener);
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keyup', keyupListener);
    expect(removeEventListenerSpy).toHaveBeenCalledWith('blur', blurListener);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
