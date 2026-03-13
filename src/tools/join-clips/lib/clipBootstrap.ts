import { generateUUID } from '@/shared/lib/taskCreation';
import type { JoinClipsSettings } from '@/shared/lib/joinClips/defaults';
import type { TransitionPrompt, VideoClip } from '../clipTypes';

function createEmptyClip(): VideoClip {
  return { id: generateUUID(), url: '', loaded: false, playing: false };
}

interface InitialClipsResult {
  clips: VideoClip[];
  transitionPrompts: TransitionPrompt[];
  posterUrlsToPreload: string[];
}

type CanonicalJoinClip = JoinClipsSettings['clips'][number];
type CanonicalTransitionPrompt = JoinClipsSettings['transitionPrompts'][number];

interface LegacyJoinClipsSettingsShape {
  clips?: CanonicalJoinClip[];
  transitionPrompts?: CanonicalTransitionPrompt[];
  startingVideoUrl?: string;
  startingVideoPosterUrl?: string;
  endingVideoUrl?: string;
  endingVideoPosterUrl?: string;
  prompt?: string;
}

type JoinClipsBootstrapSettings = JoinClipsSettings | LegacyJoinClipsSettingsShape;

function normalizeLegacyJoinClipsSettings(
  settings: JoinClipsBootstrapSettings,
): Pick<JoinClipsSettings, 'clips' | 'transitionPrompts'> {
  if (settings.clips && settings.clips.length > 0) {
    return {
      clips: settings.clips,
      transitionPrompts: settings.transitionPrompts ?? [],
    };
  }

  const clips: CanonicalJoinClip[] = [];
  if (settings.startingVideoUrl) {
    clips.push({
      url: settings.startingVideoUrl,
      ...(settings.startingVideoPosterUrl ? { posterUrl: settings.startingVideoPosterUrl } : {}),
    });
  }
  if (settings.endingVideoUrl) {
    clips.push({
      url: settings.endingVideoUrl,
      ...(settings.endingVideoPosterUrl ? { posterUrl: settings.endingVideoPosterUrl } : {}),
    });
  }

  const transitionPrompts = clips.length >= 2 && settings.prompt
    ? [{ clipIndex: 1, prompt: settings.prompt }]
    : [];

  return { clips, transitionPrompts };
}

export function buildInitialClipsFromSettings(
  settings: JoinClipsBootstrapSettings,
): InitialClipsResult {
  const normalizedSettings = normalizeLegacyJoinClipsSettings(settings);
  const initialClips: VideoClip[] = [];
  const posterUrlsToPreload: string[] = [];
  let transitionPrompts: TransitionPrompt[] = [];

  if (normalizedSettings.clips.length > 0) {
    normalizedSettings.clips.forEach((clip) => {
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
        if (clip.posterUrl) {
          posterUrlsToPreload.push(clip.posterUrl);
        }
      }
    });

    if (normalizedSettings.transitionPrompts.length > 0) {
      transitionPrompts = normalizedSettings.transitionPrompts
        .map((transitionPrompt) => ({
          id: initialClips[transitionPrompt.clipIndex]?.id || '',
          prompt: transitionPrompt.prompt,
        }))
        .filter((prompt) => prompt.id);
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
