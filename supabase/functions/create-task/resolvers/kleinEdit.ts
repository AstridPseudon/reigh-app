import type { ResolverResult, TaskFamilyResolver, TaskInsertObject } from "./types.ts";
import {
  setTaskLineageFields,
  type TimelinePlacement,
} from "./shared/lineage.ts";
import type { PlacementIntent } from "../../ai-timeline-agent/types.ts";
import { resolveSeed32Bit, validateSeed32Bit } from "./shared/seed.ts";
import {
  TaskValidationError,
  validateNonEmptyString,
  validateRequiredFields,
  validateUrlString,
} from "./shared/validation.ts";

interface KleinEditTaskInput {
  prompt: string;
  image_url: string;
  klein_model: "flux-klein-4b" | "flux-klein-9b";
  negative_prompt?: string;
  seed?: number;
  strength?: number;
  num_inference_steps?: number;
  output_format?: string;
  shot_id?: string;
  tool_type?: string;
  based_on?: string;
  source_variant_id?: string;
  create_as_generation?: boolean;
  numImages?: number;
  timeline_placement?: TimelinePlacement;
  placement_intent?: PlacementIntent;
}

function buildQueuedTask(
  projectId: string,
  taskType: string,
  params: Record<string, unknown>,
): TaskInsertObject {
  return {
    project_id: projectId,
    task_type: taskType,
    params,
    status: "Queued",
    created_at: new Date().toISOString(),
    dependant_on: null,
  };
}

function validateKleinEditInput(input: KleinEditTaskInput): void {
  validateRequiredFields(input, ["prompt", "image_url", "klein_model"]);
  validateNonEmptyString(input.prompt, "prompt", "Prompt");
  validateNonEmptyString(input.image_url, "image_url", "Image URL");
  validateUrlString(input.image_url, "image_url", "Image URL");
  validateSeed32Bit(input.seed);

  if (!["flux-klein-4b", "flux-klein-9b"].includes(input.klein_model)) {
    throw new TaskValidationError("klein_model must be 'flux-klein-4b' or 'flux-klein-9b'", "klein_model");
  }

  const numImages = input.numImages ?? 1;
  if (numImages < 1 || numImages > 4) {
    throw new TaskValidationError("Number of images must be between 1 and 4", "numImages");
  }
}

function buildKleinEditTaskParams(
  input: KleinEditTaskInput,
  seed: number,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    seed,
    image: input.image_url,
    prompt: input.prompt,
    klein_model: input.klein_model,
    strength: input.strength ?? 0.6,
    num_inference_steps: input.num_inference_steps ?? 8,
    output_format: input.output_format ?? "png",
  };

  if (input.negative_prompt) {
    params.negative_prompt = input.negative_prompt;
  }

  setTaskLineageFields(params, {
    shotId: input.shot_id,
    basedOn: input.based_on,
    sourceVariantId: input.source_variant_id,
    createAsGeneration: input.create_as_generation,
    toolType: input.tool_type,
    timelinePlacement: input.timeline_placement,
    placementIntent: input.placement_intent,
  });

  return params;
}

export const kleinEditResolver: TaskFamilyResolver = (request, context): ResolverResult => {
  const input = request.input as unknown as KleinEditTaskInput;
  validateKleinEditInput(input);

  const taskCount = input.numImages ?? 1;
  const baseSeed = resolveSeed32Bit({ seed: input.seed, field: "seed" });

  return {
    tasks: Array.from({ length: taskCount }, (_, index) =>
      buildQueuedTask(
        context.projectId,
        "flux_klein_edit",
        buildKleinEditTaskParams(input, baseSeed + index),
      )),
  };
};
