/**
 * Task ID resolution helpers
 *
 * Centralizes the logic for extracting task IDs from variant params,
 * handling legacy field names consistently.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extract the source task ID from variant params.
 *
 * Variants can have their source task ID stored under different field names
 * due to historical evolution of the param structure:
 * - `source_task_id` - Current standard (preferred)
 * - `orchestrator_task_id` - Used by orchestrator child segments
 * - `task_id` - Legacy fallback
 *
 * @param params - Variant params object (typically from variant.params)
 * @returns Valid UUID task ID, or null if not found/invalid
 */
export function getSourceTaskId(
  params: Record<string, unknown> | null | undefined
): string | null {
  if (!params) return null;

  // Try field names in priority order
  const taskId =
    params.source_task_id ||
    params.orchestrator_task_id ||
    params.task_id ||
    null;

  // Validate it's a UUID (some params have non-UUID identifiers)
  if (typeof taskId === 'string' && UUID_REGEX.test(taskId)) {
    return taskId;
  }

  return null;
}

/**
 * Check if params contain orchestrator details.
 * Used to determine if variant already has full task context.
 */
export function hasOrchestratorDetails(
  params: Record<string, unknown> | null | undefined
): boolean {
  return !!params?.orchestrator_details;
}
