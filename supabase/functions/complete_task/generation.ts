/**
 * Generation and variant creation for complete_task
 * Handles creating generations, variants, and parent/child relationships
 *
 * This is the main entry point - sub-modules handle specific concerns:
 * - generation-core.ts: Basic CRUD operations
 * - generation-parent.ts: Parent/child relationships
 * - generation-segments.ts: Travel segment logic
 * - generation-variants.ts: Edit/upscale variant handlers
 * - generation-handlers.ts: Params-driven completion handlers
 */

import {
  extractShotAndPosition,
} from './params.ts';

// Import from sub-modules
import {
  findExistingGeneration,
  findSourceGenerationByImageUrl,
  insertGeneration,
  createVariant,
  linkGenerationToShot,
} from './generation-core.ts';

import {
  getOrCreateParentGeneration,
  createVariantOnParent,
  getChildVariantViewedAt,
} from './generation-parent.ts';

import {
  logSegmentMasterState,
  extractSegmentSpecificParams,
} from './generation-segments.ts';

import {
  handleVariantCreation,
} from './generation-variants.ts';

import {
  handleVariantOnParent,
  handleVariantOnChild,
  handleChildGeneration,
  handleStandaloneGeneration,
  type HandlerContext,
} from './generation-handlers.ts';

// Re-export everything for backward compatibility
export {
  // From generation-core.ts
  findExistingGeneration,
  findSourceGenerationByImageUrl,
  insertGeneration,
  createVariant,
  linkGenerationToShot,
  // From generation-parent.ts
  getOrCreateParentGeneration,
  createVariantOnParent,
  getChildVariantViewedAt,
  // From generation-segments.ts
  logSegmentMasterState,
  extractSegmentSpecificParams,
  // From generation-variants.ts
  handleVariantCreation,
  // From generation-handlers.ts
  handleVariantOnParent,
  handleVariantOnChild,
  handleChildGeneration,
  handleStandaloneGeneration,
};

// ===== TOOL TYPE RESOLUTION =====

/**
 * Resolve the final tool_type for a task, considering both default mapping and potential overrides
 */
export async function resolveToolType(
  supabase: any,
  taskType: string,
  taskParams: any
): Promise<{
  toolType: string;
  category: string;
  contentType: 'image' | 'video';
} | null> {
  // Get default tool_type from task_types table
  const { data: taskTypeData, error: taskTypeError } = await supabase
    .from("task_types")
    .select("category, tool_type, content_type")
    .eq("name", taskType)
    .single();

  if (taskTypeError || !taskTypeData) {
    console.error(`[ToolTypeResolver] Failed to fetch task_types metadata for '${taskType}':`, taskTypeError);
    return null;
  }

  let finalToolType = taskTypeData.tool_type;
  const finalContentType = taskTypeData.content_type || 'image';
  const category = taskTypeData.category;

  console.log(`[ToolTypeResolver] Base task_type '${taskType}' has content_type: ${finalContentType}`);

  // Check for tool_type override in params
  const paramsToolType = taskParams?.tool_type;
  if (paramsToolType) {
    console.log(`[ToolTypeResolver] Found tool_type override in params: ${paramsToolType}`);

    // Validate that the override tool_type is a known valid tool type
    const { data: validToolTypes } = await supabase
      .from("task_types")
      .select("tool_type")
      .not("tool_type", "is", null)
      .eq("is_active", true);

    const validToolTypeSet = new Set(validToolTypes?.map((t: any) => t.tool_type) || []);

    if (validToolTypeSet.has(paramsToolType)) {
      console.log(`[ToolTypeResolver] Using tool_type override: ${paramsToolType} (was: ${finalToolType})`);
      finalToolType = paramsToolType;
    } else {
      console.log(`[ToolTypeResolver] Invalid tool_type override '${paramsToolType}', using default: ${finalToolType}`);
    }
  }

  return {
    toolType: finalToolType,
    category,
    contentType: finalContentType
  };
}

// ===== MAIN GENERATION CREATION =====

/**
 * Main function to create generation from completed task
 *
 * PARAMS-DRIVEN ROUTING (no config needed):
 * - child_generation_id present → variant on existing child
 * - parent_generation_id present → child generation under parent
 * - neither → standalone generation
 *
 * Single-item detection: is_single_item param OR (is_first_segment && is_last_segment)
 * Child order: child_order OR segment_index OR join_index
 */
export async function createGenerationFromTask(
  supabase: any,
  taskId: string,
  taskData: any,
  publicUrl: string,
  thumbnailUrl: string | null | undefined,
  logger?: any
): Promise<any> {
  const params = taskData.params || {};

  // Extract routing params from multiple possible locations
  const childGenerationId = params.child_generation_id;
  const parentGenerationId = params.parent_generation_id ||
                             params.orchestrator_details?.parent_generation_id ||
                             params.full_orchestrator_payload?.parent_generation_id;
  const childOrder = params.child_order ?? params.segment_index ?? params.join_index ?? null;
  const isSingleItem = params.is_single_item === true ||
                       (params.is_first_segment === true && params.is_last_segment === true);

  console.log(`[GenMigration] Task ${taskId}: child_generation_id=${childGenerationId || 'none'}, parent_generation_id=${parentGenerationId || 'none'}, child_order=${childOrder}, is_single_item=${isSingleItem}`);
  logger?.debug("Generation routing", {
    task_id: taskId,
    child_generation_id: childGenerationId,
    parent_generation_id: parentGenerationId,
    child_order: childOrder,
    is_single_item: isSingleItem,
  });

  try {
    // 1. Check for regeneration (existing generation for this task)
    const existingGeneration = await findExistingGeneration(supabase, taskId);
    if (existingGeneration) {
      return handleRegeneration(supabase, taskId, taskData, existingGeneration, publicUrl, thumbnailUrl, logger);
    }

    // 2. Build context for handlers
    const ctx: HandlerContext = {
      supabase,
      taskId,
      taskData,
      publicUrl,
      thumbnailUrl: thumbnailUrl || null,
      logger,
      // Extracted params for easy access
      childGenerationId,
      parentGenerationId,
      childOrder,
      isSingleItem,
    };

    // 3. Route based on params
    let result: any = null;

    // VARIANT ON CHILD: regenerating an existing child generation
    if (childGenerationId) {
      console.log(`[GenMigration] VARIANT_ON_CHILD: Task ${taskId} updating child ${childGenerationId}`);
      result = await handleVariantOnChild(ctx);
      if (result) return result;
      // Fall through to child generation if variant failed
    }

    // CHILD GENERATION: creating segment under parent
    if (parentGenerationId) {
      console.log(`[GenMigration] CHILD: Task ${taskId} under parent ${parentGenerationId}`);
      result = await handleChildGeneration(ctx);
      if (result) return result;
      console.log(`[GenMigration] Child creation failed, falling back to standalone`);
    }

    // STANDALONE: no parent/child relationship
    console.log(`[GenMigration] STANDALONE: Task ${taskId}`);
    return handleStandaloneGeneration(ctx);

  } catch (error) {
    console.error(`[GenMigration] Error creating generation for task ${taskId}:`, error);
    logger?.error("Error creating generation", {
      task_id: taskId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Handle regeneration case - task already has a generation, create new variant
 */
async function handleRegeneration(
  supabase: any,
  taskId: string,
  taskData: any,
  existingGeneration: any,
  publicUrl: string,
  thumbnailUrl: string | null | undefined,
  logger?: any
): Promise<any> {
  console.log(`[GenMigration] Generation already exists for task ${taskId}: ${existingGeneration.id}`);
  console.log(`[GenMigration] Creating new variant and making it primary`);
  logger?.info("Existing generation found - creating regenerated variant", {
    task_id: taskId,
    existing_generation_id: existingGeneration.id,
    action: "create_regenerated_variant"
  });

  const variantParams = {
    ...taskData.params,
    source_task_id: taskId,
    created_from: 'task_completion',
    tool_type: taskData.tool_type,
  };

  await createVariant(
    supabase,
    existingGeneration.id,
    publicUrl,
    thumbnailUrl || null,
    variantParams,
    true,
    'regenerated',
    null
  );

  console.log(`[GenMigration] Successfully created regenerated variant for generation ${existingGeneration.id}`);

  const { shotId, addInPosition } = extractShotAndPosition(taskData.params);
  if (shotId) {
    await linkGenerationToShot(supabase, shotId, existingGeneration.id, addInPosition);
  }

  await supabase
    .from('tasks')
    .update({ generation_created: true })
    .eq('id', taskId);

  return existingGeneration;
}
