// @vitest-environment jsdom
import { act, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useClipDrag } from '@/tools/video-editor/hooks/useClipDrag';
import type { DragCoordinator } from '@/tools/video-editor/hooks/useDragCoordinator';
import type { TimelineData } from '@/tools/video-editor/lib/timeline-data';
import type { TrackDefinition } from '@/tools/video-editor/types';

const baseTrack: TrackDefinition = {
  id: 'V1',
  kind: 'visual',
  label: 'V1',
  scale: 1,
  fit: 'manual',
  opacity: 1,
  blendMode: 'normal',
};

function makeCoordinator(): DragCoordinator {
  return {
    update: vi.fn(() => ({
      time: 0,
      rowIndex: 0,
      trackId: 'V1',
      trackKind: 'visual',
      trackName: 'V1',
      isNewTrack: false,
      isReject: false,
      newTrackKind: null,
      screenCoords: {
        rowTop: 0,
        rowLeft: 0,
        rowWidth: 0,
        rowHeight: 48,
        clipLeft: 0,
        clipWidth: 0,
        ghostCenter: 0,
      },
    })),
    showSecondaryGhosts: vi.fn(),
    end: vi.fn(),
    lastPosition: null,
    editAreaRef: { current: null },
  };
}

function makeData(): TimelineData {
  return {
    config: {
      output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' },
      tracks: [baseTrack],
      clips: [{ id: 'clip-1', at: 0, track: 'V1', clipType: 'hold', hold: 2 }],
    },
    configVersion: 1,
    registry: { assets: {} },
    resolvedConfig: {
      output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' },
      tracks: [baseTrack],
      clips: [{ id: 'clip-1', at: 0, track: 'V1', clipType: 'hold', hold: 2 }],
      registry: {},
    },
    rows: [{
      id: 'V1',
      actions: [{ id: 'clip-1', start: 0, end: 2, effectId: 'effect-clip-1' }],
    }],
    meta: {
      'clip-1': {
        track: 'V1',
        clipType: 'hold',
        hold: 2,
      },
    },
    effects: {
      'effect-clip-1': { id: 'effect-clip-1' },
    },
    assetMap: {},
    output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' },
    tracks: [baseTrack],
    clipOrder: { V1: ['clip-1'] },
    signature: 'sig-1',
    stableSignature: 'stable-1',
  };
}

function setupDom() {
  const wrapper = document.createElement('div');
  wrapper.className = 'timeline-wrapper';
  const editArea = document.createElement('div');
  editArea.className = 'timeline-canvas-edit-area';
  const clip = document.createElement('div');
  clip.className = 'clip-action';
  clip.dataset.clipId = 'clip-1';
  clip.dataset.rowId = 'V1';
  clip.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 120,
    bottom: 24,
    width: 120,
    height: 24,
    toJSON: () => ({}),
  });
  editArea.appendChild(clip);
  wrapper.appendChild(editArea);
  document.body.appendChild(wrapper);

  return {
    clip,
    wrapper,
    cleanup: () => wrapper.remove(),
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useClipDrag', () => {
  it('increments on pointerdown and returns pendingOpsRef to 0 on pointerup', () => {
    const pendingOpsRef = { current: 0 };
    const { clip, wrapper, cleanup } = setupDom();
    const timelineWrapperRef = { current: wrapper };
    const dataRef = { current: makeData() };

    try {
      renderHook(() => useClipDrag({
        timelineWrapperRef,
        dataRef,
        pendingOpsRef,
        moveClipToRow: vi.fn(),
        createTrackAndMoveClip: vi.fn(),
        selectClip: vi.fn(),
        selectClips: vi.fn(),
        selectedClipIdsRef: { current: new Set<string>() },
        applyEdit: vi.fn(),
        coordinator: makeCoordinator(),
        rowHeight: 48,
        scale: 1,
        scaleWidth: 100,
        startLeft: 0,
      }));

      act(() => {
        fireEvent.pointerDown(clip, {
          button: 0,
          pointerId: 1,
          clientX: 24,
          clientY: 12,
        });
      });
      expect(pendingOpsRef.current).toBe(1);

      act(() => {
        fireEvent.pointerUp(window, {
          pointerId: 1,
          clientX: 24,
          clientY: 12,
        });
      });
      expect(pendingOpsRef.current).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('returns pendingOpsRef to 0 on pointercancel', () => {
    const pendingOpsRef = { current: 0 };
    const { clip, wrapper, cleanup } = setupDom();
    const timelineWrapperRef = { current: wrapper };
    const dataRef = { current: makeData() };

    try {
      renderHook(() => useClipDrag({
        timelineWrapperRef,
        dataRef,
        pendingOpsRef,
        moveClipToRow: vi.fn(),
        createTrackAndMoveClip: vi.fn(),
        selectClip: vi.fn(),
        selectClips: vi.fn(),
        selectedClipIdsRef: { current: new Set<string>() },
        applyEdit: vi.fn(),
        coordinator: makeCoordinator(),
        rowHeight: 48,
        scale: 1,
        scaleWidth: 100,
        startLeft: 0,
      }));

      act(() => {
        fireEvent.pointerDown(clip, {
          button: 0,
          pointerId: 2,
          clientX: 24,
          clientY: 12,
        });
      });
      expect(pendingOpsRef.current).toBe(1);

      act(() => {
        fireEvent.pointerCancel(window, {
          pointerId: 2,
          clientX: 24,
          clientY: 12,
        });
      });
      expect(pendingOpsRef.current).toBe(0);
    } finally {
      cleanup();
    }
  });
});
