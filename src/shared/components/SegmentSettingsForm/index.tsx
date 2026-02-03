/**
 * SegmentSettingsForm - Barrel Exports
 *
 * Re-exports the main component and all sub-components/hooks/types
 * for backwards compatibility with existing imports.
 */

// Main component
export { SegmentSettingsForm, default } from './SegmentSettingsForm';

// Types
export type { SegmentSettingsFormProps, SegmentSettings, LoraConfig } from './types';

// Sub-components (for advanced usage)
export {
  FieldDefaultControls,
  EnhancedPromptBadge,
  StructureVideoPreview,
  VideoPreviewSkeleton,
} from './components';

export type {
  FieldDefaultControlsProps,
  EnhancedPromptBadgeProps,
  StructureVideoPreviewProps,
  VideoPreviewSkeletonProps,
} from './components';

// Hooks
export { useStructureVideoUpload } from './hooks';
export type {
  UseStructureVideoUploadOptions,
  UseStructureVideoUploadReturn,
} from './hooks';
