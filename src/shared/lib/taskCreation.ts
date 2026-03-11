export type {
  BaseTaskParams,
  HiresFixApiParams,
  TaskCreationResult,
} from './taskCreation/types';

export {
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

export {
  resolveSeed32Bit,
  validateLoraConfigs,
  validateNonEmptyString,
  validateNumericRange,
  validateSeed32Bit,
  validateUrlString,
  mapPathLorasToStrengthRecord,
} from './taskCreation/schemaUtils';

export {
  setTaskLineageFields,
} from './taskCreation/payloadFields';
