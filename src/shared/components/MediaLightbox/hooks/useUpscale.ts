import { useState, useCallback } from 'react';
import { handleError } from '@/shared/lib/errorHandler';
import { GenerationRow } from '@/types/shots';
import { createImageUpscaleTask } from '@/shared/lib/tasks/imageUpscale';
import { getGenerationId, getMediaUrl } from '@/shared/lib/mediaTypeHelpers';
import type { ImageUpscaleSettings } from '../components/ImageUpscaleForm';

export interface UseUpscaleProps {
  media: GenerationRow | undefined;
  selectedProjectId: string | null;
  isVideo: boolean;
  shotId?: string;
}

export interface UseUpscaleReturn {
  isUpscaling: boolean;
  upscaleSuccess: boolean;
  handleUpscale: (settings: ImageUpscaleSettings) => Promise<void>;
  // Kept for backwards compatibility with other components
  showingUpscaled: boolean;
  handleToggleUpscaled: () => void;
  effectiveImageUrl: string;
  sourceUrlForTasks: string;
  isPendingUpscale: boolean;
  hasUpscaledVersion: boolean;
  upscaledUrl: string | null;
}

/**
 * Hook for managing image upscaling functionality
 *
 * Simple pattern matching other edit tasks (inpaint, etc.):
 * 1. Click button → isUpscaling = true
 * 2. Task created → upscaleSuccess = true briefly
 * 3. Reset after timeout
 */
export const useUpscale = ({
  media,
  selectedProjectId,
  isVideo,
  shotId,
}: UseUpscaleProps): UseUpscaleReturn => {
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleSuccess, setUpscaleSuccess] = useState(false);

  // Get media URL
  const mediaUrl = media ? (getMediaUrl(media) || media.imageUrl || '') : '';

  const handleUpscale = useCallback(async (settings: ImageUpscaleSettings) => {
    if (!media || !selectedProjectId || isVideo) {
      return;
    }

    setIsUpscaling(true);
    try {
      if (!mediaUrl) {
        throw new Error('No image URL available');
      }

      const actualGenerationId = getGenerationId(media);

      // Debug: Log the media object to understand which ID we're getting
      console.log('[ImageUpscale] Media object debug:', {
        'media.id (shot_generations.id)': media.id?.substring(0, 8),
        'media.generation_id (generations.id)': media.generation_id?.substring(0, 8),
        'actualGenerationId (used for based_on)': actualGenerationId?.substring(0, 8),
        'hasGenerationId': !!media.generation_id,
      });

      console.log('[ImageUpscale] Creating task:', {
        actualGenerationId,
        mediaUrl: mediaUrl.substring(0, 50),
        settings,
      });

      await createImageUpscaleTask({
        project_id: selectedProjectId,
        image_url: mediaUrl,
        generation_id: actualGenerationId,
        shot_id: shotId,
        scale_factor: settings.scaleFactor,
        noise_scale: settings.noiseScale,
      });

      console.log('[ImageUpscale] Task created successfully');

      // Show success state briefly
      setUpscaleSuccess(true);
      setTimeout(() => {
        setUpscaleSuccess(false);
      }, 2000);

    } catch (error) {
      handleError(error, { context: 'useUpscale', toastTitle: 'Failed to create enhance task' });
    } finally {
      setIsUpscaling(false);
    }
  }, [media, selectedProjectId, isVideo, mediaUrl, shotId]);

  return {
    isUpscaling,
    upscaleSuccess,
    handleUpscale,
    // Backwards compatibility - these features removed but APIs kept
    showingUpscaled: false,
    handleToggleUpscaled: () => {},
    effectiveImageUrl: mediaUrl,
    sourceUrlForTasks: mediaUrl,
    isPendingUpscale: false,
    hasUpscaledVersion: false,
    upscaledUrl: null,
  };
};
