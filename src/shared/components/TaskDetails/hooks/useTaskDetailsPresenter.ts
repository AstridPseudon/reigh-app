import { useCallback, useState } from 'react';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { usePublicLoras } from '@/shared/hooks/useResources';
import { Task } from '@/types/tasks';

interface UseTaskDetailsPresenterArgs {
  task: Task | null;
  errorContext: 'TaskDetailsModal' | 'TaskDetailsPanel';
}

export function useTaskDetailsPresenter({
  task,
  errorContext,
}: UseTaskDetailsPresenterArgs) {
  const [showDetailedParams, setShowDetailedParams] = useState(false);
  const [showAllImages, setShowAllImages] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [showFullNegativePrompt, setShowFullNegativePrompt] = useState(false);
  const [paramsCopied, setParamsCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const { data: availableLoras } = usePublicLoras();

  const handleCopyParams = useCallback(async () => {
    if (!task?.params) {
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(task.params, null, 2));
      setParamsCopied(true);
      setTimeout(() => setParamsCopied(false), 2000);
    } catch (err) {
      normalizeAndPresentError(err, { context: errorContext, showToast: false });
    }
  }, [errorContext, task?.params]);

  const handleCopyId = useCallback((taskId: string | null) => {
    if (!taskId) {
      return;
    }
    navigator.clipboard.writeText(taskId);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 2000);
  }, []);

  return {
    availableLoras,
    showDetailedParams,
    setShowDetailedParams,
    showAllImages,
    setShowAllImages,
    showFullPrompt,
    setShowFullPrompt,
    showFullNegativePrompt,
    setShowFullNegativePrompt,
    paramsCopied,
    idCopied,
    handleCopyParams,
    handleCopyId,
  };
}
