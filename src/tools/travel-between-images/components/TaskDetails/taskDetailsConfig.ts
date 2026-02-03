/**
 * taskDetailsConfig - Re-exports from shared
 *
 * Types and utilities have been moved to shared:
 * - Types: @/shared/types/taskDetailsTypes
 * - Utilities: @/shared/utils/taskParamsUtils
 *
 * Re-exported here for backwards compatibility with existing imports.
 */

// Re-export types
export type { TaskDetailsProps, VariantConfig } from '@/shared/types/taskDetailsTypes';
export { getVariantConfig } from '@/shared/types/taskDetailsTypes';

// Re-export utilities
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
