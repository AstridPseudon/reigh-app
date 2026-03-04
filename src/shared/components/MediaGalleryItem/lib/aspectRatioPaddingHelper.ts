import type { GeneratedImageWithMetadata } from '@/shared/components/MediaGallery/types';
import { parseRatio } from '@/shared/lib/media/aspectRatios';

const MIN_PADDING = 60;
const MAX_PADDING = 200;

function clampPadding(value: number): number {
  return Math.min(Math.max(value, MIN_PADDING), MAX_PADDING);
}

function extractResolutionFromMetadata(image: GeneratedImageWithMetadata): { width?: number; height?: number } {
  let width = image.metadata?.width;
  let height = image.metadata?.height;

  if (width && height) {
    return { width, height };
  }

  const resolution = image.metadata?.originalParams?.orchestrator_details?.resolution;
  if (resolution && typeof resolution === 'string' && resolution.includes('x')) {
    const [parsedWidth, parsedHeight] = resolution.split('x').map(Number);
    if (!isNaN(parsedWidth) && !isNaN(parsedHeight)) {
      width = parsedWidth;
      height = parsedHeight;
    }
  }

  return { width, height };
}

export function resolveAspectRatioPadding(
  image: GeneratedImageWithMetadata,
  projectAspectRatio?: string,
): string {
  if (projectAspectRatio) {
    const ratio = parseRatio(projectAspectRatio);
    if (!isNaN(ratio)) {
      const calculatedPadding = (1 / ratio) * 100;
      return `${clampPadding(calculatedPadding)}%`;
    }
  }

  const { width, height } = extractResolutionFromMetadata(image);
  if (width && height) {
    return `${clampPadding((height / width) * 100)}%`;
  }

  return '100%';
}
