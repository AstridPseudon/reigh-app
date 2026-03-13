// Deprecated compatibility shim. Canonical ownership lives in features/projects/services.
export {
  copyOnboardingTemplateToProject,
  createDefaultShotRecord,
  createUserRecordIfMissing,
  deleteProjectForUser,
  hasUserRecord,
} from '@/features/projects/services/projectSetupRepository';
