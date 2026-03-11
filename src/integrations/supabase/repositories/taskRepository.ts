import { getSupabaseClient } from '@/integrations/supabase/client';
import type { Task } from '@/types/tasks';
import { isTaskDbRow, mapTaskDbRowToTask } from '@/shared/lib/taskRowMapper';
import {
  createInvalidRowShapeError,
  createRepositoryQueryError,
  isRepositoryNoRowsError,
} from './repositoryErrors';

export async function fetchTaskInProject(taskId: string, projectId: string): Promise<Task | null> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) {
    if (isRepositoryNoRowsError(error)) {
      return null;
    }
    throw createRepositoryQueryError('task', error, { taskId, projectId });
  }
  if (!data) {
    return null;
  }
  if (!isTaskDbRow(data)) {
    throw createInvalidRowShapeError('task', { taskId, projectId });
  }

  return mapTaskDbRowToTask(data);
}
