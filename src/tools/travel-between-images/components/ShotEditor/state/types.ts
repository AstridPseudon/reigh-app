export {
  type SteerableMotionSettings,
  DEFAULT_STEERABLE_MOTION_SETTINGS,
  type GenerationsPaneSettings,
} from '@/shared/types/steerableMotion';

/** Must be wrapped in VideoTravelSettingsProvider (settings come from context). */
export interface ShotEditorProps {
  // Core identifiers
  selectedShotId: string;
  projectId: string;
  /** Optimistic shot data for newly created shots that aren't in the cache yet */
  optimisticShotData?: Partial<import('@/domains/generation/types').Shot>;

  // Callbacks
  onShotImagesUpdate: () => void;
  onBack: () => void;

  // Dimension settings (not in context yet)
  dimensionSource?: 'project' | 'firstImage' | 'custom';
  onDimensionSourceChange?: (source: 'project' | 'firstImage' | 'custom') => void;
  customWidth?: number;
  onCustomWidthChange?: (width?: number) => void;
  customHeight?: number;
  onCustomHeightChange?: (height?: number) => void;

  // Navigation
  onPreviousShot?: () => void;
  onNextShot?: () => void;
  onPreviousShotNoScroll?: () => void;
  onNextShotNoScroll?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onUpdateShotName?: (newName: string) => void;

  // Cache & video counts
  getShotVideoCount?: (shotId: string | null) => number | null;
  getFinalVideoCount?: (shotId: string | null) => number | null;
  getHasStructureVideo?: (shotId: string | null) => boolean | null;
  invalidateVideoCountsCache?: () => void;

  // Parent refs (for floating UI coordination)
  headerContainerRef?: (node: HTMLDivElement | null) => void;
  timelineSectionRef?: (node: HTMLDivElement | null) => void;
  ctaContainerRef?: (node: HTMLDivElement | null) => void;
  onSelectionChange?: (hasSelection: boolean) => void;
  getGenerationDataRef?: React.MutableRefObject<(() => {
    structureVideo: {
      path: string | null;
      type: 'canny' | 'depth' | null;
      treatment: 'adjust' | 'clip';
      motionStrength: number;
    };
    aspectRatio: string | null;
    loras: Array<{ id: string; path: string; strength: number; name: string }>;
    clearEnhancedPrompts: () => Promise<void>;
  }) | null>;
  generateVideoRef?: React.MutableRefObject<((variantName?: string) => void | Promise<void>) | null>;
  nameClickRef?: React.MutableRefObject<(() => void) | null>;

  // UI state
  /** Whether the floating sticky header is visible (hide main header when true) */
  isSticky?: boolean;
  variantName?: string;
  onVariantNameChange?: (name: string) => void;
  isGeneratingVideo?: boolean;
  videoJustQueued?: boolean;
  /** Suppress query refetches during drag operations */
  onDragStateChange?: (isDragging: boolean) => void;
}

export interface ShotEditorState {
  isUploadingImage: boolean;
  uploadProgress: number;
  fileInputKey: number;
  deletingVideoId: string | null;
  duplicatingImageId: string | null;
  duplicateSuccessImageId: string | null;
  pendingFramePositions: Map<string, number>;
  creatingTaskId: string | null;
  isSettingsModalOpen: boolean;
  isModeReady: boolean;
  settingsError: string | null;
  isEditingName: boolean;
  editingName: string;
  isTransitioningFromNameEdit: boolean;
  showStepsNotification: boolean;
  hasInitializedShot: string | null;
  hasInitializedUISettings: string | null;
}

export type ShotEditorAction =
  | { type: 'SET_UPLOADING_IMAGE'; payload: boolean }
  | { type: 'SET_UPLOAD_PROGRESS'; payload: number }
  | { type: 'SET_FILE_INPUT_KEY'; payload: number }
  | { type: 'SET_DELETING_VIDEO_ID'; payload: string | null }
  | { type: 'SET_DUPLICATING_IMAGE_ID'; payload: string | null }
  | { type: 'SET_DUPLICATE_SUCCESS_IMAGE_ID'; payload: string | null }
  | { type: 'SET_PENDING_FRAME_POSITIONS'; payload: Map<string, number> }
  | { type: 'SET_CREATING_TASK_ID'; payload: string | null }
  | { type: 'SET_SETTINGS_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_MODE_READY'; payload: boolean }
  | { type: 'SET_SETTINGS_ERROR'; payload: string | null }
  | { type: 'SET_EDITING_NAME'; payload: boolean }
  | { type: 'SET_EDITING_NAME_VALUE'; payload: string }
  | { type: 'SET_TRANSITIONING_FROM_NAME_EDIT'; payload: boolean }
  | { type: 'SET_SHOW_STEPS_NOTIFICATION'; payload: boolean }
  | { type: 'SET_HAS_INITIALIZED_SHOT'; payload: string | null }
  | { type: 'SET_HAS_INITIALIZED_UI_SETTINGS'; payload: string | null };
