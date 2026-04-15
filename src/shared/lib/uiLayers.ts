/** Shared z-layer contract for cross-module overlay ordering. */
export const UI_Z_LAYERS = {
  GENERATIONS_PANE_BACKDROP: 99,
  GENERATIONS_PANE: 100,
  HOME_GLASS_PANE: 100,
  LIGHTBOX_MODAL: 100010,
  TASKS_PANE_TAB_ABOVE_LIGHTBOX: 100011,
  TOAST_VIEWPORT: 100020,
  TASKS_PANE_TAB_BEHIND_LIGHTBOX: 99,
} as const;

function getComputedZIndex(element: Element): number {
  const zIndex = Number.parseInt(window.getComputedStyle(element).zIndex || '0', 10);
  return Number.isFinite(zIndex) ? zIndex : 0;
}

function isVisibleDialogElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

export function getTopDialogElement(): HTMLElement | null {
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>('[data-lightbox-popup], [data-dialog-content], [data-dialog-backdrop]'),
  ).filter(isVisibleDialogElement);

  if (elements.length === 0) {
    return null;
  }

  return elements.reduce<HTMLElement | null>((top, element) => {
    if (!top) {
      return element;
    }

    return getComputedZIndex(element) >= getComputedZIndex(top) ? element : top;
  }, null);
}

export function hasDialogAbove(zLayer: number): boolean {
  const topDialog = getTopDialogElement();
  if (!topDialog) {
    return false;
  }

  return getComputedZIndex(topDialog) > zLayer;
}
