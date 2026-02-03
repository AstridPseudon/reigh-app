/**
 * Types for SegmentSettingsForm component
 */

import type { PhaseConfig } from '@/shared/types/phaseConfig';
import type { LoraConfig } from '@/shared/types/segmentSettings';
import type { SegmentSettings } from '../segmentSettingsUtils';
import type { StructureVideoConfigWithMetadata } from '@/shared/lib/tasks/travelBetweenImages';

export interface SegmentSettingsFormProps {
  /** Current settings (controlled) */
  settings: SegmentSettings;
  /** Callback when settings change */
  onChange: (updates: Partial<SegmentSettings>) => void;
  /** Callback when form is submitted */
  onSubmit: () => Promise<void>;

  // Display context (read-only)
  /** Segment index for display */
  segmentIndex?: number;
  /** Start image URL for preview */
  startImageUrl?: string;
  /** End image URL for preview */
  endImageUrl?: string;
  /** Model name for display */
  modelName?: string;
  /** Resolution for display */
  resolution?: string;

  // UI configuration
  /** Whether this is regenerating an existing segment */
  isRegeneration?: boolean;
  /** Whether submit is in progress */
  isSubmitting?: boolean;
  /** Custom button label */
  buttonLabel?: string;
  /** Show header */
  showHeader?: boolean;
  /** Header title */
  headerTitle?: string;
  /** Maximum frames allowed */
  maxFrames?: number;
  /** Query key prefix for presets */
  queryKeyPrefix?: string;
  /** Callback when frame count changes (for timeline sync) */
  onFrameCountChange?: (frames: number) => void;
  /** Callback to restore default settings */
  onRestoreDefaults?: () => void;
  /** Callback to save current settings as shot defaults */
  onSaveAsShotDefaults?: () => Promise<boolean>;
  /** Callback to save a single field's current value as shot default */
  onSaveFieldAsDefault?: (field: keyof SegmentSettings, value: SegmentSettings[keyof SegmentSettings]) => Promise<boolean>;
  /** Which fields have pair-level overrides (vs using shot defaults) */
  hasOverride?: {
    prompt: boolean;
    negativePrompt: boolean;
    textBeforePrompts: boolean;
    textAfterPrompts: boolean;
    motionMode: boolean;
    amountOfMotion: boolean;
    phaseConfig: boolean;
    loras: boolean;
    selectedPhasePresetId: boolean;
    structureMotionStrength: boolean;
    structureTreatment: boolean;
    structureUni3cEndPercent: boolean;
  };
  /** Shot-level defaults (shown as placeholder when no override) */
  shotDefaults?: {
    prompt: string;
    negativePrompt: string;
    textBeforePrompts: string;
    textAfterPrompts: string;
    motionMode: 'basic' | 'advanced';
    amountOfMotion: number;
    phaseConfig?: PhaseConfig;
    loras: LoraConfig[];
    selectedPhasePresetId: string | null;
  };
  /** Whether user has made local edits (used for immediate UI updates before DB save) */
  isDirty?: boolean;

  // Structure video context (for per-segment overrides)
  /** Structure video type for this segment (null = no structure video) */
  structureVideoType?: 'uni3c' | 'flow' | 'canny' | 'depth' | null;
  /** Shot-level structure video defaults (for display when no segment override) */
  structureVideoDefaults?: {
    motionStrength: number;
    treatment: 'adjust' | 'clip';
    uni3cEndPercent: number;
  };
  /** Structure video URL for preview */
  structureVideoUrl?: string;
  /** Frame range info for this segment's structure video usage */
  structureVideoFrameRange?: {
    segmentStart: number;
    segmentEnd: number;
    videoTotalFrames: number;
    videoFps: number;
    /** Video's output start position on timeline (for "fit to range" calculation) */
    videoOutputStart?: number;
    /** Video's output end position on timeline (for "fit to range" calculation) */
    videoOutputEnd?: number;
  };

  // Enhanced prompt (AI-generated)
  /** AI-generated enhanced prompt (stored separately from user settings) */
  enhancedPrompt?: string;
  /** The base prompt that was used when enhanced prompt was created (for comparison) */
  basePromptForEnhancement?: string;
  /** Callback to clear the enhanced prompt */
  onClearEnhancedPrompt?: () => Promise<boolean>;
  /** Whether to enhance prompt during generation (controlled by parent) */
  enhancePromptEnabled?: boolean;
  /** Callback when enhance prompt toggle changes */
  onEnhancePromptChange?: (enabled: boolean) => void;

  // Layout customization
  /**
   * Amount (in Tailwind spacing units) to extend Advanced Settings to container edges.
   * Use 4 for p-4 containers (default), 6 for p-6 containers.
   */
  edgeExtendAmount?: 4 | 6;

  // Per-segment structure video management (Timeline Mode only)
  /** Whether in timeline mode (shows structure video upload) vs batch mode (preview only) */
  isTimelineMode?: boolean;
  /** Callback to add a structure video for this segment */
  onAddSegmentStructureVideo?: (video: StructureVideoConfigWithMetadata) => void;
  /** Callback to update this segment's structure video */
  onUpdateSegmentStructureVideo?: (updates: Partial<StructureVideoConfigWithMetadata>) => void;
  /** Callback to remove this segment's structure video */
  onRemoveSegmentStructureVideo?: () => void;

  // Navigation to constituent images
  /** Shot generation ID for the start image (for navigation) */
  startImageShotGenerationId?: string;
  /** Shot generation ID for the end image (for navigation) */
  endImageShotGenerationId?: string;
  /** Callback to navigate to a constituent image by shot_generation.id */
  onNavigateToImage?: (shotGenerationId: string) => void;
}

// Re-export for convenience
export type { SegmentSettings } from '../segmentSettingsUtils';
export type { LoraConfig } from '@/shared/types/segmentSettings';
