/**
 * Steerable Motion Settings Types
 *
 * Types for steerable motion configuration used in video generation.
 * Moved from tools/travel-between-images/components/ShotEditor/state/types.ts
 * because these types are used across shared components.
 */

/**
 * Steerable motion settings interface
 */
export interface SteerableMotionSettings {
  negative_prompt: string;
  model_name: string;
  seed: number;
  debug: boolean;
  show_input_images: boolean;
}

/**
 * Default values for steerable motion settings - single source of truth
 */
export const DEFAULT_STEERABLE_MOTION_SETTINGS: SteerableMotionSettings = {
  negative_prompt: '',
  model_name: 'wan_2_2_i2v_lightning_baseline_2_2_2',
  seed: 789,
  debug: false,
  show_input_images: false,
};

/**
 * Interface for per-shot GenerationsPane settings
 * Used for UI state management in the generations gallery pane
 */
export interface GenerationsPaneSettings {
  selectedShotFilter: string;
  excludePositioned: boolean;
  // Flag to track if user has manually changed settings (never auto-reset after this)
  userHasCustomized?: boolean;
}
