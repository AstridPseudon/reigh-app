import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBottomOffset } from './useBottomOffset';

const mockUsePanes = vi.fn();
const mockUseLightboxOpen = vi.fn();

vi.mock('@/shared/contexts/PanesContext', () => ({
  usePanes: () => mockUsePanes(),
}));

vi.mock('@/shared/state/lightboxOpenState', () => ({
  useLightboxOpenState: () => mockUseLightboxOpen(),
}));

describe('useBottomOffset', () => {
  it('returns effectiveGenerationsPaneHeight when pane is locked', () => {
    mockUsePanes.mockReturnValue({
      isGenerationsPaneLocked: true,
      isGenerationsPaneOpen: false,
      generationsPaneHeight: 250,
      effectiveGenerationsPaneHeight: 180,
    });
    mockUseLightboxOpen.mockReturnValue(false);

    const { result } = renderHook(() => useBottomOffset());
    expect(result.current).toBe(180);
  });

  it('returns effectiveGenerationsPaneHeight when pane is open', () => {
    mockUsePanes.mockReturnValue({
      isGenerationsPaneLocked: false,
      isGenerationsPaneOpen: true,
      generationsPaneHeight: 300,
      effectiveGenerationsPaneHeight: 220,
    });
    mockUseLightboxOpen.mockReturnValue(false);

    const { result } = renderHook(() => useBottomOffset());
    expect(result.current).toBe(220);
  });

  it('returns 0 when pane is neither locked nor open', () => {
    mockUsePanes.mockReturnValue({
      isGenerationsPaneLocked: false,
      isGenerationsPaneOpen: false,
      generationsPaneHeight: 300,
      effectiveGenerationsPaneHeight: 220,
    });
    mockUseLightboxOpen.mockReturnValue(false);

    const { result } = renderHook(() => useBottomOffset());
    expect(result.current).toBe(0);
  });

  it('returns 0 when lightbox is open regardless of pane state', () => {
    mockUsePanes.mockReturnValue({
      isGenerationsPaneLocked: true,
      isGenerationsPaneOpen: true,
      generationsPaneHeight: 400,
      effectiveGenerationsPaneHeight: 150,
    });
    mockUseLightboxOpen.mockReturnValue(true);

    const { result } = renderHook(() => useBottomOffset());
    expect(result.current).toBe(0);
  });
});
