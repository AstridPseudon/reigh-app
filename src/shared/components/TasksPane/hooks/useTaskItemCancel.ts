import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/components/ui/toast';
import { useCancelTask } from '@/shared/hooks/tasks/useTaskCancellation';
import { taskQueryKeys } from '@/shared/lib/queryKeys/tasks';
import { Task } from '@/types/tasks';

interface UseTaskItemCancelArgs {
  selectedProjectId: string | null;
  taskId: string;
}

export function useTaskItemCancel({ selectedProjectId, taskId }: UseTaskItemCancelArgs) {
  const queryClient = useQueryClient();
  const cancelTaskMutation = useCancelTask(selectedProjectId);

  const handleCancel = useCallback(() => {
    const queryKey = taskQueryKeys.paginated(selectedProjectId!);
    const previousData = queryClient.getQueryData(queryKey);

    queryClient.setQueriesData(
      { queryKey },
      (oldData: { tasks?: Task[]; total?: number } | undefined) => {
        if (!oldData?.tasks) {
          return oldData;
        }
        return {
          ...oldData,
          tasks: oldData.tasks.map((existingTask: Task) => (
            existingTask.id === taskId
              ? { ...existingTask, status: 'Cancelled' as const }
              : existingTask
          )),
        };
      },
    );

    cancelTaskMutation.mutate(taskId, {
      onError: (error) => {
        queryClient.setQueryData(queryKey, previousData);
        toast({
          title: 'Cancellation Failed',
          description: error.message || 'Could not cancel the task.',
          variant: 'destructive',
        });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
      },
    });
  }, [cancelTaskMutation, queryClient, selectedProjectId, taskId]);

  return { cancelTaskMutation, handleCancel };
}
