import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UI_Z_LAYERS } from '@/shared/lib/uiLayers';
import { useLightboxNavigation } from './useLightboxNavigation';

function createDialogBackdrop(zIndex: number) {
  const backdrop = document.createElement('div');
  backdrop.setAttribute('data-dialog-backdrop', '');
  document.body.appendChild(backdrop);

  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    zIndex: String(zIndex),
  } as CSSStyleDeclaration);

  return backdrop;
}

function dispatchKey(key: string) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

describe('useLightboxNavigation', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('fires onPrevious for ArrowLeft when no dialog backdrop exists', () => {
    const onPrevious = vi.fn();
    const onClose = vi.fn();

    renderHook(() =>
      useLightboxNavigation({
        onNext: vi.fn(),
        onPrevious,
        onClose,
      }),
    );

    dispatchKey('ArrowLeft');

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('fires onClose for Escape when no dialog backdrop exists', () => {
    const onClose = vi.fn();

    renderHook(() =>
      useLightboxNavigation({
        onNext: vi.fn(),
        onPrevious: vi.fn(),
        onClose,
      }),
    );

    dispatchKey('Escape');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('suppresses navigation keys when a higher dialog backdrop exists', () => {
    const onPrevious = vi.fn();

    renderHook(() =>
      useLightboxNavigation({
        onNext: vi.fn(),
        onPrevious,
        onClose: vi.fn(),
      }),
    );

    createDialogBackdrop(200000);
    dispatchKey('ArrowLeft');

    expect(onPrevious).not.toHaveBeenCalled();
  });

  it('does not suppress navigation keys when a backdrop matches LIGHTBOX_MODAL exactly', () => {
    const onPrevious = vi.fn();

    renderHook(() =>
      useLightboxNavigation({
        onNext: vi.fn(),
        onPrevious,
        onClose: vi.fn(),
      }),
    );

    createDialogBackdrop(UI_Z_LAYERS.LIGHTBOX_MODAL);
    dispatchKey('ArrowLeft');

    expect(onPrevious).toHaveBeenCalledTimes(1);
  });
});
