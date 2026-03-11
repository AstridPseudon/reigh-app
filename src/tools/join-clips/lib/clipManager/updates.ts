import type { VideoClip } from '../../clipTypes';

/** Update a single clip in the array by ID. */
export function updateClipInArray(
  clips: VideoClip[],
  clipId: string,
  updates: Partial<VideoClip>,
): VideoClip[] {
  return clips.map(clip => (clip.id === clipId ? { ...clip, ...updates } : clip));
}

/** Clear a clip's video content but keep the slot. */
export function clearClipVideo(clip: VideoClip): VideoClip {
  return {
    ...clip,
    url: '',
    posterUrl: undefined,
    finalFrameUrl: undefined,
    file: undefined,
    loaded: false,
    playing: false,
  };
}
