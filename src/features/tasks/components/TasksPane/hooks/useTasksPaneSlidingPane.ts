import { useSlidingPane } from '@/shared/hooks/useSlidingPane';

interface UseTasksPaneSlidingPaneInput {
  isTasksPaneLocked: boolean;
  setIsTasksPaneLocked: (isLocked: boolean) => void;
  isTasksPaneOpenProgrammatic: boolean;
  setIsTasksPaneOpenProgrammatic: (isOpen: boolean) => void;
}

export function useTasksPaneSlidingPane(input: UseTasksPaneSlidingPaneInput) {
  const {
    isTasksPaneLocked,
    setIsTasksPaneLocked,
    isTasksPaneOpenProgrammatic,
    setIsTasksPaneOpenProgrammatic,
  } = input;

  return useSlidingPane({
    side: 'right',
    isLocked: isTasksPaneLocked,
    onToggleLock: () => {
      setIsTasksPaneLocked(!isTasksPaneLocked);
    },
    programmaticOpen: isTasksPaneOpenProgrammatic,
    onOpenChange: (open) => {
      if (!open && isTasksPaneOpenProgrammatic) {
        setIsTasksPaneOpenProgrammatic(false);
      }
    },
  });
}
