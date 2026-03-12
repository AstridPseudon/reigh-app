import { useQuery } from '@tanstack/react-query';
import { taskQueryKeys } from '@/shared/lib/queryKeys/tasks';
import {
  fetchTaskLogDataOrThrow,
  type EnrichedTaskLogTask,
  type TaskLogAvailableFilters,
  type TaskLogFilters,
} from './taskLogPipeline';

interface TaskLogResponse {
  tasks: EnrichedTaskLogTask[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
    totalPages: number;
    currentPage: number;
  };
  availableFilters: TaskLogAvailableFilters;
}

export function useTaskLog(
  limit: number = 20, 
  page: number = 1, 
  filters: TaskLogFilters = {}
) {
  const offset = (page - 1) * limit;
  
  return useQuery<TaskLogResponse, Error>({
    queryKey: taskQueryKeys.log(limit, page, filters),
    placeholderData: (previousData) => previousData, // Prevents table from disappearing during filter changes
    queryFn: async () => {
      const { availableFilters, tasks, total } = await fetchTaskLogDataOrThrow({
        filters,
        limit,
        offset,
      });
      const totalPages = Math.ceil(total / limit);
      const hasMore = page < totalPages;

      return {
        tasks,
        pagination: {
          limit,
          offset,
          total,
          hasMore,
          totalPages,
          currentPage: page,
        },
        availableFilters
      };
    },
  });
} 
