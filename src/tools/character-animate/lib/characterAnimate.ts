import {
  createTask,
  ingestProjectInput,
  resolveTaskCapability,
  validateRequiredFields,
  TaskValidationError
} from "@/shared/lib/taskCreation";
import type { RuntimeInput, TaskCreationResult } from "@/shared/lib/taskCreation";
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';

/**
 * Interface for character animate (Wan2.2-Animate) task parameters
 */
export interface CharacterAnimateTaskParams {
  project_id: string;
  character_image_url: string;
  motion_video_url: string;
  /** Uploaded bytes are admitted into Runtime CAS before task creation. */
  character_image?: RuntimeInput;
  motion_video?: RuntimeInput;
  prompt?: string;
  mode: 'replace' | 'animate';
  resolution: '480p' | '720p';
  seed?: number;
  random_seed?: boolean;
}

/**
 * Default values for character animate task settings
 */
const DEFAULT_CHARACTER_ANIMATE_VALUES = {
  mode: 'animate' as const,
  resolution: '480p' as const,
  prompt: 'natural expression; preserve outfit details',
  seed: Math.floor(Math.random() * 1000000),
  random_seed: true,
};

const CHARACTER_ANIMATION_CAPABILITY = 'vibecomfy.character_animation';

function safeInputFilename(locator: string, fallback: string): string {
  const withoutQuery = locator.split(/[?#]/, 1)[0] ?? locator;
  const candidate = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
  let decoded = candidate;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return fallback;
  }
  return decoded.length > 0
    && decoded !== '.'
    && decoded !== '..'
    && !decoded.includes('/')
    && !decoded.includes('\\')
    && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(decoded)
    ? decoded
    : fallback;
}

/**
 * Validates character animate task parameters
 * 
 * @param params - Parameters to validate
 * @throws TaskValidationError if validation fails
 */
function validateCharacterAnimateParams(
  params: CharacterAnimateTaskParams,
): asserts params is CharacterAnimateTaskParams & {
  character_image: RuntimeInput;
  motion_video: RuntimeInput;
} {
  validateRequiredFields(params, [
    'project_id',
    'character_image_url',
    'motion_video_url',
    'character_image',
    'motion_video',
    'mode',
    'resolution'
  ]);

  // Additional validations
  if (!params.character_image_url) {
    throw new TaskValidationError("character_image_url is required", 'character_image_url');
  }

  if (!params.motion_video_url) {
    throw new TaskValidationError("motion_video_url is required", 'motion_video_url');
  }

  if (!isRuntimeInput(params.character_image)) {
    throw new TaskValidationError('character_image bytes are required for Runtime CAS ingest', 'character_image');
  }

  if (!isRuntimeInput(params.motion_video)) {
    throw new TaskValidationError('motion_video bytes are required for Runtime CAS ingest', 'motion_video');
  }

  if (!['replace', 'animate'].includes(params.mode)) {
    throw new TaskValidationError("mode must be 'replace' or 'animate'", 'mode');
  }

  if (!['480p', '720p'].includes(params.resolution)) {
    throw new TaskValidationError("resolution must be '480p' or '720p'", 'resolution');
  }
}

function isRuntimeInput(value: RuntimeInput | undefined): value is RuntimeInput {
  return value instanceof Blob || value instanceof ArrayBuffer || value instanceof Uint8Array;
}

/**
 * Creates a character animate task using the unified approach
 * 
 * @param params - Character animate task parameters
 * @returns Promise resolving to the created task
 */
export async function createCharacterAnimateTask(params: CharacterAnimateTaskParams): Promise<TaskCreationResult> {

  try {
    // 1. Validate parameters
    validateCharacterAnimateParams(params);

    const capability = await resolveTaskCapability(params.project_id, CHARACTER_ANIMATION_CAPABILITY);
    const imageFilename = safeInputFilename(params.character_image_url, 'character-image.png');
    const motionFilename = safeInputFilename(params.motion_video_url, 'driving-video.mp4');
    const image = await ingestProjectInput(params.project_id, params.character_image, {
      originalName: imageFilename,
    });
    const motion = await ingestProjectInput(params.project_id, params.motion_video, {
      originalName: motionFilename,
    });
    const prompt = params.prompt ?? DEFAULT_CHARACTER_ANIMATE_VALUES.prompt;
    const mode = params.mode ?? DEFAULT_CHARACTER_ANIMATE_VALUES.mode;
    const resolution = params.resolution ?? DEFAULT_CHARACTER_ANIMATE_VALUES.resolution;
    const seed = params.random_seed === true
      ? Math.floor(Math.random() * 1000000)
      : params.seed ?? DEFAULT_CHARACTER_ANIMATE_VALUES.seed;

    const result = await createTask({
      project: params.project_id,
      capability_id: CHARACTER_ANIMATION_CAPABILITY,
      capability_digest: capability.definition_digest,
      schema_version: '1',
      input_object_ids: [image.object_id, motion.object_id],
      spec: {
        family: CHARACTER_ANIMATION_CAPABILITY,
        params: {
          reference_image_ref: {
            digest: image.object_id,
            filename: imageFilename,
            media_type: 'image/png',
          },
          driving_video_ref: {
            digest: motion.object_id,
            filename: motionFilename,
            media_type: 'video/mp4',
          },
          mode,
          resolution,
          prompt,
          seed,
        },
        output_policy: {},
      },
      storage_estimate: {
        estimated_scratch_bytes: capability.estimated_scratch_bytes,
        estimated_output_bytes: capability.estimated_output_bytes,
      },
      settlement_effect: {
        effect_type: 'generation.create_with_variant',
        target_id: params.project_id,
        payload: {
          generation_type: 'video',
          metadata: {
            params: {
              tool_type: 'character-animate',
              content_type: 'video',
              prompt,
              mode,
              resolution,
              seed,
            },
          },
          variant_type: 'character_animation',
          output_name: 'animated_video',
          output_ordinal: 0,
          primary_policy: 'preserve',
        },
      },
    });

    return result;

  } catch (error) {
    normalizeAndPresentError(error, { context: 'CharacterAnimate', showToast: false });
    throw error;
  }
}

// TaskValidationError is used internally - import from taskCreation.ts if needed externally
