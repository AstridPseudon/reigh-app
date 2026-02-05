/**
 * Constants for complete_task edge function
 * Centralizes magic strings to reduce typos and improve maintainability
 */

// ===== TASK TYPES =====

/**
 * Task type identifiers used throughout the completion flow
 */
export const TASK_TYPES = {
  // Segment tasks (part of orchestrator workflows)
  TRAVEL_SEGMENT: 'travel_segment',
  JOIN_CLIPS_SEGMENT: 'join_clips_segment',
  INDIVIDUAL_TRAVEL_SEGMENT: 'individual_travel_segment',
  JOIN_FINAL_STITCH: 'join_final_stitch',

  // Orchestrator tasks
  TRAVEL_ORCHESTRATOR: 'travel_orchestrator',
  JOIN_CLIPS_ORCHESTRATOR: 'join_clips_orchestrator',

  // Processing tasks
  TRAVEL_STITCH: 'travel_stitch',
  IMAGE_INPAINT: 'image_inpaint',
  IMAGE_UPSCALE: 'image-upscale',
  IMAGE_EDIT: 'image_edit',
  MAGIC_EDIT: 'magic_edit',
  QWEN_IMAGE_EDIT: 'qwen_image_edit',
  ANNOTATED_IMAGE_EDIT: 'annotated_image_edit',

  // Generation tasks
  SINGLE_IMAGE: 'single_image',
  WAN_2_2_I2V: 'wan_2_2_i2v',
} as const;

export type TaskType = typeof TASK_TYPES[keyof typeof TASK_TYPES];

// ===== TOOL TYPES =====

/**
 * Tool type identifiers corresponding to frontend tool routes
 */
export const TOOL_TYPES = {
  IMAGE_GENERATION: 'image-generation',
  IMAGE_TO_VIDEO: 'image-to-video',
  TRAVEL_BETWEEN_IMAGES: 'travel-between-images',
  JOIN_CLIPS: 'join-clips',
  MAGIC_EDIT: 'magic-edit',
  UPSCALE: 'upscale',
} as const;

export type ToolType = typeof TOOL_TYPES[keyof typeof TOOL_TYPES];

// ===== SEGMENT TYPE CONFIGURATION =====

/**
 * Configuration for segment types that participate in orchestrator completion
 */
export interface SegmentTypeConfig {
  segmentType: TaskType;
  runIdField: string;
  expectedCountField: string;
  /**
   * If true, this task type is the final step that directly completes the orchestrator.
   * When it completes, the orchestrator is marked complete immediately (no sibling counting).
   */
  isFinalStep?: boolean;
  /**
   * If set, when this segment type completes, check if there's a pending task of this type
   * before marking the orchestrator complete. Used to wait for a final stitch step.
   */
  waitForFinalStepType?: TaskType;
}

export const SEGMENT_TYPE_CONFIG: Record<string, SegmentTypeConfig> = {
  [TASK_TYPES.TRAVEL_SEGMENT]: {
    segmentType: TASK_TYPES.TRAVEL_SEGMENT,
    runIdField: 'orchestrator_run_id',
    expectedCountField: 'num_new_segments_to_generate'
  },
  [TASK_TYPES.JOIN_CLIPS_SEGMENT]: {
    segmentType: TASK_TYPES.JOIN_CLIPS_SEGMENT,
    runIdField: 'run_id',
    expectedCountField: 'num_joins',
    // Wait for join_final_stitch before marking orchestrator complete
    waitForFinalStepType: TASK_TYPES.JOIN_FINAL_STITCH
  },
  [TASK_TYPES.JOIN_FINAL_STITCH]: {
    segmentType: TASK_TYPES.JOIN_FINAL_STITCH,
    runIdField: 'run_id',
    expectedCountField: '', // Not used - this is a single task
    isFinalStep: true
  }
};
