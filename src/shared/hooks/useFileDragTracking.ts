import { useCallback, useRef, useState } from 'react';
import { toast } from '@/shared/components/ui/sonner';

/**
 * Track file drag enter/leave events with proper nesting counter.
 * Returns drag state and handlers.
 */
export function useFileDragTracking() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const resetDrag = useCallback(() => {
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
  }, []);

  return { isDraggingOver, handleDragEnter, handleDragLeave, resetDrag };
}

/** No-op dragOver handler that just prevents default browser behavior. */
export const preventDefaultDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

/**
 * Create a drop handler for single-file upload with mime type validation.
 * Used by edit tool pages (EditImagesPage, EditVideoPage) that share
 * the same drop-to-upload pattern.
 */
export function createSingleFileDropHandler(opts: {
  mimePrefix: string;
  mimeErrorMessage: string;
  resetDrag: () => void;
  getProjectId: () => string | undefined;
  upload: (file: File) => Promise<unknown>;
  onResult: (result: unknown) => void;
  context: string;
  toastTitle: string;
  uploadOperation: { execute: (fn: () => Promise<unknown>, opts: { context: string; toastTitle: string }) => Promise<unknown> };
}) {
  return async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    opts.resetDrag();

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith(opts.mimePrefix)) {
      toast.error(opts.mimeErrorMessage);
      return;
    }

    if (!opts.getProjectId()) {
      toast.error("Please select a project first");
      return;
    }

    const result = await opts.uploadOperation.execute(
      () => opts.upload(file),
      { context: opts.context, toastTitle: opts.toastTitle }
    );
    if (result) {
      opts.onResult(result);
    }
  };
}
