import { useEffect, useRef, useState } from 'react';

type ModifierKeysState = {
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  isMultiSelectModifier: boolean;
};

const EMPTY_STATE: ModifierKeysState = {
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  isMultiSelectModifier: false,
};

export function useModifierKeys(): ModifierKeysState {
  const [state, setState] = useState<ModifierKeysState>(EMPTY_STATE);
  const previousStateRef = useRef(EMPTY_STATE);

  useEffect(() => {
    const setIfChanged = (nextState: ModifierKeysState) => {
      const previousState = previousStateRef.current;
      if (
        previousState.shiftKey === nextState.shiftKey
        && previousState.metaKey === nextState.metaKey
        && previousState.ctrlKey === nextState.ctrlKey
        && previousState.isMultiSelectModifier === nextState.isMultiSelectModifier
      ) {
        return;
      }

      previousStateRef.current = nextState;
      setState(nextState);
    };

    const updateState = (event: KeyboardEvent) => {
      setIfChanged({
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        isMultiSelectModifier: event.shiftKey || event.metaKey || event.ctrlKey,
      });
    };

    const resetState = () => setIfChanged(EMPTY_STATE);

    window.addEventListener('keydown', updateState);
    window.addEventListener('keyup', updateState);
    window.addEventListener('blur', resetState);

    return () => {
      window.removeEventListener('keydown', updateState);
      window.removeEventListener('keyup', updateState);
      window.removeEventListener('blur', resetState);
    };
  }, []);

  return state;
}
