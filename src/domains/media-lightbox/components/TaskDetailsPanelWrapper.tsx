import React from 'react';
import { TaskDetailsPanel } from '@/shared/components/TaskDetails/TaskDetailsPanel';
import { GenerationDetails } from '@/domains/generation/components/GenerationDetails';
import type { TaskDetailsData } from '../types';

interface TaskDetailsPanelWrapperProps {
  taskDetailsData?: TaskDetailsData;
  replaceImages: boolean;
  onReplaceImagesChange: (replace: boolean) => void;
  onClose: () => void;
}

/**
 * TaskDetailsPanelWrapper Component
 * Wraps TaskDetailsPanel with all the standard props wiring
 * Includes the derived generations section
 */
export const TaskDetailsPanelWrapper: React.FC<TaskDetailsPanelWrapperProps> = ({
  taskDetailsData,
  replaceImages,
  onReplaceImagesChange,
  onClose,
}) => {
  return (
    <TaskDetailsPanel
      task={taskDetailsData?.task ?? null}
      isLoading={taskDetailsData?.isLoading || false}
      status={taskDetailsData?.status}
      error={taskDetailsData?.error ?? null}
      inputImages={taskDetailsData?.inputImages || []}
      taskId={taskDetailsData?.taskId || null}
      replaceImages={replaceImages}
      onReplaceImagesChange={onReplaceImagesChange}
      onApplySettingsFromTask={taskDetailsData?.onApplySettingsFromTask ? (taskId, replaceImages, inputImages) => {
        taskDetailsData.onApplySettingsFromTask?.(taskId, replaceImages, inputImages);
        onClose(); // Close lightbox after applying settings
      } : undefined}
      className=""
      showUserImage={false}
      derivedSection={null}
      hideHeader={true}
      renderGenerationDetails={(props) => (
        <GenerationDetails {...props} />
      )}
    />
  );
};
