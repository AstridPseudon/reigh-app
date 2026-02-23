import { ServerError } from '@/shared/lib/errorHandling/errors';
import type { TaskCreationResult } from './types';

interface TaskCreationContext {
  requestId: string;
  taskType: string;
  projectId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseTaskCreationResponse(
  payload: unknown,
  context: TaskCreationContext,
): TaskCreationResult {
  if (!isRecord(payload)) {
    throw new ServerError('Task creation returned an invalid response', {
      context,
    });
  }

  const taskId = typeof payload.task_id === 'string' ? payload.task_id.trim() : '';
  if (!taskId) {
    const inlineError = typeof payload.error === 'string' ? payload.error.trim() : '';
    throw new ServerError(inlineError || 'Task creation failed before returning a task id', {
      context: {
        ...context,
        responseStatus: typeof payload.status === 'string' ? payload.status : 'unknown',
      },
    });
  }

  const status = typeof payload.status === 'string' && payload.status.trim().length > 0
    ? payload.status
    : 'pending';

  return {
    task_id: taskId,
    status,
  };
}
