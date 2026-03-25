/**
 * Shared utilities for drag-and-drop operations involving generations (images/videos)
 *
 * Used by:
 * - MediaGalleryItem (drag source)
 * - ShotGroup, SortableShotItem, ShotListDisplay (drop targets)
 * - Timeline components (drop targets)
 * - BatchDropZone (drop target)
 */

import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';

// MIME type for generation drag data
const GENERATION_MIME_TYPE = 'application/x-generation';
const GENERATION_TEXT_PREFIX = '__reigh_generation__:';

// Droppable ID for creating a new shot from a dropped generation
export const NEW_GROUP_DROPPABLE_ID = 'new-shot-group-dropzone';

/**
 * Cross-browser types list - may be DOMStringList (contains/item) or string[] (includes).
 * All properties optional since we check with typeof before calling.
 */
interface DataTransferTypesList {
  contains?: (s: string) => boolean;
  includes?: (s: string) => boolean;
  item?: (i: number) => string | null;
  length?: number;
  [index: number]: string;
}

/**
 * Cross-browser safe check for whether a DataTransfer contains a type.
 *
 * In Chromium, `dataTransfer.types` is often a DOMStringList (has `.contains`, may not have `.includes`).
 * In TS typings, it's usually `string[]`.
 */
function hasDataTransferType(dataTransfer: DataTransfer, type: string): boolean {
  const types = dataTransfer?.types as DataTransferTypesList | undefined;
  if (!types) return false;

  // DOMStringList path
  if (typeof types.contains === 'function') {
    try {
      return !!types.contains(type);
    } catch {
      // ignore
    }
  }

  // Array path
  if (typeof types.includes === 'function') {
    try {
      return !!types.includes(type);
    } catch {
      // ignore
    }
  }

  // DOMStringList `.item(i)` path
  if (typeof types.item === 'function' && typeof types.length === 'number') {
    try {
      for (let i = 0; i < types.length; i++) {
        if (types.item(i) === type) return true;
      }
    } catch {
      // ignore
    }
  }

  // Final fallback: numeric indexing
  if (typeof types.length === 'number') {
    for (let i = 0; i < types.length; i++) {
      if (types[i] === type) return true;
    }
  }

  return false;
}

/**
 * Data structure for dragging generations between components
 */
export interface GenerationDropData {
  generationId: string;
  variantId?: string;
  variantType?: string;
  imageUrl: string;
  thumbUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Type of drag operation
 */
export type DragType = 'generation' | 'file' | 'none';

/**
 * Check if the drag event contains generation data.
 * @internal Used by getDragType.
 */
function isGenerationDrag(e: React.DragEvent): boolean {
  if (hasDataTransferType(e.dataTransfer, GENERATION_MIME_TYPE)) {
    return true;
  }

  if (!hasDataTransferType(e.dataTransfer, 'text/plain')) {
    return false;
  }

  const textPayload = e.dataTransfer.getData('text/plain');
  return parseGenerationDropData(textPayload) !== null;
}

/**
 * Check if the drag event contains files
 */
export function isFileDrag(e: React.DragEvent): boolean {
  return hasDataTransferType(e.dataTransfer, 'Files');
}

/**
 * Determine the type of drag operation
 */
export function getDragType(e: React.DragEvent): DragType {
  if (isGenerationDrag(e)) return 'generation';
  if (isFileDrag(e)) return 'file';
  return 'none';
}

/**
 * Set generation drag data on the dataTransfer object
 * Call this in onDragStart
 */
export function setGenerationDragData(e: React.DragEvent, data: GenerationDropData): void {
  const serialized = JSON.stringify(data);
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData(GENERATION_MIME_TYPE, serialized);
  // Fallback: some browsers/targets are inconsistent about exposing custom MIME types during dragover.
  try {
    e.dataTransfer.setData('text/plain', `${GENERATION_TEXT_PREFIX}${serialized}`);
  } catch {
    // ignore
  }
}

function parseGenerationDropData(dataString: string): GenerationDropData | null {
  if (!dataString) {
    return null;
  }

  let data: GenerationDropData;
  try {
    const normalized = dataString.startsWith(GENERATION_TEXT_PREFIX)
      ? dataString.slice(GENERATION_TEXT_PREFIX.length)
      : dataString;
    data = JSON.parse(normalized) as GenerationDropData;
  } catch {
    return null;
  }

  if (!data.generationId || !data.imageUrl) {
    return null;
  }

  return data;
}

/**
 * Get and parse generation drag data from the dataTransfer object
 * Call this in onDrop
 * Returns null if no valid data found
 */
export function getGenerationDropData(e: React.DragEvent): GenerationDropData | null {
  try {
    const dataString =
      e.dataTransfer.getData(GENERATION_MIME_TYPE) ||
      e.dataTransfer.getData('text/plain');
    return parseGenerationDropData(dataString);
  } catch (error) {
    normalizeAndPresentError(error, { context: 'DragDrop', showToast: false });
    return null;
  }
}

/**
 * Check if the drag event is a valid drop target (generation or file)
 */
export function isValidDropTarget(e: React.DragEvent): boolean {
  return isGenerationDrag(e) || isFileDrag(e);
}

/**
 * Create a visual drag preview element
 * Returns a cleanup function to remove the element
 */
export function createDragPreview(
  e: React.DragEvent, 
  options?: { 
    size?: number; 
    borderColor?: string;
  }
): (() => void) | null {
  const { size = 80, borderColor = '#fff' } = options || {};
  
  if (!e.dataTransfer.setDragImage || !(e.currentTarget instanceof HTMLElement)) {
    return null;
  }

  const preview = document.createElement('div');
  preview.style.position = 'absolute';
  preview.style.top = '-1000px';
  preview.style.width = `${size}px`;
  preview.style.height = `${size}px`;
  preview.style.opacity = '0.7';
  preview.style.borderRadius = '8px';
  preview.style.overflow = 'hidden';
  preview.style.border = `2px solid ${borderColor}`;
  preview.style.boxShadow = '0 4px 6px hsl(0 0% 0% / 0.3)';

  const imgElement = e.currentTarget.querySelector('img');
  if (imgElement) {
    const imgClone = imgElement.cloneNode(true) as HTMLImageElement;
    imgClone.style.width = '100%';
    imgClone.style.height = '100%';
    imgClone.style.objectFit = 'cover';
    preview.appendChild(imgClone);
  }

  document.body.appendChild(preview);
  e.dataTransfer.setDragImage(preview, size / 2, size / 2);

  // Return cleanup function
  return () => {
    if (document.body.contains(preview)) {
      document.body.removeChild(preview);
    }
  };
}
