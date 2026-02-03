/**
 * Task Details Components
 *
 * Specialized components for displaying task details based on task type.
 * These are used by GenerationDetails and other shared components.
 */

// Re-export types from shared
export type { TaskDetailsProps, VariantConfig } from '@/shared/types/taskDetailsTypes';
export { getVariantConfig } from '@/shared/types/taskDetailsTypes';

// Re-export utilities from shared
export {
  parseTaskParams,
  deriveInputImages,
  derivePrompt,
  IMAGE_EDIT_TASK_TYPES,
  isImageEditTaskType,
  isVideoEnhanceTaskType,
  extractLoras,
  type LoraInfo,
} from '@/shared/utils/taskParamsUtils';

// Export task detail components
export { ImageEditTaskDetails } from './ImageEditTaskDetails';
export { CharacterAnimateDetails } from './CharacterAnimateDetails';
export { JoinClipsDetails } from './JoinClipsDetails';
export { VideoTravelDetails } from './VideoTravelDetails';
export { VideoEnhanceDetails } from './VideoEnhanceDetails';
