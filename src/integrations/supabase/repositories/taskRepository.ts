import { getSupabaseClient } from '@/integrations/supabase/client';
import type { Task } from '@/types/tasks';
import { isTaskDbRow, mapTaskDbRowToTask } from '@/shared/lib/taskRowMapper';

export async function fetchTaskInProject(taskId: string, projectId: string): Promise<Task> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .single();

  if (error) {
    throw error;
  }
  if (!isTaskDbRow(data)) {
    throw new Error('Task row has unexpected shape');
  }

  return mapTaskDbRowToTask(data);
}
