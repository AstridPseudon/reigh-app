import { extractVideoMetadataFromUrl } from '@/shared/lib/media/videoMetadata';
import type { AssetRegistryEntry } from '@/tools/video-editor/types';

export interface FinalVideoAssetSource {
  id: string;
  location: string;
  thumbnailUrl: string | null;
  durationSeconds?: number | null;
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function getKnownFinalVideoDurationSeconds(
  finalVideo: Pick<FinalVideoAssetSource, 'id' | 'location' | 'durationSeconds'>,
  assets?: Record<string, AssetRegistryEntry>,
): number | null {
  const explicitDuration = readPositiveNumber(finalVideo.durationSeconds);
  if (explicitDuration !== null) {
    return explicitDuration;
  }

  if (!assets) {
    return null;
  }

  for (const assetEntry of Object.values(assets)) {
    if (assetEntry.generationId !== finalVideo.id && assetEntry.file !== finalVideo.location) {
      continue;
    }

    const assetDuration = readPositiveNumber(assetEntry.duration);
    if (assetDuration !== null) {
      return assetDuration;
    }
  }

  return null;
}

export async function resolveFinalVideoDurationSeconds(
  finalVideo: Pick<FinalVideoAssetSource, 'id' | 'location' | 'durationSeconds'>,
  assets?: Record<string, AssetRegistryEntry>,
): Promise<number | null> {
  const knownDuration = getKnownFinalVideoDurationSeconds(finalVideo, assets);
  if (knownDuration !== null) {
    return knownDuration;
  }

  try {
    const metadata = await extractVideoMetadataFromUrl(finalVideo.location);
    return readPositiveNumber(metadata.duration_seconds);
  } catch {
    return null;
  }
}

export function buildFinalVideoAssetEntry(
  finalVideo: Pick<FinalVideoAssetSource, 'id' | 'location' | 'thumbnailUrl'>,
  durationSeconds?: number | null,
): AssetRegistryEntry {
  const positiveDuration = readPositiveNumber(durationSeconds);

  return {
    file: finalVideo.location,
    type: 'video/mp4',
    ...(positiveDuration !== null ? { duration: positiveDuration } : {}),
    generationId: finalVideo.id,
    ...(finalVideo.thumbnailUrl ? { thumbnailUrl: finalVideo.thumbnailUrl } : {}),
  };
}
