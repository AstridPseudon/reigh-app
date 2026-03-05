import { extractOrchestratorRef } from '../_shared/billing.ts';
import {
  extractAddInPositionParam,
  extractBasedOnParam,
  extractRunIdParam,
  extractShotIdParam,
} from '../../../src/shared/lib/tasks/taskParamContract.ts';

/**
 * Extract orchestrator_task_id from task params
 * Delegates to shared extractOrchestratorRef (single source of truth for path list)
 * and adds logging consistent with other complete_task extractors.
 */
export function extractOrchestratorTaskId(params: unknown, _logTag: string = 'OrchestratorExtract'): string | null {
  const value = extractOrchestratorRef(params);
  return value;
}

/**
 * Extract orchestrator run_id from task params
 * Used for finding sibling segment tasks
 */
export function extractOrchestratorRunId(params: unknown, _logTag: string = 'OrchestratorExtract'): string | null {
  return extractRunIdParam(params);
}

/**
 * Extract based_on from task params
 * Supports multiple param shapes for flexibility across different task types
 */
export function extractBasedOn(params: unknown): string | null {
  return extractBasedOnParam(params);
}

/**
 * Extract shot_id and add_in_position from task params
 * Supports multiple param shapes as per current DB trigger logic
 */
export function extractShotAndPosition(params: unknown): { shotId?: string, addInPosition: boolean } {
  const shotId = extractShotIdParam(params) || undefined;
  const addInPosition = extractAddInPositionParam(params);
  return { shotId, addInPosition };
}
