import type {
  VideoStructureApiParams,
  VideoMotionApiParams,
  PromptConfig,
  MotionConfig,
  ModelConfig,
} from './types';

/**
 * Default values for video structure API params
 */
export const DEFAULT_VIDEO_STRUCTURE_PARAMS: Required<Pick<VideoStructureApiParams, 'structure_video_treatment' | 'structure_video_motion_strength' | 'structure_video_type'>> = {
  structure_video_treatment: 'adjust',
  structure_video_motion_strength: 1.2,
  structure_video_type: 'uni3c',  // Hardcoded to uni3c - only supported option now
};

/**
 * Default values for travel between images task settings
 */
export const DEFAULT_TRAVEL_BETWEEN_IMAGES_VALUES = {
  model_name: "base_tester_model",
  seed: 789,
  steps: 20,
  after_first_post_generation_saturation: 1,
  after_first_post_generation_brightness: 0,
  debug: true,
  main_output_dir_for_run: "./outputs/default_travel_output",
  enhance_prompt: false,
  show_input_images: false,
  generation_mode: "batch" as const,
  dimension_source: "project" as const,
  amount_of_motion: 0.5, // Default to 0.5 (equivalent to UI value of 50)
};
