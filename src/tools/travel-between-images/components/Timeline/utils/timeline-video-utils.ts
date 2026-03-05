/**
 * Calculate placement for a new structure video on the timeline.
 * Places after the last existing video, clipping the last video if needed to make space.
 *
 * @returns Object with start_frame, end_frame, and optional lastVideoUpdate if clipping is needed
 */
interface VideoPlacementResult {
  start_frame: number;
  end_frame: number;
  lastVideoUpdate?: { index: number; newEndFrame: number };
}

export const calculateNewVideoPlacement = (
  videoFrameCount: number,
  existingVideos: Array<{ path: string; start_frame: number; end_frame: number }> | undefined,
  fullMax: number
): VideoPlacementResult => {
  let start_frame = 0;
  let end_frame = videoFrameCount;
  let lastVideoUpdate: { index: number; newEndFrame: number } | undefined;

  if (existingVideos && existingVideos.length > 0) {
    const sorted = [...existingVideos].sort((a, b) => a.start_frame - b.start_frame);
    const lastVideo = sorted[sorted.length - 1];
    const lastVideoIndex = existingVideos.findIndex(
      v => v.path === lastVideo.path && v.start_frame === lastVideo.start_frame
    );

    start_frame = lastVideo.end_frame;
    end_frame = start_frame + videoFrameCount;

    // If no space on timeline, clip 1/5 of the last video's range
    if (start_frame >= fullMax && lastVideoIndex >= 0) {
      const lastVideoRange = lastVideo.end_frame - lastVideo.start_frame;
      const clipAmount = Math.max(10, Math.floor(lastVideoRange / 5));
      const newLastVideoEnd = lastVideo.end_frame - clipAmount;

      if (newLastVideoEnd > lastVideo.start_frame + 10) {
        lastVideoUpdate = { index: lastVideoIndex, newEndFrame: newLastVideoEnd };
        start_frame = newLastVideoEnd;
        end_frame = start_frame + videoFrameCount;
      }
    }
  }

  return { start_frame, end_frame, lastVideoUpdate };
};

/**
 * Extract pair_shot_generation_id from a generation row.
 * Checks the FK column first, then falls back to params for legacy data.
 */
const getPairShotGenerationId = (
  generation: {
    pair_shot_generation_id?: string | null;
    params?: Record<string, unknown> | null;
  }
): string | null => {
  // Check FK column first (new format)
  if (generation.pair_shot_generation_id) {
    return generation.pair_shot_generation_id;
  }

  // Fallback to params (legacy format)
  const params = generation.params;
  if (!params) return null;

  const individualParams = params.individual_segment_params as Record<string, unknown> | undefined;
  return (
    (individualParams?.pair_shot_generation_id as string) ||
    (params.pair_shot_generation_id as string) ||
    null
  );
};

/**
 * Find trailing video info from a list of video outputs.
 * A trailing video is one where pair_shot_generation_id matches the last image's shot_generation_id.
 *
 * @param videoOutputs - Array of generation rows (video outputs)
 * @param lastImageShotGenId - The shot_generation_id of the last image on the timeline
 * @returns Object with hasTrailing boolean and optional videoUrl
 */
export const findTrailingVideoInfo = (
  videoOutputs: Array<{
    type?: string | null;
    location?: string | null;
    pair_shot_generation_id?: string | null;
    params?: Record<string, unknown> | null;
  }>,
  lastImageShotGenId: string | null
): { hasTrailing: boolean; videoUrl: string | null } => {
  if (!videoOutputs || videoOutputs.length === 0 || !lastImageShotGenId) {
    return { hasTrailing: false, videoUrl: null };
  }

  const trailingVideo = videoOutputs.find(gen => {
    // Must be a video with a location (completed)
    if (!gen.type?.includes('video') || !gen.location) return false;
    // Check if pair_shot_generation_id matches the last image
    const pairId = getPairShotGenerationId(gen);
    return pairId === lastImageShotGenId;
  });

  return {
    hasTrailing: !!trailingVideo,
    videoUrl: trailingVideo?.location || null,
  };
};
