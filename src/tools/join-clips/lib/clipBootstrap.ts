import { generateUUID } from '@/shared/lib/taskCreation';
import type { JoinClipsSettings } from '@/shared/lib/joinClips/defaults';
import type { TransitionPrompt, VideoClip } from '../types';

function createEmptyClip(): VideoClip {
  return { id: generateUUID(), url: '', loaded: false, playing: false };
}

interface InitialClipsResult {
  clips: VideoClip[];
  transitionPrompts: TransitionPrompt[];
  posterUrlsToPreload: string[];
}

export function buildInitialClipsFromSettings(
  settings: JoinClipsSettings,
): InitialClipsResult {
  const initialClips: VideoClip[] = [];
  const posterUrlsToPreload: string[] = [];
  let transitionPrompts: TransitionPrompt[] = [];

  // Try loading from new multi-clip format
  if (settings.clips && settings.clips.length > 0) {
    settings.clips.forEach(clip => {
      if (clip.url) {
        initialClips.push({
          id: generateUUID(),
          url: clip.url,
          posterUrl: clip.posterUrl,
          finalFrameUrl: clip.finalFrameUrl,
          durationSeconds: clip.durationSeconds,
          loaded: false,
          playing: false,
        });
        if (clip.posterUrl) posterUrlsToPreload.push(clip.posterUrl);
      }
    });

    // Load transition prompts
    if (settings.transitionPrompts && settings.transitionPrompts.length > 0) {
      transitionPrompts = settings.transitionPrompts
        .map(tp => ({
          id: initialClips[tp.clipIndex]?.id || '',
          prompt: tp.prompt,
        }))
        .filter(p => p.id);
    }
  }
  // Fallback to legacy two-video format
  else if (settings.startingVideoUrl || settings.endingVideoUrl) {
    if (settings.startingVideoUrl) {
      initialClips.push({
        id: generateUUID(),
        url: settings.startingVideoUrl,
        posterUrl: settings.startingVideoPosterUrl,
        loaded: false,
        playing: false,
      });
      if (settings.startingVideoPosterUrl) {
        posterUrlsToPreload.push(settings.startingVideoPosterUrl);
      }
    }

    if (settings.endingVideoUrl) {
      initialClips.push({
        id: generateUUID(),
        url: settings.endingVideoUrl,
        posterUrl: settings.endingVideoPosterUrl,
        loaded: false,
        playing: false,
      });
      if (settings.endingVideoPosterUrl) {
        posterUrlsToPreload.push(settings.endingVideoPosterUrl);
      }
    }

    // Initialize transition prompts from legacy format
    // The `prompt` field existed in an older settings schema and may still
    // be present in persisted data even though it's not in the current type.
    const legacyPrompt = (settings as JoinClipsSettings & { prompt?: string }).prompt;
    if (initialClips.length >= 2 && legacyPrompt) {
      transitionPrompts = [
        {
          id: initialClips[1].id,
          prompt: legacyPrompt,
        },
      ];
    }
  }

  return { clips: initialClips, transitionPrompts, posterUrlsToPreload };
}

/**
 * Pad initialClips to have at least 2 slots plus one trailing empty slot.
 * This matches the original hook behavior exactly.
 */
export function padClipsWithEmptySlots(initialClips: VideoClip[]): VideoClip[] {
  if (initialClips.length === 0) {
    return [createEmptyClip(), createEmptyClip()];
  }

  if (initialClips.length < 2) {
    const clipsToAdd = 2 - initialClips.length;
    const emptyClips = Array.from({ length: clipsToAdd }, () => createEmptyClip());
    return [...initialClips, ...emptyClips];
  }

  // >= 2 clips: add one trailing empty slot
  return [...initialClips, createEmptyClip()];
}
