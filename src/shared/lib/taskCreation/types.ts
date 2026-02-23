import { ValidationError } from '@/shared/lib/errorHandling/errors';

/**
 * Default aspect ratio to use when project aspect ratio is not found.
 */
export const DEFAULT_ASPECT_RATIO = '1:1';

/**
 * Interface for project resolution lookup result.
 */
export interface ProjectResolutionResult {
  resolution: string;
  aspectRatio: string;
}

/**
 * Common task creation parameters that all tasks should have.
 */
export interface BaseTaskParams {
  project_id: string;
  task_type: string;
  params: Record<string, unknown>;
}

/**
 * Result from creating a task via the edge function.
 * This is the standard response shape for all task creation operations.
 */
export interface TaskCreationResult {
  /** The created task's unique ID */
  task_id: string;
  /** Task status (typically 'pending' for newly created tasks) */
  status: string;
  /** Error message if task creation failed */
  error?: string;
}

/**
 * Validation error type for task parameter validation.
 * Extends ValidationError for consistent error handling.
 */
export class TaskValidationError extends ValidationError {
  constructor(message: string, field?: string) {
    super(message, { field });
    this.name = 'TaskValidationError';
  }
}

/**
 * Hires fix API parameters for image generation/edit tasks.
 * Uses snake_case to match API directly.
 */
export interface HiresFixApiParams {
  /** Number of inference steps (used for single-pass or base pass in two-pass mode) */
  num_inference_steps?: number;
  hires_scale?: number;
  hires_steps?: number;
  hires_denoise?: number;
  /** Lightning LoRA strength for phase 1 (initial generation) */
  lightning_lora_strength_phase_1?: number;
  /** Lightning LoRA strength for phase 2 (hires/refinement pass) */
  lightning_lora_strength_phase_2?: number;
  additional_loras?: Record<string, string>;
}
