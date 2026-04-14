import { afterEach, describe, expect, it, vi } from 'vitest';
import { UI_Z_LAYERS, hasDialogAbove } from './uiLayers';

describe('uiLayers', () => {
  it('keeps the cross-surface z-layer contract ordered as expected', () => {
    expect(UI_Z_LAYERS.GENERATIONS_PANE_BACKDROP).toBe(99);
    expect(UI_Z_LAYERS.GENERATIONS_PANE).toBe(100);
    expect(UI_Z_LAYERS.HOME_GLASS_PANE).toBe(100);
    expect(UI_Z_LAYERS.LIGHTBOX_MODAL).toBeGreaterThan(UI_Z_LAYERS.GENERATIONS_PANE);
    expect(UI_Z_LAYERS.TASKS_PANE_TAB_ABOVE_LIGHTBOX).toBeGreaterThan(UI_Z_LAYERS.LIGHTBOX_MODAL);
    expect(UI_Z_LAYERS.TOAST_VIEWPORT).toBeGreaterThan(UI_Z_LAYERS.TASKS_PANE_TAB_ABOVE_LIGHTBOX);
    expect(UI_Z_LAYERS.TASKS_PANE_TAB_BEHIND_LIGHTBOX).toBe(UI_Z_LAYERS.GENERATIONS_PANE_BACKDROP);
  });
});

describe('hasDialogAbove', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('returns false when no dialog backdrops exist', () => {
    expect(hasDialogAbove(UI_Z_LAYERS.LIGHTBOX_MODAL)).toBe(false);
  });

  it('returns true when a dialog backdrop is above the provided layer', () => {
    const backdrop = document.createElement('div');
    backdrop.setAttribute('data-dialog-backdrop', '');
    document.body.appendChild(backdrop);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      zIndex: '200000',
    } as CSSStyleDeclaration);

    expect(hasDialogAbove(UI_Z_LAYERS.LIGHTBOX_MODAL)).toBe(true);
  });

  it('returns false when a dialog backdrop matches the provided layer exactly', () => {
    const backdrop = document.createElement('div');
    backdrop.setAttribute('data-dialog-backdrop', '');
    document.body.appendChild(backdrop);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      zIndex: String(UI_Z_LAYERS.LIGHTBOX_MODAL),
    } as CSSStyleDeclaration);

    expect(hasDialogAbove(UI_Z_LAYERS.LIGHTBOX_MODAL)).toBe(false);
  });
});
