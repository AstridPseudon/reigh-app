import React, { useMemo } from 'react';
import { FilterGroup } from '../constants';
import { TaskItemSkeleton } from './TaskItemSkeleton';

interface TaskListSkeletonProps {
  activeFilter: FilterGroup;
  count?: number;
}

function resolveSkeletonVariant(activeFilter: FilterGroup): 'processing' | 'complete' | 'failed' {
  switch (activeFilter) {
    case 'Succeeded':
      return 'complete';
    case 'Failed':
      return 'failed';
    case 'Processing':
    default:
      return 'processing';
  }
}

export const TaskListSkeleton: React.FC<TaskListSkeletonProps> = React.memo(({
  activeFilter,
  count,
}) => {
  const skeletonCount = count !== undefined ? Math.min(count, 4) : 4;
  const variant = resolveSkeletonVariant(activeFilter);
  const skeletonItems = useMemo(
    () => Array.from({ length: skeletonCount }, (_, i) => ({
      variant,
      showImages: i % 2 === 0,
      showPrompt: i % 2 === 1,
    })),
    [skeletonCount, variant],
  );

  return (
    <div className="space-y-1">
      {skeletonItems.map((config, idx) => (
        <React.Fragment key={idx}>
          <TaskItemSkeleton {...config} />
          {idx < skeletonItems.length - 1 && <div className="h-0 border-b border-zinc-700/40 my-1" />}
        </React.Fragment>
      ))}
    </div>
  );
});
