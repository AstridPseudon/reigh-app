import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export interface SelectClipOptions {
  toggle?: boolean;
}

export interface UseMultiSelectResult {
  selectedClipIds: ReadonlySet<string>;
  selectedClipIdsRef: React.MutableRefObject<Set<string>>;
  primaryClipId: string | null;
  selectClip: (clipId: string, opts?: SelectClipOptions) => void;
  selectClips: (clipIds: Iterable<string>) => void;
  addToSelection: (clipIds: Iterable<string>) => void;
  clearSelection: () => void;
  isClipSelected: (clipId: string) => boolean;
  pruneSelection: (validIds: Set<string>) => void;
}

const getFirstSetValue = (values: ReadonlySet<string>): string | null => {
  for (const value of values) {
    return value;
  }

  return null;
};

const getPrimaryClipId = (
  selectedClipIds: ReadonlySet<string>,
  preferredPrimaryClipId: string | null,
): string | null => {
  if (preferredPrimaryClipId && selectedClipIds.has(preferredPrimaryClipId)) {
    return preferredPrimaryClipId;
  }

  return getFirstSetValue(selectedClipIds);
};

const areSetsEqual = (left: ReadonlySet<string>, right: ReadonlySet<string>): boolean => {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
};

const buildSelectionSet = (clipIds: Iterable<string>): Set<string> => {
  const nextSelection = new Set<string>();

  for (const clipId of clipIds) {
    nextSelection.add(clipId);
  }

  return nextSelection;
};

export function useMultiSelect(): UseMultiSelectResult {
  const [selectedClipIdsState, setSelectedClipIdsState] = useState<Set<string>>(() => new Set());
  const [primaryClipIdState, setPrimaryClipIdState] = useState<string | null>(null);

  const selectedClipIdsRef = useRef<Set<string>>(selectedClipIdsState);
  const primaryClipIdRef = useRef<string | null>(primaryClipIdState);

  useLayoutEffect(() => {
    selectedClipIdsRef.current = selectedClipIdsState;
    primaryClipIdRef.current = primaryClipIdState;
  }, [primaryClipIdState, selectedClipIdsState]);

  const commitSelection = useCallback((nextSelection: Set<string>, nextPrimaryClipId: string | null) => {
    selectedClipIdsRef.current = nextSelection;
    primaryClipIdRef.current = nextPrimaryClipId;
    setSelectedClipIdsState(nextSelection);
    setPrimaryClipIdState(nextPrimaryClipId);
  }, []);

  const clearSelection = useCallback(() => {
    if (selectedClipIdsRef.current.size === 0 && primaryClipIdRef.current === null) {
      return;
    }

    commitSelection(new Set(), null);
  }, [commitSelection]);

  const selectClip = useCallback((clipId: string, opts?: SelectClipOptions) => {
    if (!opts?.toggle) {
      commitSelection(new Set([clipId]), clipId);
      return;
    }

    const nextSelection = new Set(selectedClipIdsRef.current);
    if (nextSelection.has(clipId)) {
      nextSelection.delete(clipId);
      commitSelection(
        nextSelection,
        getPrimaryClipId(
          nextSelection,
          primaryClipIdRef.current === clipId ? null : primaryClipIdRef.current,
        ),
      );
      return;
    }

    nextSelection.add(clipId);
    commitSelection(nextSelection, clipId);
  }, [commitSelection]);

  const selectClips = useCallback((clipIds: Iterable<string>) => {
    const nextSelection = buildSelectionSet(clipIds);
    commitSelection(nextSelection, getPrimaryClipId(nextSelection, null));
  }, [commitSelection]);

  const addToSelection = useCallback((clipIds: Iterable<string>) => {
    const nextSelection = new Set(selectedClipIdsRef.current);
    for (const clipId of clipIds) {
      nextSelection.add(clipId);
    }

    const nextPrimaryClipId = getPrimaryClipId(nextSelection, primaryClipIdRef.current);
    if (
      areSetsEqual(selectedClipIdsRef.current, nextSelection)
      && primaryClipIdRef.current === nextPrimaryClipId
    ) {
      return;
    }

    commitSelection(nextSelection, nextPrimaryClipId);
  }, [commitSelection]);

  const isClipSelected = useCallback((clipId: string) => {
    return selectedClipIdsRef.current.has(clipId);
  }, []);

  const pruneSelection = useCallback((validIds: Set<string>) => {
    const nextSelection = new Set<string>();
    for (const clipId of selectedClipIdsRef.current) {
      if (validIds.has(clipId)) {
        nextSelection.add(clipId);
      }
    }

    const nextPrimaryClipId = getPrimaryClipId(nextSelection, primaryClipIdRef.current);
    if (
      areSetsEqual(selectedClipIdsRef.current, nextSelection)
      && primaryClipIdRef.current === nextPrimaryClipId
    ) {
      return;
    }

    commitSelection(nextSelection, nextPrimaryClipId);
  }, [commitSelection]);

  return {
    selectedClipIds: selectedClipIdsState,
    selectedClipIdsRef,
    primaryClipId: primaryClipIdState,
    selectClip,
    selectClips,
    addToSelection,
    clearSelection,
    isClipSelected,
    pruneSelection,
  };
}
