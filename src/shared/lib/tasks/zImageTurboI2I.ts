import { createTask, validateRequiredFields, TaskValidationError, processBatchResults } from '../taskCreation';
import type { TaskCreationResult } from '../taskCreation';
import { handleError } from '@/shared/lib/errorHandling/handleError';
import type { FalLoraConfig } from '@/shared/types/lora';

/**
 * Parameters for creating a Z Image Turbo image-to-image task
 * Maps to fal-ai/z-image/turbo/image-to-image endpoint
 */
interface ZImageTurboImageToImageTaskParams {
  project_id: string;
  image_url: string;           // Source image URL (required)
  prompt?: string;             // Text prompt (default "")
  strength?: number;           // Transform strength 0-1 (default 0.6)
  enable_prompt_expansion?: boolean; // Enable AI prompt expansion (default false)
  seed?: number;               // Random seed (optional)
  numImages?: number;          // Number of outputs (default 1, max 4)
  loras?: FalLoraConfig[];  // LoRAs (triggers /lora endpoint if provided)
  shot_id?: string;            // Associate with shot
  based_on?: string;           // Source generation ID for lineage
  source_variant_id?: string;  // Source variant ID
  create_as_generation?: boolean; // Create as new generation vs variant
  tool_type?: string;          // Override tool type
}

/**
 * Parameters for batch Z Image Turbo image-to-image task creation
 */
interface BatchZImageTurboImageToImageTaskParams {
  project_id: string;
  image_url: string;
  prompt?: string;
  strength?: number;
  enable_prompt_expansion?: boolean;
  seed?: number;
  numImages: number;           // How many variations to generate (creates multiple tasks)
  loras?: FalLoraConfig[];
  shot_id?: string;
  based_on?: string;
  source_variant_id?: string;
  create_as_generation?: boolean;
  tool_type?: string;
}

/**
 * Validates Z Image Turbo image-to-image task parameters
 */
function validateZImageTurboImageToImageParams(params: ZImageTurboImageToImageTaskParams): void {
  validateRequiredFields(params, ['project_id', 'image_url']);

  if (!params.image_url || params.image_url.trim() === '') {
    throw new TaskValidationError('Image URL cannot be empty', 'image_url');
  }

  // Validate URL format
  try {
    new URL(params.image_url);
  } catch {
    throw new TaskValidationError('Image URL must be a valid URL', 'image_url');
  }

  if (params.strength !== undefined && (params.strength < 0 || params.strength > 1)) {
    throw new TaskValidationError('Strength must be between 0 and 1', 'strength');
  }

  if (params.numImages !== undefined && (params.numImages < 1 || params.numImages > 4)) {
    throw new TaskValidationError('Number of images must be between 1 and 4', 'numImages');
  }

  if (params.seed !== undefined && (params.seed < 0 || params.seed > 0x7fffffff)) {
    throw new TaskValidationError('Seed must be a 32-bit positive integer', 'seed');
  }

  if (params.loras && params.loras.length > 0) {
    params.loras.forEach((lora, index) => {
      if (!lora.path || lora.path.trim() === '') {
        throw new TaskValidationError(`LoRA ${index + 1}: path is required`, `loras[${index}].path`);
      }
      if (lora.scale !== undefined && (lora.scale < 0 || lora.scale > 2)) {
        throw new TaskValidationError(`LoRA ${index + 1}: scale must be between 0 and 2`, `loras[${index}].scale`);
      }
    });
  }
}

/**
 * Validates batch parameters
 */
function validateBatchParams(params: BatchZImageTurboImageToImageTaskParams): void {
  validateRequiredFields(params, ['project_id', 'image_url', 'numImages']);

  if (params.numImages < 1 || params.numImages > 16) {
    throw new TaskValidationError('Number of images must be between 1 and 16', 'numImages');
  }

  // Validate the rest using single task validation
  validateZImageTurboImageToImageParams({
    project_id: params.project_id,
    image_url: params.image_url,
    prompt: params.prompt,
    strength: params.strength,
    loras: params.loras,
  });
}

/**
 * Builds task params in the format expected by the worker
 */
function buildTaskParams(params: ZImageTurboImageToImageTaskParams): Record<string, unknown> {
  const taskParams: Record<string, unknown> = {
    image_url: params.image_url,
    prompt: params.prompt ?? '',
    strength: params.strength ?? 0.6,
    enable_prompt_expansion: params.enable_prompt_expansion ?? false,
    num_images: params.numImages ?? 1,
    // API-specific params
    image_size: 'auto',
    num_inference_steps: 8,
    output_format: 'png',
    enable_safety_checker: true,
  };

  // Add seed if provided
  if (params.seed !== undefined) {
    taskParams.seed = params.seed;
  }

  // Add LoRAs if provided (transforms to API format)
  if (params.loras && params.loras.length > 0) {
    taskParams.loras = params.loras.map(lora => ({
      path: lora.path,
      scale: lora.scale ?? 1.0,
    }));
    // When using LoRAs, acceleration must be "none"
    taskParams.acceleration = 'none';
  } else {
    // Without LoRAs, use "high" acceleration
    taskParams.acceleration = 'high';
  }

  // Add lineage tracking
  if (params.based_on) {
    taskParams.based_on = params.based_on;
  }

  if (params.source_variant_id) {
    taskParams.source_variant_id = params.source_variant_id;
  }

  if (params.create_as_generation) {
    taskParams.create_as_generation = true;
  }

  // Add shot association
  if (params.shot_id) {
    taskParams.shot_id = params.shot_id;
  }

  // Add tool type override
  if (params.tool_type) {
    taskParams.tool_type = params.tool_type;
  }

  // Make edits unpositioned by default
  taskParams.add_in_position = false;

  return taskParams;
}

/**
 * Creates a single Z Image Turbo image-to-image task
 * (internal use only - used by createBatchZImageTurboImageToImageTasks)
 */
async function createZImageTurboImageToImageTask(params: ZImageTurboImageToImageTaskParams): Promise<TaskCreationResult> {

  try {
    // 1. Validate parameters
    validateZImageTurboImageToImageParams(params);

    // 2. Build task params
    const taskParams = buildTaskParams(params);

    // 3. Create task using unified create-task function
    const result = await createTask({
      project_id: params.project_id,
      task_type: 'z_image_turbo_i2i',
      params: taskParams,
    });

    return result;

  } catch (error) {
    handleError(error, { context: 'ZImageTurboImageToImage', showToast: false });
    throw error;
  }
}

/**
 * Creates multiple Z Image Turbo image-to-image tasks in parallel (batch generation)
 */
export async function createBatchZImageTurboImageToImageTasks(
  params: BatchZImageTurboImageToImageTaskParams
): Promise<TaskCreationResult[]> {

  try {
    // 1. Validate parameters
    validateBatchParams(params);

    // 2. Generate individual task parameters for each image
    const taskParams = Array.from({ length: params.numImages }, (_, index) => {
      // Generate a different seed for each task
      const seed = params.seed ?? Math.floor(Math.random() * 0x7fffffff);

      return {
        project_id: params.project_id,
        image_url: params.image_url,
        prompt: params.prompt,
        strength: params.strength,
        enable_prompt_expansion: params.enable_prompt_expansion,
        seed: seed + index, // Increment seed for variation
        numImages: 1, // Each task creates one image
        loras: params.loras,
        shot_id: params.shot_id,
        based_on: params.based_on,
        source_variant_id: params.source_variant_id,
        create_as_generation: params.create_as_generation,
        tool_type: params.tool_type,
      } as ZImageTurboImageToImageTaskParams;
    });

    // 3. Create all tasks in parallel
    const results = await Promise.allSettled(
      taskParams.map(taskParam => createZImageTurboImageToImageTask(taskParam))
    );

    return processBatchResults(results, 'createBatchZImageTurboImageToImageTasks');

  } catch (error) {
    handleError(error, { context: 'BatchZImageTurboImageToImage', showToast: false });
    throw error;
  }
}

// TaskValidationError is used internally - import from taskCreation.ts if needed externally
