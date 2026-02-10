/**
 * Pure business logic for clip management in the Join Clips tool.
 *
 * This service layer extracts non-React logic from useClipManager so the hook
 * remains a thin reactive wrapper.  Every function here is side-effect-free
 * with respect to React state (callers pass data in, get data out).
 */

import { extractVideoMetadataFromUrl } from '@/shared/lib/videoUploader';
import { uploadVideoToStorage } from '@/shared/lib/videoUploader';
import { uploadBlobToStorage } from '@/shared/lib/imageUploader';
import { extractVideoPosterFrame, extractVideoFinalFrame } from '@/shared/utils/videoPosterExtractor';
import { handleError } from '@/shared/lib/errorHandler';
import { generateUUID } from '@/shared/lib/taskCreation';
import { arrayMove } from '@dnd-kit/sortable';
import type { VideoClip, TransitionPrompt } from '../types';
import type { JoinClipsSettings } from '../settings';

// ---------------------------------------------------------------------------
// localStorage cache helpers (skeleton sizing)
// ---------------------------------------------------------------------------

function getLocalStorageKey(projectId: string): string {
  return `join-clips-count-${projectId}`;
}

export function getCachedClipsCount(projectId: string | null): number {
  if (!projectId) return 0;
  try {
    const cached = localStorage.getItem(getLocalStorageKey(projectId));
    return cached ? parseInt(cached, 10) : 0;
  } catch {
    return 0;
  }
}

export function setCachedClipsCount(projectId: string | null, count: number): void {
  if (!projectId) return;
  try {
    if (count > 0) {
      localStorage.setItem(getLocalStorageKey(projectId), count.toString());
    } else {
      localStorage.removeItem(getLocalStorageKey(projectId));
    }
  } catch {
    // Ignore localStorage errors
  }
}

// ---------------------------------------------------------------------------
// Poster preloading
// ---------------------------------------------------------------------------

/**
 * Warm the browser image cache for the given poster URLs.
 * Returns a promise that resolves when all images have loaded (or errored).
 */
export function preloadPosterImages(
  posterUrls: string[],
  alreadyPreloaded: Set<string>,
): Promise<void[]> {
  const promises = posterUrls
    .filter(url => url && !alreadyPreloaded.has(url))
    .map(
      url =>
        new Promise<void>(resolve => {
          const img = new Image();
          img.onload = () => {
            alreadyPreloaded.add(url);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        }),
    );
  return Promise.all(promises);
}

// ---------------------------------------------------------------------------
// Video duration extraction
// ---------------------------------------------------------------------------

/** Create a throwaway <video> to read duration from a URL. */
function getVideoDurationFromUrl(videoUrl: string): Promise<number> {
  return new Promise<number>(resolve => {
    const videoElement = document.createElement('video');
    videoElement.preload = 'metadata';
    videoElement.onloadedmetadata = () => resolve(videoElement.duration);
    videoElement.onerror = () => resolve(0);
    videoElement.src = videoUrl;
  });
}

/** Create a throwaway <video> to read duration from a File (revokes the object URL). */
function getVideoDurationFromFile(file: File): Promise<number> {
  return new Promise<number>(resolve => {
    const videoElement = document.createElement('video');
    videoElement.preload = 'metadata';
    videoElement.onloadedmetadata = () => {
      resolve(videoElement.duration);
      URL.revokeObjectURL(videoElement.src);
    };
    videoElement.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(videoElement.src);
    };
    videoElement.src = URL.createObjectURL(file);
  });
}

// ---------------------------------------------------------------------------
// Pending join clips (lightbox "Add to Join" localStorage polling)
// ---------------------------------------------------------------------------

interface PendingJoinClipEntry {
  videoUrl: string;
  thumbnailUrl?: string;
  generationId: string;
  timestamp: number;
}

const PENDING_CLIPS_KEY = 'pendingJoinClips';
const PENDING_CLIPS_TTL_MS = 5 * 60 * 1000;

/**
 * Reads and consumes pending join clips from localStorage.
 * Returns an array of new/updated clip data to merge into state.
 *
 * Each result item is either:
 * - `{ type: 'fill', clip }` — fill the first empty slot
 * - `{ type: 'append', clip }` — append as a new clip
 */
interface PendingClipAction {
  type: 'fill' | 'append';
  clip: VideoClip;
}

export async function consumePendingJoinClips(): Promise<PendingClipAction[]> {
  try {
    const pendingData = localStorage.getItem(PENDING_CLIPS_KEY);
    if (!pendingData) return [];

    const pendingClips: PendingJoinClipEntry[] = JSON.parse(pendingData);
    const now = Date.now();
    const recentClips = pendingClips.filter(
      clip => now - clip.timestamp < PENDING_CLIPS_TTL_MS,
    );

    if (recentClips.length === 0) {
      localStorage.removeItem(PENDING_CLIPS_KEY);
      return [];
    }

    const actions: PendingClipAction[] = [];
    // Track how many empty slots we've "used" so far across iterations
    let filledCount = 0;

    for (const { videoUrl, thumbnailUrl, generationId } of recentClips) {
      if (!videoUrl) continue;

      const durationSeconds = await getVideoDurationFromUrl(videoUrl);

      const clip: VideoClip = {
        id: generateUUID(),
        url: videoUrl,
        posterUrl: thumbnailUrl,
        durationSeconds,
        loaded: false,
        playing: false,
        generationId,
      };

      // We'll mark as 'fill' and let the caller decide ordering
      // (the hook applies fills to first empty slot, then appends)
      actions.push({ type: filledCount === 0 ? 'fill' : 'append', clip });
      filledCount++;
    }

    localStorage.removeItem(PENDING_CLIPS_KEY);
    return actions;
  } catch (error) {
    handleError(error, { context: 'JoinClipsPage', showToast: false });
    return [];
  }
}

/**
 * Apply pending clip actions to an existing clips array.
 * Reproduces the exact same merge logic from the original hook:
 * each action fills the first available empty slot, or appends.
 */
export function applyPendingClipActions(
  prevClips: VideoClip[],
  actions: PendingClipAction[],
): VideoClip[] {
  let clips = [...prevClips];
  // Track which indices have been filled by previous actions in this batch
  const filledIndices = new Set<number>();

  for (const action of actions) {
    const emptyIndex = clips.findIndex(
      (clip, idx) => !clip.url && !filledIndices.has(idx),
    );

    if (emptyIndex !== -1) {
      clips = clips.map((clip, idx) =>
        idx === emptyIndex
          ? {
              ...clip,
              url: action.clip.url,
              posterUrl: action.clip.posterUrl,
              durationSeconds: action.clip.durationSeconds,
              loaded: false,
              playing: false,
              generationId: action.clip.generationId,
            }
          : clip,
      );
      filledIndices.add(emptyIndex);
    } else {
      clips = [...clips, action.clip];
    }
  }

  return clips;
}

// ---------------------------------------------------------------------------
// Build initial clips from persisted settings
// ---------------------------------------------------------------------------

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

export function createEmptyClip(): VideoClip {
  return { id: generateUUID(), url: '', loaded: false, playing: false };
}

// ---------------------------------------------------------------------------
// Persistence serialization
// ---------------------------------------------------------------------------

export function buildClipsToSave(
  clips: VideoClip[],
): Array<{ url: string; posterUrl?: string; finalFrameUrl?: string; durationSeconds?: number }> {
  return clips
    .filter(clip => clip.url)
    .map(clip => ({
      url: clip.url,
      posterUrl: clip.posterUrl,
      finalFrameUrl: clip.finalFrameUrl,
      durationSeconds: clip.durationSeconds,
    }));
}

export function buildPromptsToSave(
  clips: VideoClip[],
  transitionPrompts: TransitionPrompt[],
): Array<{ clipIndex: number; prompt: string }> {
  return transitionPrompts
    .map(tp => {
      const clipIndex = clips.findIndex(c => c.id === tp.id);
      if (clipIndex > 0 && tp.prompt) {
        return { clipIndex, prompt: tp.prompt };
      }
      return null;
    })
    .filter((p): p is { clipIndex: number; prompt: string } => p !== null);
}

// ---------------------------------------------------------------------------
// Lazy-load metadata for clips missing duration
// ---------------------------------------------------------------------------

export function getClipsNeedingDuration(clips: VideoClip[]): VideoClip[] {
  return clips.filter(
    clip => clip.url && clip.durationSeconds === undefined && !clip.metadataLoading,
  );
}

export async function loadClipDuration(
  clip: VideoClip,
): Promise<{ id: string; durationSeconds: number }> {
  try {
    const metadata = await extractVideoMetadataFromUrl(clip.url);
    return { id: clip.id, durationSeconds: metadata.duration_seconds };
  } catch (error) {
    handleError(error, {
      context: 'JoinClipsPage',
      showToast: false,
      logData: { clipId: clip.id },
    });
    return { id: clip.id, durationSeconds: 0 };
  }
}

// ---------------------------------------------------------------------------
// Ensure minimum clips / auto-add / trim trailing empties
// ---------------------------------------------------------------------------

interface ClipNormalizationResult {
  clips: VideoClip[];
  removedClipIds: string[];
}

/**
 * Normalize the clips array:
 * - Ensure minimum 2 clips
 * - Auto-add empty slot when all slots are filled
 * - Remove extra trailing empties (keep exactly 1 trailing empty)
 *
 * Returns null if no changes are needed.
 */
export function normalizeClipSlots(clips: VideoClip[]): ClipNormalizationResult | null {
  if (clips.length === 0) return null;

  // Ensure minimum of 2
  if (clips.length < 2) {
    const clipsToAdd = 2 - clips.length;
    const newClips = Array.from({ length: clipsToAdd }, () => createEmptyClip());
    return { clips: [...clips, ...newClips], removedClipIds: [] };
  }

  // Auto-add empty slot when all filled
  if (clips.every(clip => clip.url)) {
    return {
      clips: [...clips, createEmptyClip()],
      removedClipIds: [],
    };
  }

  // Find last non-empty clip
  let lastNonEmptyIndex = -1;
  for (let i = clips.length - 1; i >= 0; i--) {
    if (clips[i].url) {
      lastNonEmptyIndex = i;
      break;
    }
  }

  const trailingEmptyCount = clips.length - lastNonEmptyIndex - 1;

  if (trailingEmptyCount > 1) {
    const targetLength = Math.max(2, lastNonEmptyIndex + 2);
    if (clips.length !== targetLength) {
      const removedClipIds = clips.slice(targetLength).map(c => c.id);
      return { clips: clips.slice(0, targetLength), removedClipIds };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Video file upload
// ---------------------------------------------------------------------------

interface UploadVideoResult {
  videoUrl: string;
  posterUrl: string;
  finalFrameUrl: string;
  durationSeconds: number;
}

export async function uploadClipVideo(
  file: File,
  projectId: string,
  clipId: string,
): Promise<UploadVideoResult> {
  const [posterBlob, finalFrameBlob, durationSeconds] = await Promise.all([
    extractVideoPosterFrame(file),
    extractVideoFinalFrame(file),
    getVideoDurationFromFile(file),
  ]);

  const [videoUrl, posterUrl, finalFrameUrl] = await Promise.all([
    uploadVideoToStorage(file, projectId, clipId, {
      maxRetries: 3,
      timeoutMs: 300000,
    }),
    uploadBlobToStorage(posterBlob, 'poster.jpg', 'image/jpeg', {
      maxRetries: 2,
      timeoutMs: 30000,
    }),
    uploadBlobToStorage(finalFrameBlob, 'final-frame.jpg', 'image/jpeg', {
      maxRetries: 2,
      timeoutMs: 30000,
    }),
  ]);

  return { videoUrl, posterUrl, finalFrameUrl, durationSeconds };
}

// ---------------------------------------------------------------------------
// Drag-end reorder
// ---------------------------------------------------------------------------

interface ReorderResult {
  clips: VideoClip[];
  transitionPrompts: TransitionPrompt[];
}

export function reorderClipsAndPrompts(
  clips: VideoClip[],
  transitionPrompts: TransitionPrompt[],
  activeId: string | number,
  overId: string | number,
): ReorderResult {
  const oldIndex = clips.findIndex(clip => clip.id === activeId);
  const newIndex = clips.findIndex(clip => clip.id === overId);

  if (oldIndex === -1 || newIndex === -1) {
    return { clips, transitionPrompts };
  }

  const newClips = arrayMove(clips, oldIndex, newIndex);

  const newPrompts = transitionPrompts.map(prompt => {
    const oldClipIndex = clips.findIndex(c => c.id === prompt.id);
    if (oldClipIndex !== -1 && oldClipIndex > 0) {
      const newClipIndex = newClips.findIndex(c => c.id === clips[oldClipIndex].id);
      if (newClipIndex > 0) {
        return { ...prompt, id: newClips[newClipIndex].id };
      }
    }
    return prompt;
  });

  return { clips: newClips, transitionPrompts: newPrompts };
}

// ---------------------------------------------------------------------------
// Clip state update helpers
// ---------------------------------------------------------------------------

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
