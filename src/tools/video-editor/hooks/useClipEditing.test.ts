import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Shot } from '@/domains/generation/types';
import { patchAffectsDuration, recalcActionEnd } from '@/tools/video-editor/lib/clip-editing-utils';
import { useClipEditing } from '@/tools/video-editor/hooks/useClipEditing';
import { usePinnedGroupSync } from '@/tools/video-editor/hooks/usePinnedShotGroups';
import { useSwitchToFinalVideo } from '@/tools/video-editor/hooks/useSwitchToFinalVideo';
import { configToRows, type ClipMeta, type TimelineData } from '@/tools/video-editor/lib/timeline-data';
import { TimelineEventBus } from '@/tools/video-editor/hooks/useTimelineEventBus';
import { useTimelineCommit } from '@/tools/video-editor/hooks/useTimelineCommit';
import type { TimelineRow } from '@/tools/video-editor/types/timeline-canvas';
import type { AssetRegistry, TimelineConfig } from '@/tools/video-editor/types';

const makeTimelineData = (overrides?: {
  rows?: TimelineRow[];
  meta?: Record<string, ClipMeta>;
}): TimelineData => ({
  config: { output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' }, clips: [] },
  configVersion: 1,
  registry: { assets: {} },
  resolvedConfig: { output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' }, tracks: [], clips: [], registry: {} },
  rows: overrides?.rows ?? [],
  meta: overrides?.meta ?? {},
  effects: {},
  assetMap: {},
  output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' },
  tracks: [],
  clipOrder: {},
  signature: 'signature',
  stableSignature: 'stable-signature',
});

function makeConfigTimelineData(config: TimelineConfig, registry: AssetRegistry): TimelineData {
  const rowData = configToRows(config);

  return {
    config,
    configVersion: 1,
    registry,
    resolvedConfig: {
      output: { ...config.output },
      tracks: (config.tracks ?? []).map((track) => ({ ...track })),
      clips: config.clips.map((clip) => ({
        ...clip,
        assetEntry: clip.asset ? {
          ...registry.assets[clip.asset],
          src: registry.assets[clip.asset]?.file ?? '',
        } : undefined,
      })),
      registry: Object.fromEntries(
        Object.entries(registry.assets).map(([assetId, entry]) => [
          assetId,
          { ...entry, src: entry.file },
        ]),
      ),
    },
    rows: rowData.rows,
    meta: rowData.meta,
    effects: rowData.effects,
    assetMap: Object.fromEntries(Object.entries(registry.assets).map(([assetId, entry]) => [assetId, entry.file])),
    output: { ...config.output },
    tracks: (config.tracks ?? []).map((track) => ({ ...track })),
    clipOrder: rowData.clipOrder,
    signature: 'signature',
    stableSignature: 'stable-signature',
  };
}

describe('useClipEditing duration recalculation', () => {
  it('recalcActionEnd handles speed, from, to, and hold patches', () => {
    const action = { id: 'clip-1', start: 5, end: 9, effectId: 'effect-clip-1' };

    expect(recalcActionEnd(action, { from: 0, to: 4, speed: 2 })).toBe(7);
    expect(recalcActionEnd(action, { from: 1, to: 4, speed: 1 })).toBe(8);
    expect(recalcActionEnd(action, { from: 0, to: 3, speed: 1 })).toBe(8);
    expect(recalcActionEnd(action, { from: 0, to: 3, speed: 2, hold: 10 })).toBe(10);
  });

  it('patchAffectsDuration only flags duration keys', () => {
    expect(patchAffectsDuration({ speed: 2 })).toBe(true);
    expect(patchAffectsDuration({ from: 1 })).toBe(true);
    expect(patchAffectsDuration({ to: 3 })).toBe(true);
    expect(patchAffectsDuration({ hold: 10 })).toBe(true);
    expect(patchAffectsDuration({ x: 20 })).toBe(false);
    expect(patchAffectsDuration({ opacity: 0.5 })).toBe(false);
  });

  it('recalculates action.end for single-clip duration edits', () => {
    const applyEdit = vi.fn();
    const dataRef = {
      current: makeTimelineData({
        rows: [{ id: 'V1', actions: [{ id: 'clip-1', start: 0, end: 4, effectId: 'effect-clip-1' }] }],
        meta: { 'clip-1': { track: 'V1', from: 0, to: 4, speed: 1 } },
      }),
    };

    const { result } = renderHook(() => useClipEditing({
      dataRef,
      resolvedConfig: null,
      selectedClipId: 'clip-1',
      selectedTrack: null,
      currentTime: 0,
      setSelectedClipId: vi.fn(),
      setSelectedTrackId: vi.fn(),
      applyEdit,
    }));

    act(() => {
      result.current.handleSelectedClipChange({ speed: 2 });
    });

    expect(applyEdit).toHaveBeenCalledWith({
      type: 'rows',
      rows: [{ id: 'V1', actions: [{ id: 'clip-1', start: 0, end: 2, effectId: 'effect-clip-1' }] }],
      metaUpdates: { 'clip-1': { speed: 2 } },
    });
  });

  it('recalculates action.end for bulk duration edits', () => {
    const applyEdit = vi.fn();
    const dataRef = {
      current: makeTimelineData({
        rows: [
          {
            id: 'V1',
            actions: [
              { id: 'clip-1', start: 0, end: 4, effectId: 'effect-clip-1' },
              { id: 'clip-2', start: 4, end: 7, effectId: 'effect-clip-2' },
            ],
          },
        ],
        meta: {
          'clip-1': { track: 'V1', from: 0, to: 4, speed: 1 },
          'clip-2': { track: 'V1', from: 0, to: 3, speed: 1 },
        },
      }),
    };

    const { result } = renderHook(() => useClipEditing({
      dataRef,
      resolvedConfig: null,
      selectedClipId: null,
      selectedTrack: null,
      currentTime: 0,
      setSelectedClipId: vi.fn(),
      setSelectedTrackId: vi.fn(),
      applyEdit,
    }));

    act(() => {
      result.current.handleUpdateClips(['clip-1', 'clip-2'], { speed: 2 });
    });

    expect(applyEdit).toHaveBeenCalledWith({
      type: 'rows',
      rows: [
        {
          id: 'V1',
          actions: [
            { id: 'clip-1', start: 0, end: 2, effectId: 'effect-clip-1' },
            { id: 'clip-2', start: 4, end: 5.5, effectId: 'effect-clip-2' },
          ],
        },
      ],
      metaUpdates: {
        'clip-1': { speed: 2 },
        'clip-2': { speed: 2 },
      },
    });
  });
});

describe('useTimelineCommit pinned shot reconciliation', () => {
  it('reconciles deleted pinned clips inline without a second commit boundary', () => {
    const eventBus = new TimelineEventBus();
    const beforeCommit = vi.fn();
    const lastSavedSignatureRef = { current: 'stable-signature' };
    eventBus.on('beforeCommit', beforeCommit);

    const initialData = makeConfigTimelineData(
      {
        output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' },
        tracks: [{ id: 'V1', kind: 'visual', label: 'V1' }],
        clips: [
          { id: 'clip-1', at: 0, track: 'V1', clipType: 'hold', asset: 'asset-1', hold: 5 },
          { id: 'clip-2', at: 5, track: 'V1', clipType: 'hold', asset: 'asset-2', hold: 5 },
        ],
        pinnedShotGroups: [{
          shotId: 'shot-1',
          trackId: 'V1',
          clipIds: ['clip-1', 'clip-2'],
          mode: 'images',
        }],
      },
      {
        assets: {
          'asset-1': { file: 'one.png', type: 'image/png' },
          'asset-2': { file: 'two.png', type: 'image/png' },
        },
      },
    );

    const { result } = renderHook(() => useTimelineCommit({ eventBus, lastSavedSignatureRef }));

    act(() => {
      result.current.commitData(initialData, { save: false, selectedTrackId: 'V1' });
    });

    act(() => {
      result.current.applyEdit({
        type: 'rows',
        rows: [{ id: 'V1', actions: [{ id: 'clip-1', start: 0, end: 5, effectId: 'effect-clip-1' }] }],
        metaDeletes: ['clip-2'],
        clipOrderOverride: { V1: ['clip-1'] },
      });
    });

    expect(beforeCommit).toHaveBeenCalledTimes(1);
    expect(result.current.dataRef.current?.config.pinnedShotGroups).toEqual([{
      shotId: 'shot-1',
      trackId: 'V1',
      clipIds: ['clip-1'],
      mode: 'images',
    }]);
  });

  it('restores image snapshots inline when a pinned video clip is deleted', () => {
    const eventBus = new TimelineEventBus();
    const lastSavedSignatureRef = { current: 'stable-signature' };
    const initialData = makeConfigTimelineData(
      {
        output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' },
        tracks: [{ id: 'V1', kind: 'visual', label: 'V1' }],
        clips: [
          { id: 'video-1', at: 10, track: 'V1', clipType: 'media', asset: 'asset-video', from: 0, to: 10, speed: 1 },
        ],
        pinnedShotGroups: [{
          shotId: 'shot-1',
          trackId: 'V1',
          clipIds: ['video-1'],
          mode: 'video',
          videoAssetKey: 'asset-video',
          imageClipSnapshot: [
            { clipId: 'img-1', assetKey: 'asset-1', meta: { clipType: 'hold', hold: 3 } },
            { clipId: 'img-2', assetKey: 'asset-2', meta: { clipType: 'hold', hold: 4 } },
          ],
        }],
      },
      {
        assets: {
          'asset-video': { file: 'video.mp4', type: 'video/mp4', duration: 10 },
          'asset-1': { file: 'one.png', type: 'image/png' },
          'asset-2': { file: 'two.png', type: 'image/png' },
        },
      },
    );

    const { result } = renderHook(() => useTimelineCommit({ eventBus, lastSavedSignatureRef }));

    act(() => {
      result.current.commitData(initialData, { save: false, selectedTrackId: 'V1' });
    });

    act(() => {
      result.current.applyEdit({
        type: 'rows',
        rows: [{ id: 'V1', actions: [] }],
        metaDeletes: ['video-1'],
        clipOrderOverride: { V1: [] },
      });
    });

    expect(result.current.dataRef.current?.config.pinnedShotGroups).toEqual([{
      shotId: 'shot-1',
      trackId: 'V1',
      clipIds: ['img-1', 'img-2'],
      mode: 'images',
      imageClipSnapshot: [
        { clipId: 'img-1', assetKey: 'asset-1', meta: { clipType: 'hold', hold: 3 } },
        { clipId: 'img-2', assetKey: 'asset-2', meta: { clipType: 'hold', hold: 4 } },
      ],
    }]);
    expect(result.current.dataRef.current?.rows).toEqual([{
      id: 'V1',
      actions: [
        { id: 'img-1', start: 10, end: 13, effectId: 'effect-img-1' },
        { id: 'img-2', start: 13, end: 17, effectId: 'effect-img-2' },
      ],
    }]);
  });
});

describe('useSwitchToFinalVideo', () => {
  it('snapshots image clips before switching to video and writes pinnedShotGroupsOverride in one edit', () => {
    const applyEdit = vi.fn();
    const patchRegistry = vi.fn();
    const registerAsset = vi.fn(async () => undefined);
    const dataRef = {
      current: makeConfigTimelineData(
        {
          output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' },
          tracks: [{ id: 'V1', kind: 'visual', label: 'V1' }],
          clips: [
            { id: 'clip-1', at: 0, track: 'V1', clipType: 'hold', asset: 'asset-1', hold: 5 },
            { id: 'clip-2', at: 5, track: 'V1', clipType: 'hold', asset: 'asset-2', hold: 5 },
          ],
        },
        {
          assets: {
            'asset-1': { file: 'one.png', type: 'image/png', generationId: 'gen-1' },
            'asset-2': { file: 'two.png', type: 'image/png', generationId: 'gen-2' },
          },
        },
      ),
    };

    const { result } = renderHook(() => useSwitchToFinalVideo({
      applyEdit,
      dataRef,
      finalVideoMap: new Map([['shot-1', { id: 'final-1', location: 'https://example.com/final.mp4', thumbnailUrl: null }]]),
      patchRegistry,
      registerAsset,
    }));

    act(() => {
      result.current.switchToFinalVideo({ shotId: 'shot-1', clipIds: ['clip-1', 'clip-2'], rowId: 'V1' });
    });

    expect(applyEdit).toHaveBeenCalledTimes(1);
    const mutation = applyEdit.mock.calls[0][0];
    expect(mutation.type).toBe('rows');
    expect(mutation.metaDeletes).toEqual(['clip-1', 'clip-2']);
    expect(mutation.pinnedShotGroupsOverride).toEqual([{
      shotId: 'shot-1',
      trackId: 'V1',
      clipIds: ['clip-3'],
      mode: 'video',
      videoAssetKey: expect.any(String),
      imageClipSnapshot: [
        { clipId: 'clip-1', assetKey: 'asset-1', meta: { clipType: 'hold', hold: 5, opacity: undefined, from: undefined, to: undefined, speed: undefined, volume: undefined, x: undefined, y: undefined, width: undefined, height: undefined, cropTop: undefined, cropBottom: undefined, cropLeft: undefined, cropRight: undefined, text: undefined, entrance: undefined, exit: undefined, continuous: undefined, transition: undefined, effects: undefined } },
        { clipId: 'clip-2', assetKey: 'asset-2', meta: { clipType: 'hold', hold: 5, opacity: undefined, from: undefined, to: undefined, speed: undefined, volume: undefined, x: undefined, y: undefined, width: undefined, height: undefined, cropTop: undefined, cropBottom: undefined, cropLeft: undefined, cropRight: undefined, text: undefined, entrance: undefined, exit: undefined, continuous: undefined, transition: undefined, effects: undefined } },
      ],
    }]);
    expect(patchRegistry).toHaveBeenCalledTimes(1);
  });

  it('restores image clips from snapshot in one edit when switching back to images', () => {
    const applyEdit = vi.fn();
    const dataRef = {
      current: makeConfigTimelineData(
        {
          output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' },
          tracks: [{ id: 'V1', kind: 'visual', label: 'V1' }],
          clips: [
            { id: 'clip-3', at: 0, track: 'V1', clipType: 'media', asset: 'asset-video', from: 0, to: 10, speed: 1 },
          ],
          pinnedShotGroups: [{
            shotId: 'shot-1',
            trackId: 'V1',
            clipIds: ['clip-3'],
            mode: 'video',
            videoAssetKey: 'asset-video',
            imageClipSnapshot: [
              { clipId: 'clip-1', assetKey: 'asset-1', meta: { clipType: 'hold', hold: 3 } },
              { clipId: 'clip-2', assetKey: 'asset-2', meta: { clipType: 'hold', hold: 4 } },
            ],
          }],
        },
        {
          assets: {
            'asset-video': { file: 'video.mp4', type: 'video/mp4' },
            'asset-1': { file: 'one.png', type: 'image/png' },
            'asset-2': { file: 'two.png', type: 'image/png' },
          },
        },
      ),
    };

    const { result } = renderHook(() => useSwitchToFinalVideo({
      applyEdit,
      dataRef,
      finalVideoMap: new Map(),
      patchRegistry: vi.fn(),
      registerAsset: vi.fn(async () => undefined),
    }));

    act(() => {
      result.current.switchToImages({ shotId: 'shot-1', rowId: 'V1' });
    });

    expect(applyEdit).toHaveBeenCalledTimes(1);
    const mutation = applyEdit.mock.calls[0][0];
    expect(mutation.type).toBe('rows');
    expect(mutation.metaDeletes).toEqual(['clip-3']);
    expect(mutation.pinnedShotGroupsOverride).toEqual([{
      shotId: 'shot-1',
      trackId: 'V1',
      clipIds: ['clip-1', 'clip-2'],
      mode: 'images',
      imageClipSnapshot: [
        { clipId: 'clip-1', assetKey: 'asset-1', meta: { clipType: 'hold', hold: 3 } },
        { clipId: 'clip-2', assetKey: 'asset-2', meta: { clipType: 'hold', hold: 4 } },
      ],
    }]);
  });
});

describe('usePinnedGroupSync', () => {
  it('debounces image-mode sync and applies rows edits through applyEdit', () => {
    vi.useFakeTimers();
    const applyEdit = vi.fn();
    const dataRef = {
      current: makeConfigTimelineData(
        {
          output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' },
          tracks: [{ id: 'V1', kind: 'visual', label: 'V1' }],
          clips: [
            { id: 'clip-1', at: 0, track: 'V1', clipType: 'hold', asset: 'asset-1', hold: 5 },
          ],
          pinnedShotGroups: [{
            shotId: 'shot-1',
            trackId: 'V1',
            clipIds: ['clip-1'],
            mode: 'images',
          }],
        },
        {
          assets: {
            'asset-1': { file: 'one.png', type: 'image/png', generationId: 'gen-1' },
          },
        },
      ),
    };
    const shots: Shot[] = [{
      id: 'shot-1',
      name: 'Shot 1',
      images: [
        { generation_id: 'gen-1', imageUrl: 'https://example.com/one.png', type: 'image/png' },
        { generation_id: 'gen-2', imageUrl: 'https://example.com/two.png', type: 'image/png' },
      ],
    } as Shot];
    const registerGenerationAsset = vi.fn((generation: { generationId: string; imageUrl: string }) => {
      const assetId = 'asset-2';
      dataRef.current.registry.assets[assetId] = {
        file: generation.imageUrl,
        type: 'image/png',
        generationId: generation.generationId,
      };
      return assetId;
    });

    renderHook(() => usePinnedGroupSync({
      data: dataRef.current,
      dataRef,
      applyEdit,
      shots,
      registerGenerationAsset,
      debounceMs: 25,
    }));

    act(() => {
      vi.advanceTimersByTime(24);
    });
    expect(applyEdit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(applyEdit).toHaveBeenCalledTimes(1);
    const mutation = applyEdit.mock.calls[0][0];
    expect(mutation.type).toBe('rows');
    expect(mutation.pinnedShotGroupsOverride).toEqual([{
      shotId: 'shot-1',
      trackId: 'V1',
      clipIds: ['clip-1', 'clip-2'],
      mode: 'images',
    }]);
    vi.useRealTimers();
  });

  it('does not sync pinned groups that are in video mode', () => {
    vi.useFakeTimers();
    const applyEdit = vi.fn();
    const dataRef = {
      current: makeConfigTimelineData(
        {
          output: { resolution: '1920x1080', fps: 30, file: 'out.mp4' },
          tracks: [{ id: 'V1', kind: 'visual', label: 'V1' }],
          clips: [
            { id: 'clip-1', at: 0, track: 'V1', clipType: 'media', asset: 'asset-1', from: 0, to: 5, speed: 1 },
          ],
          pinnedShotGroups: [{
            shotId: 'shot-1',
            trackId: 'V1',
            clipIds: ['clip-1'],
            mode: 'video',
          }],
        },
        {
          assets: {
            'asset-1': { file: 'video.mp4', type: 'video/mp4', generationId: 'final-1' },
          },
        },
      ),
    };

    renderHook(() => usePinnedGroupSync({
      data: dataRef.current,
      dataRef,
      applyEdit,
      shots: [{
        id: 'shot-1',
        name: 'Shot 1',
        images: [{ generation_id: 'gen-1', imageUrl: 'https://example.com/one.png', type: 'image/png' }],
      } as Shot],
      registerGenerationAsset: vi.fn(),
      debounceMs: 25,
    }));

    act(() => {
      vi.advanceTimersByTime(25);
    });

    expect(applyEdit).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
