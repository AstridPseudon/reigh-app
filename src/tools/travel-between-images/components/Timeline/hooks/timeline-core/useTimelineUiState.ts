import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

interface TimelineUiState {
  resetGap: number;
  showVideoBrowser: boolean;
  isUploadingStructureVideo: boolean;
}

type TimelineUiAction =
  | { type: 'set_reset_gap'; value: number }
  | { type: 'set_show_video_browser'; value: boolean }
  | { type: 'set_is_uploading_structure_video'; value: boolean };

const DEFAULT_RESET_GAP = 50;
const DEFAULT_MAX_GAP = 81;

interface UseTimelineUiStateOptions {
  maxFrameLimit?: number;
  defaultFrameGap?: number;
}

function reducer(state: TimelineUiState, action: TimelineUiAction): TimelineUiState {
  switch (action.type) {
    case 'set_reset_gap':
      return {
        ...state,
        resetGap: action.value,
      };
    case 'set_show_video_browser':
      return {
        ...state,
        showVideoBrowser: action.value,
      };
    case 'set_is_uploading_structure_video':
      return {
        ...state,
        isUploadingStructureVideo: action.value,
      };
    default:
      return state;
  }
}

export function useTimelineUiState(options: UseTimelineUiStateOptions = {}) {
  const { maxFrameLimit = DEFAULT_MAX_GAP, defaultFrameGap } = options;
  const initialResetGap = defaultFrameGap ?? DEFAULT_RESET_GAP;

  const [state, dispatch] = useReducer(reducer, {
    resetGap: initialResetGap,
    showVideoBrowser: false,
    isUploadingStructureVideo: false,
  });

  const setResetGap = useCallback((value: number) => {
    dispatch({ type: 'set_reset_gap', value });
  }, []);

  // When the underlying model's default gap changes (model switch), sync the
  // reset gap to the new default so the "Gap" slider reflects the selected model.
  const prevDefaultRef = useRef(defaultFrameGap);
  useEffect(() => {
    if (defaultFrameGap !== undefined && prevDefaultRef.current !== defaultFrameGap) {
      prevDefaultRef.current = defaultFrameGap;
      dispatch({ type: 'set_reset_gap', value: defaultFrameGap });
    }
  }, [defaultFrameGap]);

  const setShowVideoBrowser = useCallback((value: boolean) => {
    dispatch({ type: 'set_show_video_browser', value });
  }, []);

  const setIsUploadingStructureVideo = useCallback((value: boolean) => {
    dispatch({ type: 'set_is_uploading_structure_video', value });
  }, []);

  return useMemo(() => ({
    resetGap: state.resetGap,
    setResetGap,
    maxGap: maxFrameLimit,
    showVideoBrowser: state.showVideoBrowser,
    setShowVideoBrowser,
    isUploadingStructureVideo: state.isUploadingStructureVideo,
    setIsUploadingStructureVideo,
  }), [
    maxFrameLimit,
    setIsUploadingStructureVideo,
    setResetGap,
    setShowVideoBrowser,
    state.isUploadingStructureVideo,
    state.resetGap,
    state.showVideoBrowser,
  ]);
}
