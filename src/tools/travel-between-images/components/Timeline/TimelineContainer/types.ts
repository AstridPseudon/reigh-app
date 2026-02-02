import type { GenerationRow } from '@/types/shots';
import type { VideoMetadata } from '@/shared/lib/videoUploader';
import type { StructureVideoConfigWithMetadata } from '@/shared/lib/tasks/travelBetweenImages';

/** Shared pair data structure for SegmentSettingsModal and MediaLightbox */
export interface PairData {
  index: number;
  frames: number;
  startFrame: number;
  endFrame: number;
  startImage: {
    id: string;           // shot_generation.id (used as startShotGenerationId)
    generationId?: string; // generation_id (used as startGenerationId)
    url?: string;
    thumbUrl?: string;
    position: number;
  } | null;
  endImage: {
    id: string;           // shot_generation.id
    generationId?: string; // generation_id (used as endGenerationId)
    url?: string;
    thumbUrl?: string;
    position: number;
  } | null;
}

export interface TimelineContainerProps {
  shotId: string;
  projectId?: string;
  images: GenerationRow[];
  framePositions: Map<string, number>;
  setFramePositions: (positions: Map<string, number>) => Promise<void>;
  onImageReorder: (orderedIds: string[], draggedItemId?: string) => void;
  onImageDrop?: (files: File[], targetFrame?: number) => Promise<void>;
  onGenerationDrop?: (generationId: string, imageUrl: string, thumbUrl: string | undefined, targetFrame?: number) => Promise<void>;
  setIsDragInProgress: (dragging: boolean) => void;
  // Control props
  onResetFrames: (gap: number) => Promise<void>;
  // Pair-specific props
  onPairClick?: (pairIndex: number, pairData: PairData) => void;
  pairPrompts?: Record<number, { prompt: string; negativePrompt: string }>;
  enhancedPrompts?: Record<number, string>;
  defaultPrompt?: string;
  defaultNegativePrompt?: string;
  onClearEnhancedPrompt?: (pairIndex: number) => void;
  // Action handlers
  onImageDelete: (imageId: string) => void;
  onImageDuplicate: (imageId: string, timeline_frame: number) => void;
  duplicatingImageId?: string | null;
  duplicateSuccessImageId?: string | null;
  projectAspectRatio?: string;
  // Lightbox handlers
  handleDesktopDoubleClick: (idx: number) => void;
  handleMobileTap: (idx: number) => void;
  handleInpaintClick?: (idx: number) => void;
  // Structure video props (legacy single-video interface)
  structureVideoPath?: string | null;
  structureVideoMetadata?: VideoMetadata | null;
  structureVideoTreatment?: 'adjust' | 'clip';
  structureVideoMotionStrength?: number;
  structureVideoType?: 'uni3c' | 'flow' | 'canny' | 'depth';
  onStructureVideoChange?: (
    videoPath: string | null,
    metadata: VideoMetadata | null,
    treatment: 'adjust' | 'clip',
    motionStrength: number,
    structureType: 'uni3c' | 'flow' | 'canny' | 'depth',
    resourceId?: string
  ) => void;
  /** Uni3C end percent (only used when structureVideoType is 'uni3c') */
  uni3cEndPercent?: number;
  onUni3cEndPercentChange?: (value: number) => void;

  // Multi-video array interface
  structureVideos?: StructureVideoConfigWithMetadata[];
  onAddStructureVideo?: (video: StructureVideoConfigWithMetadata) => void;
  onUpdateStructureVideo?: (index: number, updates: Partial<StructureVideoConfigWithMetadata>) => void;
  onRemoveStructureVideo?: (index: number) => void;
  // Audio strip props
  audioUrl?: string | null;
  audioMetadata?: { duration: number; name?: string } | null;
  onAudioChange?: (
    audioUrl: string | null,
    metadata: { duration: number; name?: string } | null
  ) => void;
  // Empty state flag for blur effect
  hasNoImages?: boolean;
  // Read-only mode - disables all interactions
  readOnly?: boolean;
  // Upload progress tracking
  isUploadingImage?: boolean;
  uploadProgress?: number;
  // Single image endpoint for setting video duration
  singleImageEndFrame?: number;
  onSingleImageEndFrameChange?: (endFrame: number) => void;
  // Maximum frame limit for timeline gaps (77 with smooth continuations, 81 otherwise)
  maxFrameLimit?: number;
  // Shared output selection state (syncs FinalVideoSection with SegmentOutputStrip)
  selectedOutputId?: string | null;
  onSelectedOutputChange?: (id: string | null) => void;
  // Callback when segment frame count changes (for instant timeline updates)
  onSegmentFrameCountChange?: (pairShotGenerationId: string, frameCount: number) => void;
  // Preloaded video outputs for readOnly mode (bypasses database query)
  videoOutputs?: GenerationRow[];
  // Multi-select: callback to create a new shot from selected images (returns new shot ID)
  onNewShotFromSelection?: (selectedIds: string[]) => Promise<string | void>;
  // Callback to navigate to a different shot (used for "Jump to shot" after creation)
  onShotChange?: (shotId: string) => void;
}

// Sub-component prop types are defined in their respective files
// and re-exported from components/index.ts
