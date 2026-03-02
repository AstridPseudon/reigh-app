import { getSupabaseClient } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export async function rpcCopyOnboardingTemplate(targetProjectId: string, targetShotId: string) {
  return getSupabaseClient().rpc('copy_onboarding_template', {
    target_project_id: targetProjectId,
    target_shot_id: targetShotId,
  });
}

export async function deleteProjectByIdForUser(projectId: string, userId: string) {
  return getSupabaseClient().from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId);
}

export async function insertDefaultShotForProject(
  projectId: string,
  name: string,
  settings: Record<string, Json | undefined>,
) {
  return getSupabaseClient().from('shots')
    .insert({
      name,
      project_id: projectId,
      settings,
    })
    .select('id')
    .single();
}

export async function fetchUserById(userId: string) {
  return getSupabaseClient().from('users')
    .select('id')
    .eq('id', userId)
    .single();
}

export async function rpcCreateUserRecordIfNotExists() {
  return getSupabaseClient().rpc('create_user_record_if_not_exists');
}
