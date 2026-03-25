import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUserUIState } from '@/shared/hooks/useUserUIState';
import { useIsMobile, useIsTablet } from '@/shared/hooks/mobile';

type PaneLockKey = 'shots' | 'tasks' | 'gens' | 'editor';

interface PaneLocksState {
  shots: boolean;
  tasks: boolean;
  gens: boolean;
  editor: boolean;
}

const UNLOCKED_PANES: PaneLocksState = {
  shots: false,
  tasks: false,
  gens: false,
  editor: false,
};

export function usePaneLockPolicyState() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isSmallMobile = isMobile && !isTablet;

  const { value: paneLocks, update: savePaneLocks, isLoading } = useUserUIState('paneLocks', UNLOCKED_PANES);
  const [locks, setLocks] = useState(paneLocks);

  const [isGenerationsPaneOpenState, setIsGenerationsPaneOpenState] = useState(false);
  const [isEditorPaneOpenState, setIsEditorPaneOpenState] = useState(false);
  const [isTasksPaneOpenState, setIsTasksPaneOpenState] = useState(false);

  useEffect(() => {
    if (isSmallMobile) {
      setLocks(UNLOCKED_PANES);
      return;
    }

    if (!isLoading) {
      let newLocks = paneLocks;
      if (isTablet) {
        const activeLocks = Object.entries(paneLocks).filter(([_, locked]) => locked);
        if (activeLocks.length > 1) {
          const firstLocked = activeLocks[0][0] as PaneLockKey;
          newLocks = {
            shots: firstLocked === 'shots',
            tasks: firstLocked === 'tasks',
            gens: firstLocked === 'gens',
            editor: firstLocked === 'editor',
          };
        }
      }
      setLocks(newLocks);
      setIsTasksPaneOpenState(newLocks.tasks);
    }
  }, [isLoading, paneLocks, isSmallMobile, isTablet]);

  const createPaneLockSetter = useCallback(
    (lockKey: PaneLockKey) => (isLocked: boolean) => {
      if (typeof isLocked !== 'boolean') {
        return;
      }
      setLocks((prev) => {
        if (prev[lockKey] === isLocked) return prev;
        const exclusiveLock = (isMobile || isTablet) && isLocked;
        return exclusiveLock
          ? { ...UNLOCKED_PANES, [lockKey]: isLocked }
          : { ...prev, [lockKey]: isLocked };
      });

      if (!isSmallMobile) {
        const exclusiveLock = (isMobile || isTablet) && isLocked;
        savePaneLocks(
          exclusiveLock
            ? { ...UNLOCKED_PANES, [lockKey]: isLocked }
            : { [lockKey]: isLocked },
        );
      }

      if (lockKey === 'tasks') {
        setIsTasksPaneOpenState(isLocked);
      } else if ((isMobile || isTablet) && isLocked) {
        setIsTasksPaneOpenState(false);
      }
    },
    [isMobile, isTablet, isSmallMobile, savePaneLocks],
  );

  const setIsGenerationsPaneLocked = useMemo(() => createPaneLockSetter('gens'), [createPaneLockSetter]);
  const setIsEditorPaneLocked = useMemo(() => createPaneLockSetter('editor'), [createPaneLockSetter]);
  const setIsShotsPaneLocked = useMemo(() => createPaneLockSetter('shots'), [createPaneLockSetter]);
  const setIsTasksPaneLocked = useMemo(() => createPaneLockSetter('tasks'), [createPaneLockSetter]);

  const setIsGenerationsPaneOpen = useCallback((isOpen: boolean) => {
    setIsGenerationsPaneOpenState(isOpen);
  }, []);

  const setIsEditorPaneOpen = useCallback((isOpen: boolean) => {
    setIsEditorPaneOpenState(isOpen);
  }, []);

  const setIsTasksPaneOpen = useCallback((isOpen: boolean) => {
    if (!isSmallMobile) {
      setIsTasksPaneOpenState(isOpen);
    }
  }, [isSmallMobile]);

  const resetAllPaneLocks = useCallback(() => {
    setLocks(UNLOCKED_PANES);
    setIsTasksPaneOpenState(false);
    savePaneLocks(UNLOCKED_PANES);
  }, [savePaneLocks]);

  return {
    locks,
    isGenerationsPaneOpenState,
    isEditorPaneOpenState,
    isTasksPaneOpenState,
    setIsGenerationsPaneLocked,
    setIsEditorPaneLocked,
    setIsShotsPaneLocked,
    setIsTasksPaneLocked,
    setIsGenerationsPaneOpen,
    setIsEditorPaneOpen,
    setIsTasksPaneOpen,
    resetAllPaneLocks,
  };
}
