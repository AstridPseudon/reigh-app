import { useCallback } from 'react';
import type { ShotEditorLayoutProps } from '../ShotEditorLayout';
import { useShotSettingsValue, type UseShotSettingsValueProps } from '../hooks/editor-state/useShotSettingsValue';
import type { ShotEditorLayoutFinalVideoModel } from './useShotEditorLayoutPayloadModel';

interface UseShotEditorLayoutModelParams {
  contextInput: UseShotSettingsValueProps;
  headerModel: ShotEditorLayoutProps['header'];
  finalVideoModel: ShotEditorLayoutFinalVideoModel;
  timelineModel: ShotEditorLayoutProps['timeline'];
  generationModel: ShotEditorLayoutProps['generation'];
  modalsModel: ShotEditorLayoutProps['modals'];
}

export function useShotEditorLayoutModel({
  contextInput,
  headerModel,
  finalVideoModel,
  timelineModel,
  generationModel,
  modalsModel,
}: UseShotEditorLayoutModelParams): ShotEditorLayoutProps {
  const contextValue = useShotSettingsValue(contextInput);
  const handleJoinSegmentsClick = useCallback(() => {
    finalVideoModel.onRequestJoinMode();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = finalVideoModel.generateVideosCardRef.current;
        if (!target) {
          return;
        }

        const rect = target.getBoundingClientRect();
        const scrollTop = window.scrollY + rect.top - 20;
        window.scrollTo({ top: scrollTop, behavior: 'smooth' });
      });
    });
  }, [finalVideoModel]);
  const finalVideoProps: Omit<ShotEditorLayoutProps['finalVideo'], 'onJoinSegmentsClick'> = finalVideoModel;

  return {
    contextValue,
    header: headerModel,
    finalVideo: {
      ...finalVideoProps,
      onJoinSegmentsClick: handleJoinSegmentsClick,
    },
    timeline: timelineModel,
    generation: generationModel,
    modals: modalsModel,
  };
}
