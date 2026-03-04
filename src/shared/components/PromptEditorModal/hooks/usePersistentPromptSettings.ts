import { useCallback, useState } from 'react';
import { usePersistentToolState } from '@/shared/hooks/usePersistentToolState';
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

export function usePersistentPromptSettings({ selectedProjectId }: UsePersistentPromptSettingsParams) {
  const [activeTab, setActiveTab] = useState<EditorMode>('generate');
  const [generationControlValues, setGenerationControlValues] = useState<GenerationControlValues>({
    overallPromptText: '',
    remixPromptText: 'More like this',
    rulesToRememberText: '',
    numberToGenerate: 16,
    includeExistingContext: true,
    addSummary: true,
    replaceCurrentPrompts: false,
    temperature: 0.8,
    showAdvanced: false,
  });
  const [bulkEditControlValues, setBulkEditControlValues] = useState<BulkEditControlValues>({
    editInstructions: '',
    modelType: 'smart',
  });

  const { markAsInteracted } = usePersistentToolState<PersistedEditorControlsSettings>(
    'prompt-editor-controls',
    { projectId: selectedProjectId ?? undefined },
    {
      generationSettings: [generationControlValues, setGenerationControlValues],
      bulkEditSettings: [bulkEditControlValues, setBulkEditControlValues],
      activeTab: [activeTab, setActiveTab],
    },
    { defaults: { generationSettings: {}, bulkEditSettings: {}, activeTab: 'generate' } },
  );

  const handleGenerationValuesChange = useCallback((values: GenerationControlValues) => {
    setGenerationControlValues((previous) => {
      if (JSON.stringify(previous) === JSON.stringify(values)) {
        return previous;
      }
      markAsInteracted();
      return values;
    });
  }, [markAsInteracted]);

  const handleBulkEditValuesChange = useCallback((values: BulkEditControlValues) => {
    setBulkEditControlValues((previous) => {
      if (JSON.stringify(previous) === JSON.stringify(values)) {
        return previous;
      }
      markAsInteracted();
      return values;
    });
  }, [markAsInteracted]);

  const handleActiveTabChange = useCallback((mode: EditorMode) => {
    markAsInteracted();
    setActiveTab(mode);
  }, [markAsInteracted]);

  return {
    activeTab,
    generationControlValues,
    bulkEditControlValues,
    handleGenerationValuesChange,
    handleBulkEditValuesChange,
    handleActiveTabChange,
  };
}
