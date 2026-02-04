/**
 * Task Details Components
 *
 * Specialized components for displaying task details based on task type.
 * These are used by GenerationDetails and other shared components.
 *
 * Note: Types and utilities (parseTaskParams, deriveInputImages, etc.) should be
 * imported directly from their source modules:
 * - Types: @/shared/types/taskDetailsTypes
 * - Utilities: @/shared/utils/taskParamsUtils
 */

// Export task detail components
export { ImageEditTaskDetails } from './ImageEditTaskDetails';
export { ImageEnhanceDetails } from './ImageEnhanceDetails';
export { CharacterAnimateDetails } from './CharacterAnimateDetails';
export { JoinClipsDetails } from './JoinClipsDetails';
export { VideoTravelDetails } from './VideoTravelDetails';
export { VideoEnhanceDetails } from './VideoEnhanceDetails';
