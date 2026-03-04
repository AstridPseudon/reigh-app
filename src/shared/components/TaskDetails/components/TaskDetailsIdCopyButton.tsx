import React from 'react';

interface TaskDetailsIdCopyButtonProps {
  taskId: string | null;
  idCopied: boolean;
  onCopyId: (taskId: string | null) => void;
}

export const TaskDetailsIdCopyButton: React.FC<TaskDetailsIdCopyButtonProps> = ({
  taskId,
  idCopied,
  onCopyId,
}) => {
  if (!taskId) {
    return null;
  }

  return (
    <button
      onClick={() => onCopyId(taskId)}
      className={`px-2 py-1 text-xs rounded transition-colors ${
        idCopied
          ? 'text-green-400'
          : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700'
      }`}
    >
      {idCopied ? 'copied' : 'id'}
    </button>
  );
};
