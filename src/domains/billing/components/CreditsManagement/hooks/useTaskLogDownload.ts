import { useState, useCallback } from 'react';
import { getTaskDisplayName } from '@/shared/lib/tasks/taskConfig';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { fetchTaskLogData } from '@/shared/hooks/tasks/taskLogPipeline';
import type { TaskLogFilters } from '../types';

interface UseTaskLogDownloadReturn {
  isDownloading: boolean;
  handleDownload: () => Promise<void>;
}
export function useTaskLogDownload(filters: TaskLogFilters): UseTaskLogDownloadReturn {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const { tasks } = await fetchTaskLogData({ filters });
      if (tasks.length === 0) {
        return;
      }
      const rows = tasks.map((task) => ({
        id: task.id,
        date: new Date(task.createdAt).toLocaleDateString(),
        taskType: getTaskDisplayName(task.taskType),
        project: task.projectName || 'Unknown Project',
        status: task.status,
        duration: task.duration ? `${task.duration}s` : '',
        cost: task.cost ? `$${task.cost.toFixed(3)}` : 'Free',
      }));

      // Convert to CSV
      const headers = ['ID', 'Date', 'Task Type', 'Project', 'Status', 'Duration', 'Cost'];
      const csvContent = [
        headers.join(','),
        ...rows.map(task => [
          task.id,
          task.date,
          `"${task.taskType}"`,
          `"${task.project}"`,
          task.status,
          task.duration,
          task.cost
        ].join(','))
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `task-log-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      normalizeAndPresentError(error, { context: 'useTaskLogDownload', showToast: false });
    } finally {
      setIsDownloading(false);
    }
  }, [filters]);

  return {
    isDownloading,
    handleDownload,
  };
}
