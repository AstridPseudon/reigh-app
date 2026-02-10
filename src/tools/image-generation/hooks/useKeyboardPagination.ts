import { useEffect } from 'react';

interface UseKeyboardPaginationOptions {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Arrow-key page navigation. Skips when an input is focused or a dialog is open.
 */
export function useKeyboardPagination({ currentPage, totalPages, onPageChange }: UseKeyboardPaginationOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
      const dialog = document.querySelector('[role="dialog"], [data-state="open"].fixed');

      if (isInput || dialog) return;

      if (e.key === 'ArrowLeft' && currentPage > 1) {
        e.preventDefault();
        onPageChange(currentPage - 1);
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        e.preventDefault();
        onPageChange(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, onPageChange]);
}
