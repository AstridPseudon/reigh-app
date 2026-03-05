import type { Json } from '@/integrations/supabase/jsonTypes';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import {
  deleteProjectByIdForUser,
  fetchUserById,
  insertDefaultShotForProject,
  rpcCopyOnboardingTemplate,
  rpcCreateUserRecordIfNotExists,
} from '@/shared/services/projects/projectSetupRepository';

async function copyTemplateToNewUser(newProjectId: string, newShotId: string): Promise<void> {
  const { error } = await rpcCopyOnboardingTemplate(newProjectId, newShotId);

  if (error) {
    throw error;
  }
}

export async function cleanupFailedProjectSetup(projectId: string, userId: string): Promise<void> {
  const { error } = await deleteProjectByIdForUser(projectId, userId);

  if (error) {
    normalizeAndPresentError(error, {
      context: 'projectSetupService.cleanupFailedProjectSetup',
      showToast: false,
    });
  }
}

export async function createDefaultShotForProject(
  projectId: string,
  options?: {
    initialSettings?: Record<string, Json | undefined>;
    isFirstProject?: boolean;
  },
): Promise<string> {
  const isFirstProject = options?.isFirstProject === true;
  const shotName = isFirstProject ? 'Getting Started' : 'Default Shot';

  const { data: shot, error } = await insertDefaultShotForProject(
    projectId,
    shotName,
    options?.initialSettings || {},
  );

  if (error) {
    throw error;
  }
  if (!shot?.id) {
    throw new Error('Default shot creation returned no shot id');
  }

  if (isFirstProject) {
    await copyTemplateToNewUser(projectId, shot.id);
  }

  return shot.id;
}

export async function ensureUserRecordExists(userId: string): Promise<void> {
  const { data: existingUser } = await fetchUserById(userId);

  if (!existingUser) {
    const { error: userError } = await rpcCreateUserRecordIfNotExists();
    if (userError) {
      normalizeAndPresentError(userError, {
        context: 'projectSetupService.ensureUserRecordExists',
        showToast: false,
      });
    }
  }
}

export async function createDefaultShotWithRollback(
  projectId: string,
  userId: string,
  options?: {
    initialSettings?: Record<string, Json | undefined>;
    isFirstProject?: boolean;
  },
): Promise<void> {
  try {
    await createDefaultShotForProject(projectId, options);
  } catch (setupError) {
    await cleanupFailedProjectSetup(projectId, userId);
    throw setupError;
  }
}
