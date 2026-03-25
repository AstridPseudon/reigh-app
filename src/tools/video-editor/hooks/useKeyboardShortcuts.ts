import { useEffect } from 'react';
import { isEditableTarget } from '@/tools/video-editor/lib/coordinate-utils';

interface UseKeyboardShortcutsOptions {
  hasSelectedClip: boolean;
  moveSelectedClipToTrack: (direction: 'up' | 'down') => void;
  togglePlayPause: () => void;
  seekRelative: (deltaSeconds: number) => void;
  toggleMute: () => void;
  splitSelectedClip: () => void;
  deleteSelectedClip: () => void;
  clearSelection: () => void;
}

export function useKeyboardShortcuts({
  hasSelectedClip,
  moveSelectedClipToTrack,
  togglePlayPause,
  seekRelative,
  toggleMute,
  splitSelectedClip,
  deleteSelectedClip,
  clearSelection,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seekRelative(-1);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        seekRelative(1);
        return;
      }

      if (event.key === 'ArrowUp' && hasSelectedClip) {
        event.preventDefault();
        moveSelectedClipToTrack('up');
        return;
      }

      if (event.key === 'ArrowDown' && hasSelectedClip) {
        event.preventDefault();
        moveSelectedClipToTrack('down');
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        togglePlayPause();
        return;
      }

      if (event.key.toLowerCase() === 'm' && hasSelectedClip) {
        event.preventDefault();
        toggleMute();
        return;
      }

      if (event.key.toLowerCase() === 's' && hasSelectedClip) {
        event.preventDefault();
        splitSelectedClip();
        return;
      }

      if ((event.key === 'Backspace' || event.key === 'Delete') && hasSelectedClip) {
        event.preventDefault();
        deleteSelectedClip();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        clearSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelection, deleteSelectedClip, hasSelectedClip, moveSelectedClipToTrack, seekRelative, splitSelectedClip, toggleMute, togglePlayPause]);
}
