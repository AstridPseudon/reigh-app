import { extractVideoMetadataFromUrl } from '@/shared/lib/videoUploader';
import { handleError } from '@/shared/lib/errorHandling/handleError';
import type { VideoClip } from '../../types';

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
