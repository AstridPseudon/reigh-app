import type { VideoMetadata } from '@/shared/lib/media/videoUploader';
import type { StructureVideoConfigWithMetadata } from '@/shared/lib/tasks/travelBetweenImages';

export type StructureVideoType = 'uni3c' | 'flow' | 'canny' | 'depth';

export type OnPrimaryStructureVideoInputChange = (
  videoPath: string | null,
  metadata: VideoMetadata | null,
  treatment: 'adjust' | 'clip',
  motionStrength: number,
  structureType: StructureVideoType,
  resourceId?: string,
) => void;

export interface StructureVideoCollectionHandlers {
  structureVideos?: StructureVideoConfigWithMetadata[];
  isStructureVideoLoading?: boolean;
  cachedHasStructureVideo?: boolean;
  onAddStructureVideo?: (video: StructureVideoConfigWithMetadata) => void;
  onUpdateStructureVideo?: (index: number, updates: Partial<StructureVideoConfigWithMetadata>) => void;
  onRemoveStructureVideo?: (index: number) => void;
  onSetStructureVideos?: (videos: StructureVideoConfigWithMetadata[]) => void;
}

export type OnAudioChange = (
  audioUrl: string | null,
  metadata: { duration: number; name?: string } | null,
) => void;
