import { useCallback } from 'react';
import { useAutoSaveSettings } from '@/shared/settings/hooks/useAutoSaveSettings';
import type { GenerationControlValues } from '@/shared/components/PromptGenerationControls';
import type { BulkEditControlValues } from '@/shared/components/PromptEditorModal/BulkEditControls';

type EditorMode = 'generate' | 'remix' | 'bulk-edit';

interface PersistedEditorControlsSettings {
  generationSettings: GenerationControlValues;
  bulkEditSettings: BulkEditControlValues;
  activeTab: EditorMode;
}

interface UsePersistentPromptSettingsParams {
  selectedProjectId: string | null;
}

const DEFAULT_GENERATION_SETTINGS: GenerationControlValues = {
  overallPromptText: '',
  remixPromptText: 'More like this',
  rulesToRememberText: '',
  numberToGenerate: 16,
  includeExistingContext: true,
  addSummary: true,
  replaceCurrentPrompts: false,
  temperature: 0.8,
  showAdvanced: false,
};

const DEFAULT_BULK_EDIT_SETTINGS: BulkEditControlValues = {
  editInstructions: '',
  modelType: 'smart',
};

export function usePersistentPromptSettings({ selectedProjectId }: UsePersistentPromptSettingsParams) {
  const persisted = useAutoSaveSettings<PersistedEditorControlsSettings>({
    toolId: 'prompt-editor-controls',
    projectId: selectedProjectId,
    scope: 'project',
    defaults: {
      generationSettings: DEFAULT_GENERATION_SETTINGS,
      bulkEditSettings: DEFAULT_BULK_EDIT_SETTINGS,
      activeTab: 'generate',
    },
    enabled: !!selectedProjectId,
    debounceMs: 150,
  });

  const handleGenerationValuesChange = useCallback((values: GenerationControlValues) => {
    if (JSON.stringify(persisted.settings.generationSettings) === JSON.stringify(values)) {
      return;
    }
    persisted.updateField('generationSettings', values);
  }, [persisted]);

  const handleBulkEditValuesChange = useCallback((values: BulkEditControlValues) => {
    if (JSON.stringify(persisted.settings.bulkEditSettings) === JSON.stringify(values)) {
      return;
    }
    persisted.updateField('bulkEditSettings', values);
  }, [persisted]);

  const handleActiveTabChange = useCallback((mode: EditorMode) => {
    persisted.updateField('activeTab', mode);
  }, [persisted]);

  return {
    activeTab: persisted.settings.activeTab,
    generationControlValues: persisted.settings.generationSettings,
    bulkEditControlValues: persisted.settings.bulkEditSettings,
    handleGenerationValuesChange,
    handleBulkEditValuesChange,
    handleActiveTabChange,
  };
}
