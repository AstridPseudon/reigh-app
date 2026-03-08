import { useSegmentScrubbingCore } from '@/shared/hooks/useSegmentScrubbingCore';
import type { SegmentSlot } from '@/shared/hooks/segments';

interface UseDesktopSegmentScrubbingParams {
  isMobile: boolean;
  segmentSlots?: SegmentSlot[];
  projectAspectRatio?: string;
}

export function useDesktopSegmentScrubbing({
  isMobile,
  segmentSlots,
  projectAspectRatio,
}: UseDesktopSegmentScrubbingParams) {
  const { previewPosition, ...core } = useSegmentScrubbingCore({
    isMobile,
    slots: segmentSlots ?? [],
    projectAspectRatio,
  });

  return {
    ...core,
    previewY: previewPosition.y,
  };
}
