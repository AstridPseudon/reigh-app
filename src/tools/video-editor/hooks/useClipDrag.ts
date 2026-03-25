import { useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import type { TrackKind } from '@/tools/video-editor/types';
import { rawRowIndexFromY } from '@/tools/video-editor/lib/coordinate-utils';
import type { TimelineData } from '@/tools/video-editor/lib/timeline-data';

const DRAG_THRESHOLD_PX = 4;

export interface ActionDragState {
  rowId: string;
  initialStart: number;
  initialEnd: number;
  latestStart: number;
  latestEnd: number;
}

interface UseCrossTrackDragOptions {
  timelineWrapperRef: RefObject<HTMLDivElement | null>;
  dataRef: MutableRefObject<TimelineData | null>;
  moveClipToRow: (clipId: string, targetRowId: string, newStartTime?: number) => void;
  createTrackAndMoveClip: (clipId: string, kind: TrackKind, newStartTime?: number) => void;
  setSelectedClipId: Dispatch<SetStateAction<string | null>>;
  setSelectedTrackId: Dispatch<SetStateAction<string | null>>;
  crossTrackActive: MutableRefObject<boolean>;
  rowHeight: number;
  scale: number;
  scaleWidth: number;
  startLeft: number;
  actionDragStateRef: MutableRefObject<Record<string, ActionDragState>>;
  clearActionDragState: (clipId: string) => void;
}

/** Fixed-position indicator elements reused across drag moves. */
interface DropIndicatorEls {
  row: HTMLDivElement;
  line: HTMLDivElement;
  ghost: HTMLDivElement;
  ghostLabel: HTMLSpanElement;
  label: HTMLDivElement;
}

interface DragSession {
  pointerId: number;
  clipId: string;
  sourceRowId: string;
  sourceKind: TrackKind;
  startClientX: number;
  startClientY: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  latestStart: number;
  clipDuration: number;
  clipEl: HTMLElement;
  moveListener: (event: PointerEvent) => void;
  upListener: (event: PointerEvent) => void;
  cancelListener: (event: PointerEvent) => void;
  /** Floating clone shown during cross-track drag. */
  floatingGhostEl: HTMLElement | null;
  /** Shared drop indicator elements (row highlight, position line, ghost outline, label). */
  indicator: DropIndicatorEls | null;
  editAreaEl: HTMLElement | null;
  gridEl: HTMLElement | null;
  targetRowId: string | null;
  createTrackOnDrop: boolean;
  hasMoved: boolean;
}

export const useClipDrag = ({
  timelineWrapperRef,
  dataRef,
  moveClipToRow,
  createTrackAndMoveClip,
  setSelectedClipId,
  setSelectedTrackId,
  crossTrackActive,
  rowHeight,
  scale,
  scaleWidth,
  startLeft,
  actionDragStateRef,
  clearActionDragState,
}: UseCrossTrackDragOptions): void => {
  const dragSessionRef = useRef<DragSession | null>(null);

  useEffect(() => {
    const wrapper = timelineWrapperRef.current;
    if (!wrapper) {
      return undefined;
    }

    // ── Indicator lifecycle ──────────────────────────────────────────

    const ensureIndicator = (session: DragSession): DropIndicatorEls => {
      if (session.indicator) return session.indicator;

      const row = document.createElement('div');
      row.className = 'drop-indicator-row';
      row.style.cssText = 'position:fixed;pointer-events:none;z-index:99998;';

      const line = document.createElement('div');
      line.className = 'drop-indicator-line';
      line.style.zIndex = '99999';

      const ghost = document.createElement('div');
      ghost.className = 'drop-indicator-ghost';
      ghost.style.zIndex = '99998';

      const ghostLabel = document.createElement('span');
      ghostLabel.className = 'drop-indicator-ghost-label';
      ghost.appendChild(ghostLabel);

      const label = document.createElement('div');
      label.className = 'drop-indicator-label';
      label.style.zIndex = '100000';

      document.body.append(row, line, ghost, label);
      session.indicator = { row, line, ghost, ghostLabel, label };
      return session.indicator;
    };

    const clearDropIndicators = (session: DragSession | null) => {
      if (session?.indicator) {
        session.indicator.row.remove();
        session.indicator.line.remove();
        session.indicator.ghost.remove();
        session.indicator.label.remove();
        session.indicator = null;
      }
      session?.editAreaEl?.classList.remove('drop-target-new-track');
      if (session?.floatingGhostEl) {
        session.floatingGhostEl.style.cursor = '';
      }
    };

    const clearSession = (session: DragSession | null, deferDeactivate = false) => {
      if (!session) {
        if (!deferDeactivate) {
          crossTrackActive.current = false;
        }
        return;
      }

      clearDropIndicators(session);
      session.floatingGhostEl?.remove();
      window.removeEventListener('pointermove', session.moveListener);
      window.removeEventListener('pointerup', session.upListener);
      window.removeEventListener('pointercancel', session.cancelListener);
      try {
        if (session.clipEl.hasPointerCapture(session.pointerId)) {
          session.clipEl.releasePointerCapture(session.pointerId);
        }
      } catch {
        // Pointer capture can already be released by the browser during teardown.
      }

      dragSessionRef.current = null;
      if (deferDeactivate) {
        window.requestAnimationFrame(() => {
          if (!dragSessionRef.current) {
            crossTrackActive.current = false;
          }
        });
      } else {
        crossTrackActive.current = false;
      }
    };

    // ── Helpers ──────────────────────────────────────────────────────

    const updateFloatingGhostPosition = (session: DragSession, event: PointerEvent) => {
      if (!session.floatingGhostEl) return;
      session.floatingGhostEl.style.left = `${event.clientX - session.pointerOffsetX}px`;
      session.floatingGhostEl.style.top = `${event.clientY - session.pointerOffsetY}px`;
    };

    const getTimelineElements = () => {
      const nextWrapper = timelineWrapperRef.current;
      if (!nextWrapper) return { editAreaEl: null, gridEl: null };
      const editAreaEl = nextWrapper.querySelector<HTMLElement>('.timeline-editor-edit-area');
      return {
        editAreaEl,
        gridEl: editAreaEl?.querySelector<HTMLElement>('.ReactVirtualized__Grid')
          ?? nextWrapper.querySelector<HTMLElement>('.ReactVirtualized__Grid'),
      };
    };

    const getDropStartTime = (session: DragSession, clientX: number): number => {
      const { editAreaEl, gridEl } = getTimelineElements();
      if (!editAreaEl || !gridEl) return session.latestStart;
      const pixelsPerSecond = scaleWidth / scale;
      const editAreaRect = editAreaEl.getBoundingClientRect();
      const actionLeft = clientX - editAreaRect.left + gridEl.scrollLeft - session.pointerOffsetX;
      return Math.max(0, (actionLeft - startLeft) / pixelsPerSecond);
    };

    const createFloatingGhost = (clipEl: HTMLElement): HTMLElement => {
      const rect = clipEl.getBoundingClientRect();
      const el = clipEl.cloneNode(true) as HTMLElement;
      el.classList.add('cross-track-ghost');
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
      document.body.appendChild(el);
      return el;
    };

    // ── Core: update all drop indicators (row, line, ghost, label) ──

    const updateDropTarget = (session: DragSession, clientX: number, clientY: number) => {
      const current = dataRef.current;
      if (!current) return;

      const { editAreaEl, gridEl } = getTimelineElements();
      session.editAreaEl = editAreaEl;
      session.gridEl = gridEl;
      if (!editAreaEl || !gridEl) return;

      const editAreaRect = editAreaEl.getBoundingClientRect();
      const rowIndex = rawRowIndexFromY(clientY, editAreaRect.top, gridEl.scrollTop, rowHeight);
      const pixelsPerSecond = scaleWidth / scale;
      const scrollLeft = gridEl.scrollLeft;

      // Reset
      session.targetRowId = null;
      session.createTrackOnDrop = false;
      editAreaEl.classList.remove('drop-target-new-track');

      // Below all tracks → new track affordance
      if (rowIndex >= current.rows.length) {
        clearDropIndicators(session);
        session.createTrackOnDrop = true;
        editAreaEl.classList.add('drop-target-new-track');
        return;
      }

      const targetTrack = current.tracks[rowIndex];
      if (!targetTrack) return;

      const isReject = targetTrack.kind !== session.sourceKind;
      if (!isReject) {
        session.targetRowId = targetTrack.id;
      }

      // Position the full indicator set
      const ind = ensureIndicator(session);
      const rowScreenTop = editAreaRect.top + rowIndex * rowHeight - gridEl.scrollTop;
      const clipScreenLeft = editAreaRect.left + startLeft + session.latestStart * pixelsPerSecond - scrollLeft;
      const clipWidthPx = Math.max(2, session.clipDuration * pixelsPerSecond);
      const clampedGhostWidth = Math.min(clipWidthPx, editAreaRect.right - clipScreenLeft);
      const ghostCenter = clipScreenLeft + clampedGhostWidth / 2;

      // Row highlight
      ind.row.className = isReject ? 'drop-indicator-row drop-indicator-row--reject' : 'drop-indicator-row';
      ind.row.style.top = `${rowScreenTop}px`;
      ind.row.style.left = `${editAreaRect.left}px`;
      ind.row.style.width = `${editAreaRect.width}px`;
      ind.row.style.height = `${rowHeight}px`;

      // Position line
      ind.line.style.left = `${ghostCenter}px`;
      ind.line.style.top = `${rowScreenTop}px`;
      ind.line.style.height = `${rowHeight}px`;

      // Ghost outline
      ind.ghost.style.left = `${clipScreenLeft}px`;
      ind.ghost.style.top = `${rowScreenTop + 2}px`;
      ind.ghost.style.width = `${clampedGhostWidth}px`;
      ind.ghost.style.height = `${Math.max(0, rowHeight - 4)}px`;
      ind.ghostLabel.textContent = `${session.latestStart.toFixed(1)}s`;

      // Label
      const trackLabel = targetTrack.label ?? targetTrack.id;
      ind.label.style.left = `${ghostCenter - 30}px`;
      ind.label.style.top = `${rowScreenTop - 16}px`;
      ind.label.textContent = `${trackLabel} · ${session.latestStart.toFixed(1)}s`;

      if (isReject && session.floatingGhostEl) {
        session.floatingGhostEl.style.cursor = 'not-allowed';
      } else if (session.floatingGhostEl) {
        session.floatingGhostEl.style.cursor = '';
      }
    };

    // ── Pointer handlers ─────────────────────────────────────────────

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;

      const clipTarget = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('.clip-action') : null;
      if (!clipTarget || (event.target instanceof HTMLElement && event.target.closest("[data-delete-clip='true']"))) return;

      const clipId = clipTarget.dataset.clipId;
      const rowId = clipTarget.dataset.rowId;
      if (!clipId || !rowId) return;

      const current = dataRef.current;
      const sourceTrack = current?.tracks.find((track) => track.id === rowId);
      const sourceRow = current?.rows.find((row) => row.id === rowId);
      const sourceAction = sourceRow?.actions.find((action) => action.id === clipId);
      if (!current || !sourceTrack || !sourceAction) return;

      clearSession(dragSessionRef.current);

      const clipRect = clipTarget.getBoundingClientRect();
      const initialStart = actionDragStateRef.current[clipId]?.latestStart ?? sourceAction.start;
      const clipDuration = sourceAction.end - sourceAction.start;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const session = dragSessionRef.current;
        if (!session || moveEvent.pointerId !== session.pointerId) return;

        const dx = moveEvent.clientX - session.startClientX;
        const dy = moveEvent.clientY - session.startClientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Don't show anything until the pointer actually moves (avoids flash on click)
        if (!session.hasMoved && distance < DRAG_THRESHOLD_PX) return;

        // First move past threshold — capture the pointer so we own all subsequent events
        // and the timeline library can't start its own competing drag.
        if (!session.hasMoved) {
          session.hasMoved = true;
          try { session.clipEl.setPointerCapture(session.pointerId); } catch { /* ok */ }
        }

        // Prevent default on all moves once dragging to stop the library's handler
        moveEvent.preventDefault();

        // Update time position
        const latestStart = getDropStartTime(session, moveEvent.clientX);
        session.latestStart = latestStart;
        const dragState = actionDragStateRef.current[session.clipId];
        if (dragState) {
          const dur = dragState.initialEnd - dragState.initialStart;
          dragState.latestStart = latestStart;
          dragState.latestEnd = latestStart + dur;
        }

        // Activate cross-track mode (floating ghost) on vertical threshold
        if (!crossTrackActive.current && Math.abs(dy) >= 10) {
          crossTrackActive.current = true;
          session.floatingGhostEl = createFloatingGhost(session.clipEl);
          updateFloatingGhostPosition(session, moveEvent);
        }

        if (crossTrackActive.current) {
          updateFloatingGhostPosition(session, moveEvent);
        }

        // Always show the drop indicator (row highlight + position line + ghost + label)
        updateDropTarget(session, moveEvent.clientX, moveEvent.clientY);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        const session = dragSessionRef.current;
        if (!session || upEvent.pointerId !== session.pointerId) return;

        const nextStart = actionDragStateRef.current[session.clipId]?.latestStart ?? session.latestStart;
        if (crossTrackActive.current) {
          upEvent.preventDefault();
          if (session.createTrackOnDrop) {
            createTrackAndMoveClip(session.clipId, session.sourceKind, nextStart);
          } else if (session.targetRowId) {
            moveClipToRow(session.clipId, session.targetRowId, nextStart);
            setSelectedTrackId(session.targetRowId);
          } else {
            moveClipToRow(session.clipId, session.sourceRowId, nextStart);
            setSelectedTrackId(session.sourceRowId);
          }
          setSelectedClipId(session.clipId);
          clearActionDragState(session.clipId);
          clearSession(session, true);
          return;
        }

        // Same-row move — apply the horizontal position change
        if (session.hasMoved) {
          moveClipToRow(session.clipId, session.sourceRowId, nextStart);
        }
        setSelectedClipId(session.clipId);
        setSelectedTrackId(session.sourceRowId);
        clearActionDragState(session.clipId);
        clearSession(session);
      };

      const handlePointerCancel = (cancelEvent: PointerEvent) => {
        const session = dragSessionRef.current;
        if (!session || cancelEvent.pointerId !== session.pointerId) return;
        clearActionDragState(session.clipId);
        clearSession(session);
      };

      dragSessionRef.current = {
        pointerId: event.pointerId,
        clipId,
        sourceRowId: rowId,
        sourceKind: sourceTrack.kind,
        startClientX: event.clientX,
        startClientY: event.clientY,
        pointerOffsetX: event.clientX - clipRect.left,
        pointerOffsetY: event.clientY - clipRect.top,
        latestStart: initialStart,
        clipDuration,
        clipEl: clipTarget,
        moveListener: handlePointerMove,
        upListener: handlePointerUp,
        cancelListener: handlePointerCancel,
        floatingGhostEl: null,
        indicator: null,
        editAreaEl: null,
        gridEl: null,
        targetRowId: null,
        createTrackOnDrop: false,
        hasMoved: false,
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerCancel);
    };

    const handleBlur = () => {
      clearSession(dragSessionRef.current);
    };

    // Use capture phase so this fires BEFORE ClipAction's stopPropagation
    wrapper.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('blur', handleBlur);
    return () => {
      wrapper.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('blur', handleBlur);
      clearSession(dragSessionRef.current);
    };
  }, [
    actionDragStateRef,
    clearActionDragState,
    createTrackAndMoveClip,
    crossTrackActive,
    dataRef,
    moveClipToRow,
    rowHeight,
    scale,
    scaleWidth,
    setSelectedClipId,
    setSelectedTrackId,
    startLeft,
    timelineWrapperRef,
  ]);
};
