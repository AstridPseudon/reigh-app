import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useImageTickFeedback } from '../useImageTickFeedback';

describe('useImageTickFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears the primary tick id after 3 seconds', () => {
    const { result } = renderHook(() => useImageTickFeedback());

    act(() => {
      result.current.setShowTickForImageId('img-1');
    });
    expect(result.current.showTickForImageId).toBe('img-1');

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.showTickForImageId).toBe('img-1');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.showTickForImageId).toBeNull();
  });

  it('clears the secondary tick id independently', () => {
    const { result } = renderHook(() => useImageTickFeedback());

    act(() => {
      result.current.setShowTickForImageId('img-1');
      result.current.setShowTickForSecondaryImageId('img-2');
    });
    expect(result.current.showTickForImageId).toBe('img-1');
    expect(result.current.showTickForSecondaryImageId).toBe('img-2');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.showTickForImageId).toBeNull();
    expect(result.current.showTickForSecondaryImageId).toBeNull();
  });
});
