import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLoraManager } from '@/domains/lora/hooks/useLoraManager';
import type { LoraManagerState } from '@/domains/lora/types/loraManager';
import { SETTINGS_IDS } from '@/shared/lib/settingsIds';
import type { ActiveLora, LoraModel } from '@/domains/lora/types/lora';
import { ShotLora, type SelectedModel } from '@/tools/travel-between-images/settings';

interface UseLoRASyncProps {
  // LoRAs from unified shot settings
  selectedLoras: ShotLora[];
  onSelectedLorasChange: (loras: ShotLora[]) => void;

  // Project ID for Save/Load functionality
  projectId?: string;

  // Available loras for lookup
  availableLoras: LoraModel[];

  // Prompt integration
  batchVideoPrompt: string;
  onBatchVideoPromptChange: (prompt: string) => void;
  selectedModel: SelectedModel;
}

export type LoraManagerReturn = LoraManagerState;

function toActiveLora(lora: ShotLora): ActiveLora {
  return {
    id: lora.id,
    name: lora.name,
    path: lora.path,
    strength: lora.strength,
    previewImageUrl: lora.previewImageUrl,
    trigger_word: lora.trigger_word,
  };
}

function toShotLora(lora: ActiveLora): ShotLora {
  return {
    id: lora.id,
    name: lora.name,
    path: lora.path,
    strength: lora.strength,
    previewImageUrl: lora.previewImageUrl,
    trigger_word: lora.trigger_word,
  };
}

export const useLoraSync = ({
  selectedLoras: selectedLorasFromProps,
  onSelectedLorasChange,
  projectId,
  availableLoras,
  batchVideoPrompt,
  onBatchVideoPromptChange,
  selectedModel,
}: UseLoRASyncProps): { loraManager: LoraManagerReturn } => {
  const selectedLoras = useMemo(
    () => selectedLorasFromProps.map(toActiveLora),
    [selectedLorasFromProps],
  );

  const handleSelectedLorasChange = useCallback((loras: ActiveLora[]) => {
    onSelectedLorasChange(loras.map(toShotLora));
  }, [onSelectedLorasChange]);

  const loraManager = useLoraManager(availableLoras, {
    projectId,
    persistenceScope: 'project',
    persistenceKey: SETTINGS_IDS.PROJECT_LORAS,
    enableProjectPersistence: true,
    enableTriggerWords: true,
    onPromptUpdate: onBatchVideoPromptChange,
    currentPrompt: batchVideoPrompt,
    selectedLoras,
    onSelectedLorasChange: handleSelectedLorasChange,
  });

  const previousModelRef = useRef<SelectedModel | null>(null);

  useEffect(() => {
    if (previousModelRef.current === null) {
      previousModelRef.current = selectedModel;
      return;
    }

    if (previousModelRef.current !== selectedModel && selectedLorasFromProps.length > 0) {
      onSelectedLorasChange([]);
    }

    previousModelRef.current = selectedModel;
  }, [onSelectedLorasChange, selectedLorasFromProps.length, selectedModel]);

  return { loraManager };
};
