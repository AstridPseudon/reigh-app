import type { ShotEditorLayoutProps } from '../ShotEditorLayout';
import { useShotSettingsValue, type UseShotSettingsValueProps } from '../hooks/editor-state/useShotSettingsValue';

interface UseShotEditorLayoutModelParams {
  contextInput: UseShotSettingsValueProps;
  sections: Omit<ShotEditorLayoutProps, 'contextValue'>;
}

export function useShotEditorLayoutModel({
  contextInput,
  sections,
}: UseShotEditorLayoutModelParams): ShotEditorLayoutProps {
  const contextValue = useShotSettingsValue(contextInput);

  return {
    contextValue,
    ...sections,
  };
}
