import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { getVisibleTaskTypes } from '@/shared/lib/taskConfig';
import { useSmartPollingConfig } from '@/shared/hooks/useSmartPolling';
import { QUERY_PRESETS, STANDARD_RETRY, STANDARD_RETRY_DELAY } from '@/shared/lib/queryDefaults';
import { taskQueryKeys } from '@/shared/lib/queryKeys/tasks';
import { dataFreshnessManager } from '@/shared/realtime/DataFreshnessManager';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import {
  TASK_FAILURE_STATUSES,
  TASK_PROCESSING_STATUSES,
} from '@/shared/lib/tasks/taskStatusSemantics';
import { applyRootTaskFilter } from '@/shared/lib/tasks/orchestratorReference';
import {
  operationFailure,
  operationSuccess,
  type OperationResult,
} from '@/shared/lib/operationResult';

type TaskStatusCountsQuery = 'processing' | 'success' | 'failure';

interface TaskStatusCountsResult {
  processing: number;
  recentSuccesses: number;
  recentFailures: number;
  degraded: boolean;
  failedQueries: TaskStatusCountsQuery[];
  errorCode?: 'task_status_counts_partial_failure';
  operation: OperationResult<{
    processing: number;
    recentSuccesses: number;
    recentFailures: number;
  }>;
}

function buildEmptyTaskStatusCountsResult(): TaskStatusCountsResult {
  const zeroCounts = {
    processing: 0,
    recentSuccesses: 0,
    recentFailures: 0,
  };

  return {
    ...zeroCounts,
    degraded: false,
    failedQueries: [],
    operation: operationSuccess(zeroCounts, { policy: 'best_effort' }),
  };
}

function resolveSettledCountResult(
  projectId: string,
  result: PromiseSettledResult<{ count: number | null; error: unknown }>,
  queryType: TaskStatusCountsQuery,
): { count: number; failed: boolean } {
  if (result.status === 'fulfilled') {
    const { count, error } = result.value;
    if (error) {
      normalizeAndPresentError(error, {
        context: `useTaskStatusCounts.${queryType}`,
        showToast: false,
        logData: { projectId },
      });
      return { count: 0, failed: true };
    }
    return { count: count || 0, failed: false };
  }

  normalizeAndPresentError(
    result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
    {
      context: `useTaskStatusCounts.${queryType}`,
      showToast: false,
      logData: { projectId },
    },
  );
  return { count: 0, failed: true };
}

function buildTaskStatusCountsResult(
  projectId: string,
  counts: { processing: number; success: number; failure: number },
  failedQueries: TaskStatusCountsQuery[],
): TaskStatusCountsResult {
  return {
    processing: counts.processing,
    recentSuccesses: counts.success,
    recentFailures: counts.failure,
    degraded: failedQueries.length > 0,
    failedQueries,
    ...(failedQueries.length > 0
      ? { errorCode: 'task_status_counts_partial_failure' as const }
      : {}),
    operation:
      failedQueries.length > 0
        ? operationFailure(new Error('Task status counts query partially failed'), {
            errorCode: 'task_status_counts_partial_failure',
            policy: 'degrade',
            recoverable: true,
            message: `Partial task status count failure (${failedQueries.join(', ')})`,
            cause: { failedQueries, projectId },
          })
        : operationSuccess(
            {
              processing: counts.processing,
              recentSuccesses: counts.success,
              recentFailures: counts.failure,
            },
            { policy: 'best_effort' },
          ),
  };
}

function trackTaskStatusCountsFreshness(
  projectId: string,
  failedQueries: TaskStatusCountsQuery[],
  settledResults: [
    PromiseSettledResult<{ count: number | null; error: unknown }>,
    PromiseSettledResult<{ count: number | null; error: unknown }>,
    PromiseSettledResult<{ count: number | null; error: unknown }>,
  ],
): void {
  if (failedQueries.length === 0) {
    dataFreshnessManager.onFetchSuccess(taskQueryKeys.statusCounts(projectId));
    return;
  }

  const [processingResult, successResult, failureResult] = settledResults;
  const errorReason =
    processingResult.status === 'rejected'
      ? processingResult.reason
      : successResult.status === 'rejected'
        ? successResult.reason
        : failureResult.status === 'rejected'
          ? failureResult.reason
          : new Error('Query returned error');

  dataFreshnessManager.onFetchFailure(
    taskQueryKeys.statusCounts(projectId),
    errorReason as Error,
  );
}

async function fetchTaskStatusCounts(projectId: string | null): Promise<TaskStatusCountsResult> {
  if (!projectId) {
    return buildEmptyTaskStatusCountsResult();
  }

  const visibleTaskTypes = getVisibleTaskTypes();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const supabase = getSupabaseClient();

  const settledResults = await Promise.allSettled([
    applyRootTaskFilter(
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .in('status', [...TASK_PROCESSING_STATUSES])
        .in('task_type', visibleTaskTypes),
    ),
    applyRootTaskFilter(
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('status', 'Complete')
        .gte('generation_processed_at', oneHourAgo)
        .in('task_type', visibleTaskTypes),
    ),
    applyRootTaskFilter(
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .in('status', [...TASK_FAILURE_STATUSES])
        .gte('updated_at', oneHourAgo)
        .in('task_type', visibleTaskTypes),
    ),
  ]) as [
    PromiseSettledResult<{ count: number | null; error: unknown }>,
    PromiseSettledResult<{ count: number | null; error: unknown }>,
    PromiseSettledResult<{ count: number | null; error: unknown }>,
  ];

  const failedQueries: TaskStatusCountsQuery[] = [];
  const processing = resolveSettledCountResult(projectId, settledResults[0], 'processing');
  if (processing.failed) failedQueries.push('processing');

  const success = resolveSettledCountResult(projectId, settledResults[1], 'success');
  if (success.failed) failedQueries.push('success');

  const failure = resolveSettledCountResult(projectId, settledResults[2], 'failure');
  if (failure.failed) failedQueries.push('failure');

  trackTaskStatusCountsFreshness(projectId, failedQueries, settledResults);

  return buildTaskStatusCountsResult(
    projectId,
    {
      processing: processing.count,
      success: success.count,
      failure: failure.count,
    },
    failedQueries,
  );
}

// Hook to get status counts for indicators
export const useTaskStatusCounts = (projectId: string | null) => {
  const cacheProjectId = projectId ?? '__no-project__';
  const smartPollingConfig = useSmartPollingConfig(taskQueryKeys.statusCounts(cacheProjectId));

  return useQuery({
    queryKey: taskQueryKeys.statusCounts(cacheProjectId),
    queryFn: () => fetchTaskStatusCounts(projectId),
    enabled: !!projectId,
    ...smartPollingConfig,
    refetchIntervalInBackground: true,
    retry: STANDARD_RETRY,
    retryDelay: STANDARD_RETRY_DELAY,
  });
};

/**
 * Hook to get all visible task types from the config
 * Simply returns the allowlist from taskConfig - no database query needed
 */
export const useAllTaskTypes = (_projectId: string | null) => {
  return useQuery({
    queryKey: taskQueryKeys.allTypes,
    queryFn: () => {
      const visibleTypes = getVisibleTaskTypes();
      return visibleTypes;
    },
    ...QUERY_PRESETS.immutable,
    gcTime: Infinity,
  });
};
