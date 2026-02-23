/**
 * Backward-compatible barrel for task-creation utilities.
 *
 * The implementation has been decomposed into focused modules under
 * `shared/lib/taskCreation/` to improve cohesion while preserving the
 * existing import path (`@/shared/lib/taskCreation`).
 */

export type {
  BaseTaskParams,
  HiresFixApiParams,
  ProjectResolutionResult,
  TaskCreationResult,
} from './taskCreation/types';

export {
  DEFAULT_ASPECT_RATIO,
  TaskValidationError,
} from './taskCreation/types';

export {
  resolveProjectResolution,
} from './taskCreation/resolution';

export {
  generateUUID,
  generateTaskId,
  generateRunId,
} from './taskCreation/ids';

export {
  createTask,
} from './taskCreation/createTask';

export {
  expandArrayToCount,
} from './taskCreation/arrayUtils';

export {
  validateRequiredFields,
  safeParseJson,
} from './taskCreation/validation';

export {
  buildHiresFixParams,
} from './taskCreation/hiresFix';

export {
  processBatchResults,
} from './taskCreation/batchResults';
