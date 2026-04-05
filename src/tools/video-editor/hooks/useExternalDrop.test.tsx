// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  GENERATION_MULTI_DRAG_TYPE,
  setMultiGenerationDragData,
  type GenerationDropData,
} from '@/shared/lib/dnd/dragDrop';
import { useExternalDrop } from './useExternalDrop';

function createStoredDragPayload(items: GenerationDropData[]) {
  const storedData: Record<string, string> = {};
  const dragStartEvent = {
    dataTransfer: {
      effectAllowed: 'none',
      setData: (type: string, value: string) => {
        storedData[type] = value;
      },
    },
  } as unknown as React.DragEvent;

  setMultiGenerationDragData(dragStartEvent, items);
  return storedData;
}

function createDropEvent(data: Record<string, string>, types: string[] = [GENERATION_MULTI_DRAG_TYPE, 'text/plain']) {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX: 120,
    clientY: 48,
    currentTarget: { dataset: {} as Record<string, string> },
    dataTransfer: {
      types,
      files: [],
      items: [],
      getData: (type: string) => data[type] ?? '',
      setData: vi.fn(),
    },
  } as unknown as React.DragEvent<HTMLDivElement>;
}

describe('useExternalDrop', () => {
  it('accepts generation-multi drags during drag over', () => {
    const dataRef = { current: null } as React.MutableRefObject<any>;
    const event = createDropEvent({
      [GENERATION_MULTI_DRAG_TYPE]: JSON.stringify([{
        generationId: 'gen-1',
        imageUrl: 'https://example.com/image.png',
      }]),
      'text/plain': '__reigh_generation_multi__:[{"generationId":"gen-1","imageUrl":"https://example.com/image.png"}]',
    });

    const coordinator = {
      update: vi.fn(() => ({
        time: 0,
        rowIndex: 0,
        trackId: 'V1',
        trackKind: 'visual',
        trackName: 'V1',
        isNewTrack: false,
        isReject: false,
        isNewTrackTop: false,
        newTrackKind: null,
        screenCoords: {
          rowTop: 0,
          rowLeft: 0,
          rowWidth: 0,
          rowHeight: 0,
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

    const { result } = renderHook(() => useExternalDrop({
      dataRef,
      scale: 1,
      scaleWidth: 1,
      selectedTrackId: null,
      applyTimelineEdit: vi.fn(),
      patchRegistry: vi.fn(),
      registerAsset: vi.fn(),
      uploadAsset: vi.fn(),
      invalidateAssetRegistry: vi.fn(),
      resolveAssetUrl: vi.fn(),
      coordinator,
      registerGenerationAsset: vi.fn(),
      uploadImageGeneration: vi.fn(),
      handleAssetDrop: vi.fn(),
    }));

    result.current.onTimelineDragOver(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.currentTarget.dataset.dragOver).toBe('true');
  });

  it('drops multi-generation payloads sequentially and checks the multi payload before the single payload', async () => {
    const dataRef = {
      current: {
        tracks: [{ id: 'V1', kind: 'visual', label: 'V1' }],
        rows: [],
        registry: { assets: {} as Record<string, { file: string; type?: string; duration?: number }> },
      },
    } as React.MutableRefObject<any>;

    const patchRegistry = vi.fn((assetId: string, entry: { file: string; type?: string; duration?: number }) => {
      dataRef.current.registry.assets[assetId] = entry;
    });
    const registerGenerationAsset = vi.fn((generation: GenerationDropData) => {
      const assetId = `asset-${generation.generationId}`;
      const type = generation.variantType === 'video' ? 'video/mp4' : 'image/png';
      dataRef.current.registry.assets[assetId] = {
        file: generation.imageUrl,
        type,
      };
      return assetId;
    });
    const handleAssetDrop = vi.fn((
      _assetKey: string,
      trackId: string | undefined,
      _time: number,
      forceNewTrack?: boolean,
      insertAtTop?: boolean,
    ) => {
      if (!forceNewTrack) {
        return;
      }

      const newTrack = { id: 'V2', kind: 'visual', label: 'V2' };
      dataRef.current = {
        ...dataRef.current,
        tracks: insertAtTop
          ? [newTrack, ...dataRef.current.tracks]
          : [...dataRef.current.tracks, newTrack],
      };

      if (trackId) {
        throw new Error('expected first multi-drop to create a new track');
      }
    });

    const coordinator = {
      update: vi.fn(),
      showSecondaryGhosts: vi.fn(),
      end: vi.fn(),
      lastPosition: {
        time: 12,
        rowIndex: 0,
        trackId: undefined,
        trackKind: 'visual',
        trackName: '',
        isNewTrack: true,
        isNewTrackTop: false,
        isReject: false,
        newTrackKind: 'visual',
        screenCoords: {
          rowTop: 0,
          rowLeft: 0,
          rowWidth: 0,
          rowHeight: 0,
          clipLeft: 0,
          clipWidth: 0,
          ghostCenter: 0,
        },
      },
      editAreaRef: { current: null },
    };

    const { result } = renderHook(() => useExternalDrop({
      dataRef,
      scale: 1,
      scaleWidth: 1,
      selectedTrackId: null,
      applyTimelineEdit: vi.fn(),
      patchRegistry,
      registerAsset: vi.fn(),
      uploadAsset: vi.fn(),
      invalidateAssetRegistry: vi.fn(),
      resolveAssetUrl: vi.fn(),
      coordinator,
      registerGenerationAsset,
      uploadImageGeneration: vi.fn(),
      handleAssetDrop,
    }));

    const multiItems: GenerationDropData[] = [
      {
        generationId: 'gen-video',
        variantType: 'video',
        imageUrl: 'https://example.com/video.mp4',
        metadata: {
          content_type: 'video/mp4',
          duration_seconds: 8,
        },
      },
      {
        generationId: 'gen-image',
        variantType: 'image',
        imageUrl: 'https://example.com/image.png',
        metadata: {
          content_type: 'image/png',
        },
      },
    ];
    const storedData = createStoredDragPayload(multiItems);
    const event = createDropEvent(storedData);

    await result.current.onTimelineDrop(event);

    expect(registerGenerationAsset).toHaveBeenCalledTimes(2);
    expect(handleAssetDrop).toHaveBeenNthCalledWith(1, 'asset-gen-video', undefined, 12, true, false);
    expect(handleAssetDrop).toHaveBeenNthCalledWith(2, 'asset-gen-image', 'V2', 20, false, false);
    expect(patchRegistry).toHaveBeenCalledWith('asset-gen-video', {
      file: 'https://example.com/video.mp4',
      type: 'video/mp4',
      duration: 8,
    }, 'https://example.com/video.mp4');
  });
});
