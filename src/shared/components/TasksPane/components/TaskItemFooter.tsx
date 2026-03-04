import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { taskSupportsProgress } from '@/shared/lib/taskConfig';
import { Task } from '@/types/tasks';

interface TaskItemFooterProps {
  task: Task;
  createdTimeAgo: string | null;
  processingTime: string | null;
  completedTime: string | null;
  variantName: string | undefined;
  progressPercent: number | null;
  onCheckProgress: () => void;
  onCancel: () => void;
  isCancelling: boolean;
}

export const TaskItemFooter: React.FC<TaskItemFooterProps> = ({
  task,
  createdTimeAgo,
  processingTime,
  completedTime,
  variantName,
  progressPercent,
  onCheckProgress,
  onCancel,
  isCancelling,
}) => {
  return (
    <div className="flex items-center text-[11px] text-zinc-400">
      <span className="flex-1">
        {task.status === 'In Progress' && processingTime
          ? processingTime
          : task.status === 'Complete' && completedTime
            ? completedTime
            : `Created ${createdTimeAgo ?? 'Unknown'}`}
      </span>

      {variantName && (
        <span className="ml-2 px-1.5 py-0.5 bg-black/50 text-white text-[10px] rounded-md flex-shrink-0 preserve-case">
          {variantName}
        </span>
      )}

      {(task.status === 'Queued' || task.status === 'In Progress') && (
        <div className="flex items-center flex-shrink-0">
          {taskSupportsProgress(task.taskType) && task.status === 'In Progress' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCheckProgress}
              disabled={progressPercent !== null}
              className="px-2 py-1 min-w-[80px] h-auto text-blue-400 hover:bg-blue-900/20 hover:text-blue-300 flex flex-col items-center justify-center"
            >
              <div className="text-xs leading-tight">
                {progressPercent === null ? (
                  <>
                    <div>Check</div>
                    <div>Progress</div>
                  </>
                ) : (
                  <>
                    <div>{progressPercent}%</div>
                    <div>Complete</div>
                  </>
                )}
              </div>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isCancelling}
            className="px-2 py-0.5 text-red-400 hover:bg-red-900/20 hover:text-red-300"
          >
            {isCancelling ? 'Cancelling...' : 'Cancel'}
          </Button>
        </div>
      )}
    </div>
  );
};
