// Types
export type {
  StructureGuidanceConfig,
  VideoStructureApiParams,
  StructureVideoConfig,
  StructureVideoConfigWithMetadata,
  VideoMotionApiParams,
  VideoModelApiParams,
  VideoPromptApiParams,
  PromptConfig,
  MotionConfig,
  ModelConfig,
  TravelBetweenImagesTaskParams,
  StitchConfig,
  TravelBetweenImagesTaskResult,
} from './types';

// Helper function from types
export { convertLegacyStructureType } from './types';

// Defaults
export {
  DEFAULT_VIDEO_STRUCTURE_PARAMS,
  DEFAULT_VIDEO_MOTION_PARAMS,
  DEFAULT_PROMPT_CONFIG,
  DEFAULT_MOTION_CONFIG,
  DEFAULT_MODEL_CONFIG,
} from './defaults';

// Payload builder (exported for testing / direct use)
export { buildTravelBetweenImagesPayload } from './payloadBuilder';

// Main task creator
export { createTravelBetweenImagesTask } from './createTravelBetweenImagesTask';

// Re-export TaskValidationError for convenience (was re-exported from original file)
export { TaskValidationError } from "../../taskCreation";
