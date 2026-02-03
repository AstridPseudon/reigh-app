import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/shared/hooks/use-toast';
import { uploadVideoToStorage } from '@/shared/lib/videoUploader';
import { uploadBlobToStorage } from '@/shared/lib/imageUploader';
import { extractVideoPosterFrame, extractVideoFinalFrame } from '@/shared/utils/videoPosterExtractor';
import { extractVideoMetadataFromUrl } from '@/shared/lib/videoUploader';
import { handleError } from '@/shared/lib/errorHandler';
import { generateUUID } from '@/shared/lib/taskCreation';
import {
  DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { VideoClip, TransitionPrompt } from '../types';
import type { useJoinClipsSettings } from './useJoinClipsSettings';
import type { useCreateGeneration } from '@/shared/hooks/useGenerationMutations';

interface UseClipManagerParams {
  selectedProjectId: string | null;
  joinSettings: ReturnType<typeof useJoinClipsSettings>;
  settingsLoaded: boolean;
  loopFirstClip: boolean;
  createGenerationMutation: ReturnType<typeof useCreateGeneration>;
}

export function useClipManager({
  selectedProjectId,
  joinSettings,
  settingsLoaded,
  loopFirstClip,
  createGenerationMutation,
}: UseClipManagerParams) {
  const { toast } = useToast();

  // Local state for clips list
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [uploadingClipId, setUploadingClipId] = useState<string | null>(null);
  const [lightboxClip, setLightboxClip] = useState<VideoClip | null>(null);

  // Track if we've already loaded from settings to prevent re-loading
  const hasLoadedFromSettings = useRef(false);
  // Track the project we loaded settings for
  const loadedForProjectRef = useRef<string | null>(null);
  // Track if we're still preloading persisted media
  const [isLoadingPersistedMedia, setIsLoadingPersistedMedia] = useState(false);
  // Track preloaded poster URLs to avoid flash on navigation
  const preloadedPostersRef = useRef<Set<string>>(new Set());

  // Get cached clips count from localStorage for instant skeleton sizing
  const getLocalStorageKey = (projectId: string) => `join-clips-count-${projectId}`;
  const getCachedClipsCount = (projectId: string | null): number => {
    if (!projectId) return 0;
    try {
      const cached = localStorage.getItem(getLocalStorageKey(projectId));
      return cached ? parseInt(cached, 10) : 0;
    } catch {
      return 0;
    }
  };
  const setCachedClipsCount = (projectId: string | null, count: number) => {
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
  };

  // Initial cached count for skeleton sizing (read once on mount/project change)
  const [cachedClipsCount, setCachedClipsCountState] = useState(() => getCachedClipsCount(selectedProjectId));

  // Transition prompts (one for each pair) - tied to clip IDs
  const [transitionPrompts, setTransitionPrompts] = useState<TransitionPrompt[]>([]);

  // Track drag state per clip
  const [draggingOverClipId, setDraggingOverClipId] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  // Refs for file inputs and video elements
  const fileInputRefs = useRef<{ [clipId: string]: HTMLInputElement | null }>({});
  const videoRefs = useRef<{ [clipId: string]: HTMLVideoElement | null }>({});

  // Reset loading state when project changes
  useEffect(() => {
    if (selectedProjectId && selectedProjectId !== loadedForProjectRef.current) {
      hasLoadedFromSettings.current = false;
      loadedForProjectRef.current = selectedProjectId;
      setClips([]);
      setTransitionPrompts([]);
      preloadedPostersRef.current.clear();
      setCachedClipsCountState(getCachedClipsCount(selectedProjectId));
    }
  }, [selectedProjectId]);

  // Preload poster images helper - warm up the browser cache
  const preloadPosters = useCallback((posterUrls: string[]): Promise<void[]> => {
    const promises = posterUrls.filter(url => url && !preloadedPostersRef.current.has(url)).map(url => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          preloadedPostersRef.current.add(url);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      });
    });
    return Promise.all(promises);
  }, []);

  // Check for pending join clips from lightbox "Add to Join" button
  useEffect(() => {
    if (!settingsLoaded) return;

    const checkPendingJoinClips = async () => {
      try {
        const pendingData = localStorage.getItem('pendingJoinClips');
        if (!pendingData) return;

        const pendingClips: Array<{ videoUrl: string; thumbnailUrl?: string; generationId: string; timestamp: number }> =
          JSON.parse(pendingData);

        const now = Date.now();
        const recentClips = pendingClips.filter(clip => {
          const age = now - clip.timestamp;
          return age < 5 * 60 * 1000;
        });

        if (recentClips.length === 0) {
          localStorage.removeItem('pendingJoinClips');
          return;
        }

        for (const { videoUrl, thumbnailUrl, generationId } of recentClips) {
          if (!videoUrl) continue;

          const videoElement = document.createElement('video');
          videoElement.preload = 'metadata';
          const durationPromise = new Promise<number>((resolve) => {
            videoElement.onloadedmetadata = () => resolve(videoElement.duration);
            videoElement.onerror = () => resolve(0);
            videoElement.src = videoUrl;
          });
          const durationSeconds = await durationPromise;

          const newClipId = generateUUID();

          setClips(prev => {
            const emptyClipIndex = prev.findIndex(clip => !clip.url);

            if (emptyClipIndex !== -1) {
              return prev.map((clip, idx) =>
                idx === emptyClipIndex
                  ? {
                      ...clip,
                      url: videoUrl,
                      posterUrl: thumbnailUrl,
                      durationSeconds,
                      loaded: false,
                      playing: false,
                      generationId,
                    }
                  : clip
              );
            } else {
              return [
                ...prev,
                {
                  id: newClipId,
                  url: videoUrl,
                  posterUrl: thumbnailUrl,
                  durationSeconds,
                  loaded: false,
                  playing: false,
                  generationId,
                },
              ];
            }
          });
        }

        localStorage.removeItem('pendingJoinClips');
      } catch (error) {
        handleError(error, { context: 'JoinClipsPage', showToast: false });
      }
    };

    checkPendingJoinClips();
  }, [settingsLoaded]);

  // Initialize clips from settings or create 2 empty slots
  useEffect(() => {
    if (!selectedProjectId || !settingsLoaded || hasLoadedFromSettings.current) return;

    hasLoadedFromSettings.current = true;

    const initialClips: VideoClip[] = [];
    const posterUrlsToPreload: string[] = [];

    // First, try loading from new multi-clip format
    if (joinSettings.settings?.clips && joinSettings.settings.clips.length > 0) {
      joinSettings.settings.clips.forEach((clip) => {
        if (clip.url) {
          initialClips.push({
            id: generateUUID(),
            url: clip.url,
            posterUrl: clip.posterUrl,
            finalFrameUrl: clip.finalFrameUrl,
            durationSeconds: clip.durationSeconds,
            loaded: false,
            playing: false
          });
          if (clip.posterUrl) posterUrlsToPreload.push(clip.posterUrl);
        }
      });

      // Load transition prompts
      if (joinSettings.settings.transitionPrompts && joinSettings.settings.transitionPrompts.length > 0) {
        const prompts = joinSettings.settings.transitionPrompts.map((tp) => ({
          id: initialClips[tp.clipIndex]?.id || '',
          prompt: tp.prompt
        })).filter(p => p.id);
        setTransitionPrompts(prompts);
      }
    }
    // Fallback to legacy two-video format
    else if (joinSettings.settings?.startingVideoUrl || joinSettings.settings?.endingVideoUrl) {
      if (joinSettings.settings.startingVideoUrl) {
        initialClips.push({
          id: generateUUID(),
          url: joinSettings.settings.startingVideoUrl,
          posterUrl: joinSettings.settings.startingVideoPosterUrl,
          loaded: false,
          playing: false
        });
        if (joinSettings.settings.startingVideoPosterUrl) {
          posterUrlsToPreload.push(joinSettings.settings.startingVideoPosterUrl);
        }
      }

      if (joinSettings.settings.endingVideoUrl) {
        initialClips.push({
          id: generateUUID(),
          url: joinSettings.settings.endingVideoUrl,
          posterUrl: joinSettings.settings.endingVideoPosterUrl,
          loaded: false,
          playing: false
        });
        if (joinSettings.settings.endingVideoPosterUrl) {
          posterUrlsToPreload.push(joinSettings.settings.endingVideoPosterUrl);
        }
      }

      // Initialize transition prompts from legacy format
      if (initialClips.length >= 2 && joinSettings.settings.prompt) {
        setTransitionPrompts([{
          id: initialClips[1].id,
          prompt: joinSettings.settings.prompt
        }]);
      }
    }

    // If we have saved clips, preload posters then show them
    if (initialClips.length > 0) {
      if (posterUrlsToPreload.length > 0) {
        setIsLoadingPersistedMedia(true);
      }

      let clipsToSet: VideoClip[];
      if (initialClips.length < 2) {
        const clipsToAdd = 2 - initialClips.length;
        const emptyClips = Array.from({ length: clipsToAdd }, () => ({
          id: generateUUID(),
          url: '',
          loaded: false,
          playing: false
        }));
        clipsToSet = [...initialClips, ...emptyClips];
      } else {
        clipsToSet = [...initialClips, {
          id: generateUUID(),
          url: '',
          loaded: false,
          playing: false
        }];
      }

      if (posterUrlsToPreload.length > 0) {
        preloadPosters(posterUrlsToPreload).then(() => {
          setClips(clipsToSet);
          setIsLoadingPersistedMedia(false);
        });
      } else {
        setClips(clipsToSet);
      }
    } else {
      const emptyClip1 = { id: generateUUID(), url: '', loaded: false, playing: false };
      const emptyClip2 = { id: generateUUID(), url: '', loaded: false, playing: false };
      setClips([emptyClip1, emptyClip2]);
    }
  }, [selectedProjectId, joinSettings.settings, settingsLoaded, preloadPosters]);

  // Persist clips to settings whenever they change
  useEffect(() => {
    if (!settingsLoaded) return;

    const clipsToSave = clips
      .filter(clip => clip.url)
      .map(clip => ({
        url: clip.url,
        posterUrl: clip.posterUrl,
        finalFrameUrl: clip.finalFrameUrl,
        durationSeconds: clip.durationSeconds
      }));

    setCachedClipsCount(selectedProjectId, clipsToSave.length);

    const promptsToSave = transitionPrompts
      .map(tp => {
        const clipIndex = clips.findIndex(c => c.id === tp.id);
        if (clipIndex > 0 && tp.prompt) {
          return { clipIndex, prompt: tp.prompt };
        }
        return null;
      })
      .filter((p): p is { clipIndex: number; prompt: string } => p !== null);

    const currentClipsJson = JSON.stringify(joinSettings.settings.clips || []);
    const newClipsJson = JSON.stringify(clipsToSave);
    const currentPromptsJson = JSON.stringify(joinSettings.settings.transitionPrompts || []);
    const newPromptsJson = JSON.stringify(promptsToSave);

    if (currentClipsJson !== newClipsJson || currentPromptsJson !== newPromptsJson) {
      joinSettings.updateFields({
        clips: clipsToSave,
        transitionPrompts: promptsToSave
      });
    }
  }, [clips, transitionPrompts, settingsLoaded, joinSettings]);

  // Lazy-load duration for clips that have URLs but no duration
  useEffect(() => {
    const clipsNeedingDuration = clips.filter(
      clip => clip.url && clip.durationSeconds === undefined && !clip.metadataLoading
    );

    if (clipsNeedingDuration.length === 0) return;

    setClips(prev => prev.map(clip =>
      clipsNeedingDuration.some(c => c.id === clip.id)
        ? { ...clip, metadataLoading: true }
        : clip
    ));

    clipsNeedingDuration.forEach(async (clip) => {
      try {
        const metadata = await extractVideoMetadataFromUrl(clip.url);
        setClips(prev => prev.map(c =>
          c.id === clip.id
            ? { ...c, durationSeconds: metadata.duration_seconds, metadataLoading: false }
            : c
        ));
      } catch (error) {
        handleError(error, { context: 'JoinClipsPage', showToast: false, logData: { clipId: clip.id } });
        setClips(prev => prev.map(c =>
          c.id === clip.id
            ? { ...c, durationSeconds: 0, metadataLoading: false }
            : c
        ));
      }
    });
  }, [clips]);

  // Ensure minimum of 2 clips, auto-add empty slot when all filled, remove extra trailing empties
  useEffect(() => {
    if (clips.length === 0) return;

    if (clips.length < 2) {
      const clipsToAdd = 2 - clips.length;
      const newClips = Array.from({ length: clipsToAdd }, () => ({
        id: generateUUID(),
        url: '',
        loaded: false,
        playing: false
      }));
      setClips(prev => [...prev, ...newClips]);
      return;
    }

    let lastNonEmptyIndex = -1;
    for (let i = clips.length - 1; i >= 0; i--) {
      if (clips[i].url) {
        lastNonEmptyIndex = i;
        break;
      }
    }

    const trailingEmptyCount = clips.length - lastNonEmptyIndex - 1;

    if (clips.every(clip => clip.url)) {
      const newClipId = generateUUID();
      setClips(prev => [...prev, {
        id: newClipId,
        url: '',
        loaded: false,
        playing: false
      }]);
      return;
    }

    if (trailingEmptyCount > 1) {
      const targetLength = Math.max(2, lastNonEmptyIndex + 2);

      if (clips.length !== targetLength) {
        const newClips = clips.slice(0, targetLength);
        setClips(newClips);

        const removedClipIds = clips.slice(targetLength).map(c => c.id);
        if (removedClipIds.length > 0) {
          setTransitionPrompts(prev => prev.filter(p => !removedClipIds.includes(p.id)));
        }
      }
    }
  }, [clips]);

  // Prevent autoplay on mobile
  useEffect(() => {
    clips.forEach(clip => {
      const video = videoRefs.current[clip.id];
      if (video) {
        const preventPlay = () => video.pause();
        video.addEventListener('play', preventPlay);
        video.pause();
        return () => video.removeEventListener('play', preventPlay);
      }
    });
  }, [clips]);

  // Track scroll state
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolling(true);
      const timer = setTimeout(() => setIsScrolling(false), 200);
      return () => clearTimeout(timer);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Helper to upload video
  const uploadVideoFile = async (
    file: File,
    clipId: string
  ): Promise<{ videoUrl: string; posterUrl: string; finalFrameUrl: string; durationSeconds: number } | null> => {
    if (!file.type.startsWith('video/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a video file',
        variant: 'destructive',
      });
      return null;
    }

    setUploadingClipId(clipId);
    try {
      const videoElement = document.createElement('video');
      videoElement.preload = 'metadata';
      const durationPromise = new Promise<number>((resolve) => {
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

      const [posterBlob, finalFrameBlob, durationSeconds] = await Promise.all([
        extractVideoPosterFrame(file),
        extractVideoFinalFrame(file),
        durationPromise
      ]);

      const [videoUrl, posterUrl, finalFrameUrl] = await Promise.all([
        uploadVideoToStorage(file, selectedProjectId || '', clipId, {
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
        })
      ]);

      // Create a generation record so the video appears in the gallery
      if (selectedProjectId) {
        try {
          await createGenerationMutation.mutateAsync({
            imageUrl: videoUrl,
            fileName: file.name,
            fileType: 'video',
            fileSize: file.size,
            projectId: selectedProjectId,
            prompt: 'Uploaded clip for Join',
            thumbnailUrl: posterUrl,
          });
        } catch (genError) {
          handleError(genError, { context: 'JoinClipsPage', showToast: false });
        }
      }

      return { videoUrl, posterUrl, finalFrameUrl, durationSeconds };
    } catch (error) {
      handleError(error, { context: 'JoinClipsPage', toastTitle: 'Upload failed' });
      return null;
    } finally {
      setUploadingClipId(null);
    }
  };

  // Remove clip (but ensure minimum of 2 clips)
  const handleRemoveClip = useCallback((clipId: string) => {
    setClips(prev => {
      if (prev.length <= 2) return prev;
      return prev.filter(c => c.id !== clipId);
    });
    setTransitionPrompts(prev => prev.filter(p => p.id !== clipId));
  }, []);

  // Clear video content from a clip (keeps the slot)
  const handleClearVideo = useCallback((clipId: string) => {
    const clipIndex = clips.findIndex(c => c.id === clipId);
    if (clipIndex === 0 && loopFirstClip) {
      joinSettings.updateField('loopFirstClip', false);
    }

    setClips(prev => prev.map(clip =>
      clip.id === clipId
        ? { ...clip, url: '', posterUrl: undefined, finalFrameUrl: undefined, file: undefined, loaded: false, playing: false }
        : clip
    ));
    const fileInput = fileInputRefs.current[clipId];
    if (fileInput) fileInput.value = '';
    const videoElement = videoRefs.current[clipId];
    if (videoElement) {
      videoElement.pause();
      videoElement.src = '';
      videoElement.load();
    }
    setTransitionPrompts(prev => prev.filter(p => p.id !== clipId));
  }, [clips, loopFirstClip, joinSettings]);

  // Handle video upload for a specific clip
  const handleVideoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, clipId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await uploadVideoFile(file, clipId);
    if (!result) return;

    setClips(prev => prev.map(clip =>
      clip.id === clipId
        ? {
            ...clip,
            url: result.videoUrl,
            posterUrl: result.posterUrl,
            finalFrameUrl: result.finalFrameUrl,
            durationSeconds: result.durationSeconds,
            file,
            loaded: false,
            playing: false
          }
        : clip
    ));
  }, [selectedProjectId, createGenerationMutation]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent, _clipId: string) => {
    if (isScrolling) return;
    e.preventDefault();
    e.stopPropagation();
  }, [isScrolling]);

  const handleDragEnter = useCallback((e: React.DragEvent, clipId: string) => {
    if (isScrolling) return;
    e.preventDefault();
    e.stopPropagation();

    const items = Array.from(e.dataTransfer.items);
    const hasValidVideo = items.some(item =>
      item.kind === 'file' && item.type.startsWith('video/')
    );

    if (hasValidVideo) {
      setDraggingOverClipId(clipId);
    }
  }, [isScrolling]);

  const handleDragLeave = useCallback((e: React.DragEvent, _clipId: string) => {
    if (isScrolling) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setDraggingOverClipId(null);
    }
  }, [isScrolling]);

  const handleDrop = useCallback(async (e: React.DragEvent, clipId: string) => {
    if (isScrolling) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingOverClipId(null);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const result = await uploadVideoFile(file, clipId);
    if (!result) return;

    setClips(prev => prev.map(clip =>
      clip.id === clipId
        ? {
            ...clip,
            url: result.videoUrl,
            posterUrl: result.posterUrl,
            finalFrameUrl: result.finalFrameUrl,
            durationSeconds: result.durationSeconds,
            file,
            loaded: false,
            playing: false
          }
        : clip
    ));
  }, [isScrolling, selectedProjectId, createGenerationMutation]);

  // Update transition prompt
  const handlePromptChange = useCallback((clipId: string, prompt: string) => {
    setTransitionPrompts(prev => {
      const existing = prev.find(p => p.id === clipId);
      if (existing) {
        return prev.map(p => p.id === clipId ? { ...p, prompt } : p);
      } else {
        return [...prev, { id: clipId, prompt }];
      }
    });
  }, []);

  // Set up drag and drop sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end to reorder clips
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setClips((prevClips) => {
      const oldIndex = prevClips.findIndex((clip) => clip.id === active.id);
      const newIndex = prevClips.findIndex((clip) => clip.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return prevClips;

      return arrayMove(prevClips, oldIndex, newIndex);
    });

    // Update transition prompts to match new order
    setTransitionPrompts((prevPrompts) => {
      const newClipsOrder = arrayMove(
        clips,
        clips.findIndex((clip) => clip.id === active.id),
        clips.findIndex((clip) => clip.id === over.id)
      );

      return prevPrompts.map(prompt => {
        const oldClipIndex = clips.findIndex(c => c.id === prompt.id);
        if (oldClipIndex !== -1 && oldClipIndex > 0) {
          const newClipIndex = newClipsOrder.findIndex(c => c.id === clips[oldClipIndex].id);
          if (newClipIndex > 0) {
            return { ...prompt, id: newClipsOrder[newClipIndex].id };
          }
        }
        return prompt;
      });
    });
  }, [clips]);

  return {
    clips,
    setClips,
    transitionPrompts,
    uploadingClipId,
    draggingOverClipId,
    isScrolling,
    lightboxClip,
    setLightboxClip,
    isLoadingPersistedMedia,
    cachedClipsCount,
    videoRefs,
    fileInputRefs,
    handleRemoveClip,
    handleClearVideo,
    handleVideoUpload,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handlePromptChange,
    sensors,
    handleDragEnd,
  };
}
