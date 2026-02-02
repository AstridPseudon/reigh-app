/**
 * LightboxShell - Dialog/Overlay container for MediaLightbox
 *
 * Encapsulates all the complex event handling for the lightbox modal:
 * - Dialog root/portal/overlay
 * - Pointer/touch/click event handling with z-index awareness
 * - Double-tap to close on mobile
 * - Body scroll locking
 * - Accessibility elements
 *
 * Note: Tasks pane controls are handled by the existing PaneControlTab from TasksPane,
 * which is visible above the lightbox at z-[100001]. The overlay adjusts its size
 * to account for the pane when it's open or locked.
 *
 * This allows the main MediaLightbox to focus on content orchestration.
 */

import React, { useRef, useEffect } from 'react';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

const DOUBLE_TAP_DELAY = 300; // ms

export interface LightboxShellProps {
  children: React.ReactNode;
  onClose: () => void;

  // Edit mode state - prevents accidental closing
  isInpaintMode: boolean;
  isSelectOpen: boolean;
  shouldShowSidePanel: boolean;

  // Responsive state
  isMobile: boolean;
  isTabletOrLarger: boolean;

  // Tasks pane state
  effectiveTasksPaneOpen: boolean;
  effectiveTasksPaneWidth: number;
  cancellableTaskCount: number;
  isTasksPaneLocked: boolean;
  setIsTasksPaneLocked: (locked: boolean) => void;
  setTasksPaneOpenContext: (open: boolean) => void;

  // Layout mode
  needsFullscreenLayout: boolean;
  needsTasksPaneOffset: boolean;

  // Ref for content
  contentRef: React.RefObject<HTMLDivElement>;

  // Accessibility
  accessibilityTitle: string;
  accessibilityDescription: string;
}

/**
 * Helper to check if a higher z-index dialog is open
 */
function hasHigherZIndexDialog(): boolean {
  const dialogOverlays = document.querySelectorAll('[data-radix-dialog-overlay]');
  return Array.from(dialogOverlays).some((overlay) => {
    const zIndex = parseInt(window.getComputedStyle(overlay as Element).zIndex || '0', 10);
    return zIndex > 100000;
  });
}

/**
 * Helper to check if target or any ancestor has higher z-index
 */
function targetHasHigherZIndex(target: EventTarget | null): boolean {
  let element = target as HTMLElement | null;
  while (element && element !== document.body) {
    const zIndex = parseInt(window.getComputedStyle(element).zIndex || '0', 10);
    if (zIndex > 100000) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}

/**
 * Helper to check if element is interactive (buttons, inputs, etc.)
 */
function isInteractiveElement(target: HTMLElement): boolean {
  return (
    target.tagName === 'BUTTON' ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.tagName === 'A' ||
    target.closest('button') !== null ||
    target.closest('a') !== null
  );
}

export const LightboxShell: React.FC<LightboxShellProps> = ({
  children,
  onClose,
  isInpaintMode,
  isSelectOpen,
  shouldShowSidePanel,
  isMobile,
  isTabletOrLarger,
  effectiveTasksPaneOpen,
  effectiveTasksPaneWidth,
  cancellableTaskCount,
  isTasksPaneLocked,
  setIsTasksPaneLocked,
  setTasksPaneOpenContext,
  needsFullscreenLayout,
  needsTasksPaneOffset,
  contentRef,
  accessibilityTitle,
  accessibilityDescription,
}) => {
  // Track where pointer/click started to prevent accidental modal closure on drag
  const pointerDownTargetRef = useRef<EventTarget | null>(null);

  // Track double-tap on mobile/iPad
  const lastTapTimeRef = useRef<number>(0);
  const lastTapTargetRef = useRef<EventTarget | null>(null);
  const touchStartTargetRef = useRef<EventTarget | null>(null);
  const touchStartedOnOverlayRef = useRef<boolean>(false);

  // Lock body scroll when lightbox is open on desktop
  // (On mobile, Radix's modal={true} handles this, but on desktop we use modal={false}
  // to allow TasksPane interaction, so we need manual scroll locking)
  useEffect(() => {
    if (isMobile) return; // Radix handles mobile

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobile]);

  // ========================================
  // OVERLAY EVENT HANDLERS
  // ========================================

  const handleOverlayPointerDown = (e: React.PointerEvent) => {
    pointerDownTargetRef.current = e.target;

    if (hasHigherZIndexDialog() || targetHasHigherZIndex(e.target)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  const handleOverlayPointerUp = (e: React.PointerEvent) => {
    if (hasHigherZIndexDialog() || targetHasHigherZIndex(e.target)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (hasHigherZIndexDialog() || targetHasHigherZIndex(e.target)) {
      return;
    }

    // Prevent closing when in inpaint mode to avoid accidental data loss
    if (isInpaintMode) {
      pointerDownTargetRef.current = null;
      return;
    }

    // Close on single click if both pointer down and click are on the overlay itself
    const clickStartedOnOverlay = pointerDownTargetRef.current === e.currentTarget;
    const clickEndedOnOverlay = e.target === e.currentTarget;

    if (clickStartedOnOverlay && clickEndedOnOverlay) {
      onClose();
    }

    pointerDownTargetRef.current = null;
  };

  const handleOverlayDoubleClick = (e: React.MouseEvent) => {
    if (hasHigherZIndexDialog() || targetHasHigherZIndex(e.target)) {
      return;
    }

    if (isInpaintMode) {
      return;
    }

    const clickStartedOnOverlay = pointerDownTargetRef.current === e.currentTarget;
    const clickEndedOnOverlay = e.target === e.currentTarget;

    if (clickStartedOnOverlay && clickEndedOnOverlay) {
      onClose();
    }
  };

  const handleOverlayTouchStart = (e: React.TouchEvent) => {
    touchStartTargetRef.current = e.target;
    const touchedDirectlyOnOverlay = e.target === e.currentTarget;
    touchStartedOnOverlayRef.current = touchedDirectlyOnOverlay;

    const target = e.target as HTMLElement;

    // Allow touch events on canvas when in inpaint mode
    if (isInpaintMode && target.tagName === 'CANVAS') {
      return;
    }

    // Allow touch events on interactive elements
    if (isInteractiveElement(target)) {
      return;
    }

    if (isMobile) e.stopPropagation();
  };

  const handleOverlayTouchMove = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;

    if (isInpaintMode && target.tagName === 'CANVAS') {
      return;
    }

    if (isInteractiveElement(target)) {
      return;
    }

    if (isMobile) e.stopPropagation();
  };

  const handleOverlayTouchEnd = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;

    if (isInpaintMode && target.tagName === 'CANVAS') {
      return;
    }

    if (isInteractiveElement(target)) {
      return;
    }

    // Detect double-tap to close on mobile/iPad (only on overlay background)
    const touchEndedOnOverlay = e.target === e.currentTarget;
    const validOverlayTap = touchStartedOnOverlayRef.current && touchEndedOnOverlay;

    if (!isInpaintMode && validOverlayTap) {
      const currentTime = Date.now();
      const timeSinceLastTap = currentTime - lastTapTimeRef.current;

      if (timeSinceLastTap < DOUBLE_TAP_DELAY && lastTapTargetRef.current === e.currentTarget) {
        onClose();
        lastTapTimeRef.current = 0;
        lastTapTargetRef.current = null;
      } else {
        lastTapTimeRef.current = currentTime;
        lastTapTargetRef.current = e.currentTarget;
      }
    }

    touchStartTargetRef.current = null;
    touchStartedOnOverlayRef.current = false;

    if (isMobile) e.stopPropagation();
  };

  const handleOverlayTouchCancel = (e: React.TouchEvent) => {
    touchStartTargetRef.current = null;
    touchStartedOnOverlayRef.current = false;

    if (hasHigherZIndexDialog()) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  // ========================================
  // CONTENT EVENT HANDLERS
  // ========================================

  const handleContentPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const isRadixPortal = target.closest('[data-radix-popper-content-wrapper]') !== null;

    if (isRadixPortal) {
      return;
    }

    e.stopPropagation();
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleContentTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;

    if (isInpaintMode && target.tagName === 'CANVAS') {
      return;
    }

    if (isInteractiveElement(target)) {
      return;
    }

    if (isMobile) e.stopPropagation();
  };

  const handleContentTouchMove = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;

    if (isInpaintMode && target.tagName === 'CANVAS') {
      return;
    }

    if (isInteractiveElement(target)) {
      return;
    }

    if (isMobile) e.stopPropagation();
  };

  const handleContentTouchEnd = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;

    if (isInpaintMode && target.tagName === 'CANVAS') {
      return;
    }

    if (isInteractiveElement(target)) {
      return;
    }

    if (isMobile) e.stopPropagation();
  };

  const handleContentTouchCancel = (e: React.TouchEvent) => {
    if (hasHigherZIndexDialog()) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  const handlePointerDownOutside = (event: CustomEvent) => {
    const target = event.target as Element;

    // Don't close if clicking inside the TasksPane
    if (target.closest('[data-tasks-pane]')) {
      event.preventDefault();
      return;
    }

    // Don't close if clicking inside Radix portals
    if (
      target.closest('[data-radix-select-content]') ||
      target.closest('[data-radix-select-viewport]') ||
      target.closest('[data-radix-select-item]') ||
      target.closest('[data-radix-popover-content]') ||
      target.closest('[data-radix-dropdown-menu-content]') ||
      target.closest('[data-shot-selector-header]') ||
      target.closest('[data-radix-select-trigger]')
    ) {
      event.preventDefault();
      return;
    }

    // Don't close if Select is open
    if (isSelectOpen) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }

    // In special edit modes with side panel, don't close if clicking on panel elements
    if (isInpaintMode && shouldShowSidePanel) {
      if (target.closest('[data-task-details-panel]') || target.closest('[role="button"]')) {
        return;
      }
    }

    // Close the lightbox
    if (isMobile) {
      setTimeout(() => {
        onClose();
      }, 0);
    } else {
      onClose();
    }
  };

  // ========================================
  // OVERLAY STYLES
  // ========================================

  // Check both effectiveTasksPaneOpen AND isTasksPaneLocked to handle edge cases
  // where they might be temporarily out of sync (e.g., during hydration)
  const shouldAccountForTasksPane = (effectiveTasksPaneOpen || isTasksPaneLocked) && isTabletOrLarger;

  const overlayStyle: React.CSSProperties = {
    pointerEvents: 'all',
    touchAction: 'none',
    cursor: 'pointer', // Required for iOS touch events
    zIndex: 10000,
    position: 'fixed',
    top: 0,
    left: 0,
    right: shouldAccountForTasksPane ? `${effectiveTasksPaneWidth}px` : 0,
    bottom: 0,
    height: '100dvh',
    transition: 'right 300ms cubic-bezier(0.22, 1, 0.36, 1), width 300ms cubic-bezier(0.22, 1, 0.36, 1)',
    ...(shouldAccountForTasksPane
      ? { width: `calc(100vw - ${effectiveTasksPaneWidth}px)` }
      : {}),
  };

  // ========================================
  // CONTENT STYLES
  // ========================================

  const contentStyle: React.CSSProperties = {
    transition: 'width 300ms cubic-bezier(0.22, 1, 0.36, 1)',
    ...(needsTasksPaneOffset
      ? {
          width: `calc(100vw - ${effectiveTasksPaneWidth}px)`,
          height: '100dvh',
        }
      : needsFullscreenLayout
      ? {
          width: '100vw',
          height: '100dvh',
        }
      : {}),
  };

  return (
    <TooltipProvider delayDuration={500}>
      <DialogPrimitive.Root
        open={true}
        modal={isMobile && !isTabletOrLarger}
        onOpenChange={() => {
          // Prevent automatic closing - we handle all closing manually
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={cn(
              "fixed z-[100000] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              isMobile ? "" : "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "p-0 border-none shadow-none"
            )}
            onPointerDown={handleOverlayPointerDown}
            onPointerUp={handleOverlayPointerUp}
            onClick={handleOverlayClick}
            onDoubleClick={handleOverlayDoubleClick}
            onTouchStart={handleOverlayTouchStart}
            onTouchMove={handleOverlayTouchMove}
            onTouchEnd={handleOverlayTouchEnd}
            onTouchCancel={handleOverlayTouchCancel}
            style={overlayStyle}
          />

          {/* Task pane handle removed - the existing PaneControlTab from TasksPane
              is now visible above the lightbox at z-[100001] and handles all pane controls.
              The overlay correctly accounts for the pane via shouldAccountForTasksPane. */}

          <DialogPrimitive.Content
            ref={contentRef}
            tabIndex={-1}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              contentRef.current?.focus();
            }}
            onEscapeKeyDown={(event) => {
              event.preventDefault();
            }}
            onPointerDown={handleContentPointerDown}
            onClick={handleContentClick}
            onTouchStart={handleContentTouchStart}
            onTouchMove={handleContentTouchMove}
            onTouchEnd={handleContentTouchEnd}
            onTouchCancel={handleContentTouchCancel}
            className={cn(
              "fixed z-[100000]",
              isMobile
                ? ""
                : "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "p-0 border-none bg-transparent shadow-none",
              needsFullscreenLayout
                ? "inset-0 w-full h-full"
                : "left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-auto h-auto data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
            )}
            style={contentStyle}
            onPointerDownOutside={handlePointerDownOutside as any}
          >
            {/* Accessibility: Hidden dialog title for screen readers */}
            <DialogPrimitive.Title className="sr-only">
              {accessibilityTitle}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              {accessibilityDescription}
            </DialogPrimitive.Description>

            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </TooltipProvider>
  );
};

export default LightboxShell;
