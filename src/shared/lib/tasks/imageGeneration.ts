import {
  createTask,
  generateTaskId,
  resolveProjectResolution,
  validateRequiredFields,
  TaskValidationError,
  type HiresFixApiParams,
} from '../taskCreation';
import { processBatchResults, type TaskCreationResult } from '../taskCreation';
import { ASPECT_RATIO_TO_RESOLUTION } from '../aspectRatios';
import { handleError } from '@/shared/lib/errorHandling/handleError';
import type { PathLoraConfig } from '@/shared/types/lora';

// ============================================================================
// API Parameter Types (single source of truth)
// ============================================================================

/** Reference mode for image generation */
export type ReferenceMode = 'style' | 'subject' | 'style-character' | 'scene' | 'custom';

/**
 * Reference-related API parameters for image generation tasks.
 * Uses snake_case to match API directly.
 */
export interface ReferenceApiParams {
  style_reference_image?: string;
  style_reference_strength: number;
  subject_strength: number;
  subject_description: string;
  in_this_scene: boolean;
  in_this_scene_strength: number;
  reference_mode: ReferenceMode;
}

// HiresFixApiParams is now defined in taskCreation.ts — re-export for backward compatibility
export type { HiresFixApiParams } from '../taskCreation';

/**
 * Filter reference settings based on the selected reference mode.
 * This ensures only relevant settings are passed to the backend based on what mode is active.
 */
function filterReferenceSettingsByMode(
  referenceMode: 'style' | 'subject' | 'style-character' | 'scene' | 'custom' | undefined,
  settings: {
    style_reference_strength?: number;
    subject_strength?: number;
    subject_description?: string;
    in_this_scene?: boolean;
    in_this_scene_strength?: number;
  }
): Partial<typeof settings> {
  // If no mode specified or custom mode, pass all settings as-is
  if (!referenceMode || referenceMode === 'custom') {
    return settings;
  }

  const filtered: Partial<typeof settings> = {};
  
  switch (referenceMode) {
    case 'style':
      // Style mode: only pass style strength, exclude subject and scene
      if (settings.style_reference_strength !== undefined) {
        filtered.style_reference_strength = settings.style_reference_strength;
      }
      break;

    case 'subject':
      // Subject mode: style at 1.1, subject at 0.5, plus description
      filtered.style_reference_strength = 1.1;
      filtered.subject_strength = 0.5;
      if (settings.subject_description !== undefined && settings.subject_description.trim()) {
        filtered.subject_description = settings.subject_description;
      }
      break;

    case 'style-character':
      // Style + Subject mode: pass both style and subject, exclude scene
      if (settings.style_reference_strength !== undefined) {
        filtered.style_reference_strength = settings.style_reference_strength;
      }
      if (settings.subject_strength !== undefined) {
        filtered.subject_strength = settings.subject_strength;
      }
      if (settings.subject_description !== undefined && settings.subject_description.trim()) {
        filtered.subject_description = settings.subject_description;
      }
      break;

    case 'scene':
      // Scene mode: style at 1.1, scene strength at 0.5
      filtered.style_reference_strength = 1.1;
      filtered.in_this_scene = true;
      filtered.in_this_scene_strength = 0.5;
      break;
  }
  
  return filtered;
}

/**
 * Parameters for creating an image generation task.
 * Extends ReferenceApiParams and HiresFixApiParams for single source of truth.
 */
interface ImageGenerationTaskParams extends Partial<ReferenceApiParams>, Partial<HiresFixApiParams> {
  project_id: string;
  prompt: string;
  negative_prompt?: string;
  resolution?: string;
  model_name?: string;
  seed?: number;
  loras?: PathLoraConfig[];
  shot_id?: string;
  subject_reference_image?: string; // Can differ from style_reference_image
  steps?: number;
}

/**
 * Parameters for creating multiple image generation tasks (batch generation).
 * Extends ReferenceApiParams and HiresFixApiParams for single source of truth.
 */
export interface BatchImageGenerationTaskParams extends Partial<ReferenceApiParams>, Partial<HiresFixApiParams> {
  project_id: string;
  prompts: Array<{
    id: string;
    fullPrompt: string;
    shortPrompt?: string;
  }>;
  imagesPerPrompt: number;
  loras?: PathLoraConfig[];
  shot_id?: string;
  resolution?: string;
  /** User-configurable resolution scale multiplier (1.0-2.5x). If not provided, defaults to 1.5. */
  resolution_scale?: number;
  /** Resolution mode: 'project' uses project dimensions, 'custom' uses custom_aspect_ratio */
  resolution_mode?: 'project' | 'custom';
  /** Custom aspect ratio when resolution_mode is 'custom' (e.g., "16:9") */
  custom_aspect_ratio?: string;
  model_name?: string;
  subject_reference_image?: string; // Can differ from style_reference_image
  steps?: number;
}

/**
 * Validates an array of LoRA configs.
 * Shared by single and batch image generation validation.
 * @throws TaskValidationError if any LoRA is invalid
 */
function validateLoras(loras: PathLoraConfig[] | undefined): void {
  if (!loras || loras.length === 0) return;
  loras.forEach((lora, index) => {
    if (!lora.path || lora.path.trim() === '') {
      throw new TaskValidationError(`LoRA ${index + 1}: path is required`, `loras[${index}].path`);
    }
    if (typeof lora.strength !== 'number' || lora.strength < 0 || lora.strength > 2) {
      throw new TaskValidationError(`LoRA ${index + 1}: strength must be a number between 0 and 2`, `loras[${index}].strength`);
    }
  });
}

/**
 * Validates image generation task parameters
 * @param params - Parameters to validate
 * @throws TaskValidationError if validation fails
 */
function validateImageGenerationParams(params: ImageGenerationTaskParams): void {
  validateRequiredFields(params, ['project_id', 'prompt']);

  // Additional validation specific to image generation
  if (params.prompt.trim() === '') {
    throw new TaskValidationError('Prompt cannot be empty', 'prompt');
  }

  if (params.seed !== undefined && (params.seed < 0 || params.seed > 0x7fffffff)) {
    throw new TaskValidationError('Seed must be a 32-bit positive integer', 'seed');
  }

  validateLoras(params.loras);
}

/**
 * Validates batch image generation parameters
 * @param params - Parameters to validate
 * @throws TaskValidationError if validation fails
 */
function validateBatchImageGenerationParams(params: BatchImageGenerationTaskParams): void {
  validateRequiredFields(params, ['project_id', 'prompts', 'imagesPerPrompt']);

  if (params.prompts.length === 0) {
    throw new TaskValidationError('At least one prompt is required', 'prompts');
  }

  if (params.imagesPerPrompt < 1 || params.imagesPerPrompt > 16) {
    throw new TaskValidationError('Images per prompt must be between 1 and 16', 'imagesPerPrompt');
  }

  params.prompts.forEach((prompt, index) => {
    if (!prompt.fullPrompt || prompt.fullPrompt.trim() === '') {
      throw new TaskValidationError(`Prompt ${index + 1}: fullPrompt cannot be empty`, `prompts[${index}].fullPrompt`);
    }
  });

  validateLoras(params.loras);
}

// Removed buildImageGenerationPayload function - now storing all data at top level to avoid duplication

/**
 * Options for calculateTaskResolution
 */
interface CalculateTaskResolutionOptions {
  /** Project ID for resolution lookup */
  projectId: string;
  /** Optional explicit resolution override (bypasses all calculations) */
  customResolution?: string;
  /** Model name (determines if scaling is applied) */
  modelName?: string;
  /** User-configurable resolution scale multiplier (1.0-2.5x). Defaults to 1.5 for image models. */
  resolution_scale?: number;
  /** Resolution mode: 'project' uses project dimensions, 'custom' uses custom_aspect_ratio */
  resolution_mode?: 'project' | 'custom';
  /** Custom aspect ratio when resolution_mode is 'custom' (e.g., "16:9") */
  custom_aspect_ratio?: string;
}

/**
 * Calculates the final resolution for image generation tasks.
 * Applies user-configurable scaling for supported image generation models.
 * (internal use only - not exported)
 * @param options - Resolution calculation options
 * @returns Promise resolving to the final resolution string
 */
async function calculateTaskResolution(
  options: CalculateTaskResolutionOptions
): Promise<string> {
  const { projectId, resolution_scale, resolution_mode, custom_aspect_ratio } = options;

  // 1. If explicit custom resolution is provided, use it as-is (assumes it's already final)
  if (options.customResolution?.trim()) {
    return options.customResolution.trim();
  }

  // 2. Determine base resolution
  let baseResolution: string;

  if (resolution_mode === 'custom' && custom_aspect_ratio) {
    // Use custom aspect ratio
    baseResolution = ASPECT_RATIO_TO_RESOLUTION[custom_aspect_ratio] ?? '902x508';
  } else {
    // Use project resolution
    const { resolution } = await resolveProjectResolution(projectId);
    baseResolution = resolution;
  }

  // 3. Apply scaling for image generation models
  const isImageGenerationModel = options.modelName === 'qwen-image' || options.modelName === 'qwen-image-2512' || options.modelName === 'z-image';
  if (isImageGenerationModel) {
    const scale = resolution_scale ?? 1.5; // Default to 1.5 if not specified
    const [width, height] = baseResolution.split('x').map(Number);
    const scaledWidth = Math.round(width * scale);
    const scaledHeight = Math.round(height * scale);
    const scaledResolution = `${scaledWidth}x${scaledHeight}`;
    return scaledResolution;
  }

  return baseResolution;
}

const IN_SCENE_LORA_URL = 'https://huggingface.co/peteromallet/random_junk/resolve/main/in_scene_different_object_000010500.safetensors';

function buildLorasParam(
  loras: PathLoraConfig[] | undefined,
  inSceneLora?: { url: string; strength: number },
): { additional_loras?: Record<string, number> } {
  const lorasMap: Record<string, number> = {};

  if (loras?.length) {
    loras.forEach((lora) => {
      lorasMap[lora.path] = lora.strength;
    });
  }

  if (inSceneLora && inSceneLora.strength > 0) {
    lorasMap[inSceneLora.url] = inSceneLora.strength;
  }

  return Object.keys(lorasMap).length > 0 ? { additional_loras: lorasMap } : {};
}

function buildReferenceParams(
  styleReferenceImage: string | undefined,
  mode: ReferenceMode | undefined,
  settings: {
    subjectReferenceImage?: string;
    styleReferenceStrength?: number;
    subjectStrength?: number;
    subjectDescription?: string;
    inThisScene?: boolean;
    inThisSceneStrength?: number;
  },
): Record<string, unknown> {
  if (!styleReferenceImage) return {};

  const filteredSettings = filterReferenceSettingsByMode(mode, {
    style_reference_strength: settings.styleReferenceStrength,
    subject_strength: settings.subjectStrength,
    subject_description: settings.subjectDescription,
    in_this_scene: settings.inThisScene,
    in_this_scene_strength: settings.inThisSceneStrength,
  });

  return {
    style_reference_image: styleReferenceImage,
    subject_reference_image: settings.subjectReferenceImage || styleReferenceImage,
    ...filteredSettings,
    ...(filteredSettings.in_this_scene_strength !== undefined
      ? { scene_reference_strength: filteredSettings.in_this_scene_strength }
      : {}),
  };
}

function buildHiresOverride(
  hiresScale: number | undefined,
  hiresDenoise: number | undefined,
  hiresSteps: number | undefined,
  additionalLoras: Record<string, number> | undefined,
  baseLoras: Record<string, number> = {},
): Record<string, unknown> {
  return {
    ...(hiresScale !== undefined ? { hires_scale: hiresScale } : {}),
    ...(hiresSteps !== undefined ? { hires_steps: hiresSteps } : {}),
    ...(hiresDenoise !== undefined ? { hires_denoise: hiresDenoise } : {}),
    ...(additionalLoras && Object.keys(additionalLoras).length > 0
      ? { additional_loras: { ...baseLoras, ...additionalLoras } }
      : {}),
  };
}

/**
 * Creates a single image generation task using the unified approach
 * This replaces the direct call to the single-image-generate edge function
 * (internal use only - used by createBatchImageGenerationTasks)
 *
 * @param params - Image generation task parameters
 * @returns Promise resolving to the created task
 */
async function createImageGenerationTask(params: ImageGenerationTaskParams): Promise<TaskCreationResult> {

  try {
    // 1. Validate parameters
    validateImageGenerationParams(params);

    // 2. Calculate final resolution (handles Qwen scaling automatically)
    const finalResolution = await calculateTaskResolution({
      projectId: params.project_id,
      customResolution: params.resolution,
      modelName: params.model_name,
    });

    // 3. Determine task type based on model and whether there's a style reference
    const taskType = (() => {
      const modelName = params.model_name;
      const hasStyleRef = !!params.style_reference_image;

      switch (modelName) {
        case 'qwen-image':
          // Use qwen_image_style for by-reference mode, qwen_image for just-text
          return hasStyleRef ? 'qwen_image_style' : 'qwen_image';
        case 'qwen-image-2512':
          return 'qwen_image_2512';
        case 'z-image':
          return 'z_image_turbo';
        default:
          // Fallback to wan_2_2_t2i for unknown models
          return 'wan_2_2_t2i';
      }
    })();
    const supportsReferenceParamsModel =
      params.model_name?.startsWith('qwen-image') || params.model_name === 'z-image';
    
    // 4. Generate task ID for orchestrator payload (stored in params, not as DB ID)
    const taskId = generateTaskId(taskType);

    // 5. Build intermediate params before assembling the final object
    const lorasParam = buildLorasParam(
      params.loras,
      supportsReferenceParamsModel && params.in_this_scene && params.in_this_scene_strength
        ? { url: IN_SCENE_LORA_URL, strength: params.in_this_scene_strength }
        : undefined,
    );
    const referenceParams = supportsReferenceParamsModel
      ? buildReferenceParams(params.style_reference_image, params.reference_mode, {
          subjectReferenceImage: params.subject_reference_image,
          styleReferenceStrength: params.style_reference_strength ?? 1.0,
          subjectStrength: params.subject_strength ?? 0.0,
          subjectDescription: params.subject_description,
          inThisScene: params.in_this_scene,
          inThisSceneStrength: params.in_this_scene_strength,
        })
      : {};
    const hiresOverride = buildHiresOverride(
      params.hires_scale,
      params.hires_denoise,
      params.hires_steps,
      params.additional_loras,
      lorasParam.additional_loras,
    );

    // 6. Create task using unified create-task function (let DB auto-generate UUID)
    const taskParamsToSend = {
      task_id: taskId,
      model: params.model_name ?? "optimised-t2i",
      prompt: params.prompt,
      resolution: finalResolution,
      seed: params.seed ?? 11111,
      negative_prompt: params.negative_prompt,
      steps: params.steps ?? 12,
      ...lorasParam,
      ...referenceParams,
      ...(params.shot_id ? { shot_id: params.shot_id } : {}),
      add_in_position: false,
      ...(params.lightning_lora_strength_phase_1 !== undefined && { lightning_lora_strength_phase_1: params.lightning_lora_strength_phase_1 }),
      ...(params.lightning_lora_strength_phase_2 !== undefined && { lightning_lora_strength_phase_2: params.lightning_lora_strength_phase_2 }),
      ...hiresOverride,
    };
    
    const result = await createTask({
      project_id: params.project_id,
      task_type: taskType,
      params: taskParamsToSend
    });
    
    return result;

  } catch (error) {
    handleError(error, { context: 'ImageGeneration', showToast: false });
    throw error;
  }
}

/**
 * Creates multiple image generation tasks in parallel (batch generation)
 * This replaces the enqueueTasks pattern used in ImageGenerationForm
 * 
 * @param params - Batch image generation parameters
 * @returns Promise resolving to array of created tasks
 */
export async function createBatchImageGenerationTasks(params: BatchImageGenerationTaskParams): Promise<TaskCreationResult[]> {

  try {
    // 1. Validate parameters
    validateBatchImageGenerationParams(params);

    // 2. Calculate final resolution once for all tasks (handles Qwen scaling automatically)
    const finalResolution = await calculateTaskResolution({
      projectId: params.project_id,
      customResolution: params.resolution,
      modelName: params.model_name,
      resolution_scale: params.resolution_scale,
      resolution_mode: params.resolution_mode,
      custom_aspect_ratio: params.custom_aspect_ratio,
    });

    // 3. Build reference settings once for all tasks (filtered by reference mode)
    const batchReferenceParams = buildReferenceParams(params.style_reference_image, params.reference_mode, {
      subjectReferenceImage: params.subject_reference_image,
      styleReferenceStrength: params.style_reference_strength,
      subjectStrength: params.subject_strength,
      subjectDescription: params.subject_description,
      inThisScene: params.in_this_scene,
      inThisSceneStrength: params.in_this_scene_strength,
    });

    // 4. Generate individual task parameters for each image
    const taskParams = params.prompts.flatMap((promptEntry) => {
      return Array.from({ length: params.imagesPerPrompt }, () => {
        // Generate a random seed for each task to ensure diverse outputs (32-bit signed integer range)
        const seed = Math.floor(Math.random() * 0x7fffffff);

        return {
          project_id: params.project_id,
          prompt: promptEntry.fullPrompt,
          resolution: finalResolution,
          seed,
          loras: params.loras,
          shot_id: params.shot_id,
          model_name: params.model_name,
          steps: params.steps,
          reference_mode: params.reference_mode,
          ...batchReferenceParams,
          ...(params.hires_scale !== undefined && { hires_scale: params.hires_scale }),
          ...(params.hires_steps !== undefined && { hires_steps: params.hires_steps }),
          ...(params.hires_denoise !== undefined && { hires_denoise: params.hires_denoise }),
          ...(params.lightning_lora_strength_phase_1 !== undefined && { lightning_lora_strength_phase_1: params.lightning_lora_strength_phase_1 }),
          ...(params.lightning_lora_strength_phase_2 !== undefined && { lightning_lora_strength_phase_2: params.lightning_lora_strength_phase_2 }),
          ...(params.additional_loras && { additional_loras: params.additional_loras }),
        } as ImageGenerationTaskParams;
      });
    });

    // 5. Create all tasks in parallel (matching original behavior)
    const results = await Promise.allSettled(
      taskParams.map(taskParam => createImageGenerationTask(taskParam))
    );

    if (import.meta.env.DEV) {
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`[createBatch] task ${i} FAILED:`, r.reason);
        }
      });
    }

    return processBatchResults(results, 'createBatchImageGenerationTasks');

  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[createBatch] outer catch:', error);
    }
    handleError(error, { context: 'BatchImageGeneration', showToast: false });
    throw error;
  }
}

// TaskValidationError is used internally - import from taskCreation.ts if needed externally
