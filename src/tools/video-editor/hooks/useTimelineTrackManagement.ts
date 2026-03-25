import { useCallback, useMemo } from 'react';
import { addTrack } from '@/tools/video-editor/lib/editor-utils';
import { DEFAULT_VIDEO_TRACKS } from '@/tools/video-editor/lib/defaults';
import type { TrackDefinition, TrackKind } from '@/tools/video-editor/types';
import { moveClipBetweenTracks } from '@/tools/video-editor/lib/coordinate-utils';
import type { TimelineData } from '@/tools/video-editor/lib/timeline-data';
import type { UseTimelineDataResult } from '@/tools/video-editor/hooks/useTimelineData';

export interface UseTimelineTrackManagementArgs {
  dataRef: React.MutableRefObject<TimelineData | null>;
  resolvedConfig: TimelineData['resolvedConfig'] | null;
  selectedClipId: string | null;
  setSelectedTrackId: React.Dispatch<React.SetStateAction<string | null>>;
  applyTimelineEdit: UseTimelineDataResult['applyTimelineEdit'];
  applyResolvedConfigEdit: UseTimelineDataResult['applyResolvedConfigEdit'];
}

export interface UseTimelineTrackManagementResult {
  handleAddTrack: (kind: TrackKind) => void;
  handleTrackPopoverChange: (trackId: string, patch: Partial<TrackDefinition>) => void;
  handleReorderTrack: (trackId: string, direction: -1 | 1) => void;
  handleRemoveTrack: (trackId: string) => void;
  handleClearUnusedTracks: () => void;
  unusedTrackCount: number;
  moveClipToRow: (clipId: string, targetRowId: string, newStartTime?: number) => void;
  createTrackAndMoveClip: (clipId: string, kind: TrackKind, newStartTime?: number) => void;
  moveSelectedClipToTrack: (direction: 'up' | 'down') => void;
}

export function useTimelineTrackManagement({
  dataRef,
  resolvedConfig,
  selectedClipId,
  setSelectedTrackId,
  applyTimelineEdit,
  applyResolvedConfigEdit,
}: UseTimelineTrackManagementArgs): UseTimelineTrackManagementResult {
  const moveClipToRow = useCallback((clipId: string, targetRowId: string, newStartTime?: number) => {
    const current = dataRef.current;
    if (!current) {
      return;
    }

    const sourceRow = current.rows.find((row) => row.actions.some((action) => action.id === clipId));
    const targetRow = current.rows.find((row) => row.id === targetRowId);
    if (!sourceRow || !targetRow) {
      return;
    }

    const sourceTrack = current.tracks.find((track) => track.id === sourceRow.id);
    const targetTrack = current.tracks.find((track) => track.id === targetRow.id);
    const action = sourceRow.actions.find((candidate) => candidate.id === clipId);
    if (!sourceTrack || !targetTrack || !action || sourceTrack.kind !== targetTrack.kind) {
      return;
    }

    const duration = action.end - action.start;
    const nextStart = typeof newStartTime === 'number' ? Math.max(0, newStartTime) : action.start;
    const nextAction = { ...action, start: nextStart, end: nextStart + duration };
    const nextRows = current.rows.map((row) => {
      if (sourceRow.id === targetRow.id && row.id === sourceRow.id) {
        return {
          ...row,
          actions: row.actions.map((candidate) => (candidate.id === clipId ? nextAction : candidate)),
        };
      }

      if (row.id === sourceRow.id) {
        return { ...row, actions: row.actions.filter((candidate) => candidate.id !== clipId) };
      }

      if (row.id === targetRow.id) {
        return { ...row, actions: [...row.actions, nextAction] };
      }

      return row;
    });

    const nextClipOrder = moveClipBetweenTracks(current.clipOrder, clipId, sourceRow.id, targetRow.id);
    applyTimelineEdit(nextRows, { [clipId]: { track: targetRow.id } }, undefined, nextClipOrder);
  }, [applyTimelineEdit, dataRef]);

  const createTrackAndMoveClip = useCallback((clipId: string, kind: TrackKind, newStartTime?: number) => {
    const current = dataRef.current;
    if (!current) {
      return;
    }

    const sourceClip = current.resolvedConfig.clips.find((clip) => clip.id === clipId);
    const sourceTrack = sourceClip ? current.resolvedConfig.tracks.find((track) => track.id === sourceClip.track) : null;
    if (!sourceClip || !sourceTrack || sourceTrack.kind !== kind) {
      return;
    }

    const nextResolvedConfigBase = addTrack(current.resolvedConfig, kind);
    const newTrack = nextResolvedConfigBase.tracks.find((track) => {
      return !current.resolvedConfig.tracks.some((existingTrack) => existingTrack.id === track.id);
    }) ?? nextResolvedConfigBase.tracks[nextResolvedConfigBase.tracks.length - 1];
    if (!newTrack) {
      return;
    }

    const nextResolvedConfig = {
      ...nextResolvedConfigBase,
      clips: nextResolvedConfigBase.clips.map((clip) => {
        if (clip.id !== clipId) {
          return clip;
        }

        return {
          ...clip,
          at: typeof newStartTime === 'number' ? Math.max(0, newStartTime) : clip.at,
          track: newTrack.id,
        };
      }),
    };

    applyResolvedConfigEdit(nextResolvedConfig, {
      selectedClipId: clipId,
      selectedTrackId: newTrack.id,
    });
  }, [applyResolvedConfigEdit, dataRef]);

  const moveSelectedClipToTrack = useCallback((direction: 'up' | 'down') => {
    const current = dataRef.current;
    if (!current || !selectedClipId) {
      return;
    }

    const currentRowIndex = current.rows.findIndex((row) => row.actions.some((action) => action.id === selectedClipId));
    if (currentRowIndex < 0) {
      return;
    }

    const sourceTrack = current.tracks.find((track) => track.id === current.rows[currentRowIndex]?.id);
    if (!sourceTrack) {
      return;
    }

    let targetRowIndex = currentRowIndex;
    while (true) {
      targetRowIndex += direction === 'up' ? -1 : 1;
      if (targetRowIndex < 0 || targetRowIndex >= current.rows.length) {
        return;
      }

      const targetTrack = current.tracks.find((track) => track.id === current.rows[targetRowIndex]?.id);
      if (targetTrack?.kind === sourceTrack.kind) {
        moveClipToRow(selectedClipId, targetTrack.id);
        setSelectedTrackId(targetTrack.id);
        return;
      }
    }
  }, [dataRef, moveClipToRow, selectedClipId, setSelectedTrackId]);

  const handleAddTrack = useCallback((kind: TrackKind) => {
    if (!resolvedConfig) {
      return;
    }

    const nextResolvedConfig = addTrack(resolvedConfig, kind);
    const nextTrack = nextResolvedConfig.tracks[nextResolvedConfig.tracks.length - 1] ?? null;
    applyResolvedConfigEdit(nextResolvedConfig, { selectedTrackId: nextTrack?.id ?? null });
  }, [applyResolvedConfigEdit, resolvedConfig]);

  const handleTrackPopoverChange = useCallback((trackId: string, patch: Partial<TrackDefinition>) => {
    if (!resolvedConfig) {
      return;
    }

    const nextConfig = {
      ...resolvedConfig,
      tracks: resolvedConfig.tracks.map((track) => (track.id === trackId ? { ...track, ...patch } : track)),
    };
    applyResolvedConfigEdit(nextConfig, { selectedTrackId: trackId });
  }, [applyResolvedConfigEdit, resolvedConfig]);

  const handleReorderTrack = useCallback((trackId: string, direction: -1 | 1) => {
    if (!resolvedConfig) {
      return;
    }

    const index = resolvedConfig.tracks.findIndex((track) => track.id === trackId);
    if (index < 0) {
      return;
    }

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= resolvedConfig.tracks.length) {
      return;
    }

    if (resolvedConfig.tracks[index].kind !== resolvedConfig.tracks[targetIndex].kind) {
      return;
    }

    const nextTracks = [...resolvedConfig.tracks];
    [nextTracks[index], nextTracks[targetIndex]] = [nextTracks[targetIndex], nextTracks[index]];
    applyResolvedConfigEdit({ ...resolvedConfig, tracks: nextTracks }, { selectedTrackId: trackId });
  }, [applyResolvedConfigEdit, resolvedConfig]);

  const handleRemoveTrack = useCallback((trackId: string) => {
    if (!resolvedConfig) {
      return;
    }

    const track = resolvedConfig.tracks.find((entry) => entry.id === trackId);
    if (!track) {
      return;
    }

    const sameKind = resolvedConfig.tracks.filter((entry) => entry.kind === track.kind);
    if (sameKind.length <= 1) {
      return;
    }

    const nextConfig = {
      ...resolvedConfig,
      tracks: resolvedConfig.tracks.filter((entry) => entry.id !== trackId),
      clips: resolvedConfig.clips.filter((clip) => clip.track !== trackId),
    };
    applyResolvedConfigEdit(nextConfig, { selectedTrackId: null });
  }, [applyResolvedConfigEdit, resolvedConfig]);

  const unusedTrackCount = useMemo(() => {
    if (!resolvedConfig) {
      return 0;
    }

    const tracksWithClips = new Set(resolvedConfig.clips.map((clip) => clip.track));
    const defaultTrackIds = new Set(DEFAULT_VIDEO_TRACKS.map((track) => track.id));
    return resolvedConfig.tracks.filter((track) => !tracksWithClips.has(track.id) && !defaultTrackIds.has(track.id)).length;
  }, [resolvedConfig]);

  const handleClearUnusedTracks = useCallback(() => {
    if (!resolvedConfig || unusedTrackCount === 0) {
      return;
    }

    const tracksWithClips = new Set(resolvedConfig.clips.map((clip) => clip.track));
    const defaultTrackIds = new Set(DEFAULT_VIDEO_TRACKS.map((track) => track.id));
    const visualWithClips = resolvedConfig.tracks.filter((track) => track.kind === 'visual' && tracksWithClips.has(track.id));
    const audioWithClips = resolvedConfig.tracks.filter((track) => track.kind === 'audio' && tracksWithClips.has(track.id));

    const nextTracks = resolvedConfig.tracks.filter((track) => {
      if (defaultTrackIds.has(track.id)) {
        return true;
      }

      if (tracksWithClips.has(track.id)) {
        return true;
      }

      if (track.kind === 'visual' && visualWithClips.length === 0) {
        visualWithClips.push(track);
        return true;
      }

      if (track.kind === 'audio' && audioWithClips.length === 0) {
        audioWithClips.push(track);
        return true;
      }

      return false;
    });

    applyResolvedConfigEdit({ ...resolvedConfig, tracks: nextTracks }, { selectedTrackId: null });
  }, [applyResolvedConfigEdit, resolvedConfig, unusedTrackCount]);

  return {
    handleAddTrack,
    handleTrackPopoverChange,
    handleReorderTrack,
    handleRemoveTrack,
    handleClearUnusedTracks,
    unusedTrackCount,
    moveClipToRow,
    createTrackAndMoveClip,
    moveSelectedClipToTrack,
  };
}
