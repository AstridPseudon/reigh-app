import { useMemo, useState } from 'react';
import {
  BUILTIN_I2V_PRESET,
  BUILTIN_VACE_PRESET,
  detectGenerationMode,
  SEGMENT_I2V_FEATURED_PRESET_IDS,
  SEGMENT_VACE_FEATURED_PRESET_IDS,
} from '@/shared/components/SegmentSettingsForm/segmentSettingsUtils';
import type { SegmentSettings, SegmentSettingsFormProps } from '@/shared/components/SegmentSettingsForm/types';

interface UseAdvancedSettingsStateParams {
  modelName?: string;
  settings: SegmentSettings;
  shotDefaults?: SegmentSettingsFormProps['shotDefaults'];
}

export function useAdvancedSettingsState({
  modelName,
  settings,
  shotDefaults,
}: UseAdvancedSettingsStateParams) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoraModalOpen, setIsLoraModalOpen] = useState(false);

  const generationMode = useMemo(
    () => detectGenerationMode(modelName),
    [modelName]
  );
  const builtinPreset = useMemo(
    () => (generationMode === 'vace' ? BUILTIN_VACE_PRESET : BUILTIN_I2V_PRESET),
    [generationMode]
  );
  const featuredPresetIds = useMemo(
    () =>
      generationMode === 'vace'
        ? SEGMENT_VACE_FEATURED_PRESET_IDS
        : SEGMENT_I2V_FEATURED_PRESET_IDS,
    [generationMode]
  );

  const effectiveLoras = useMemo(() => {
    if (settings.loras !== undefined) {
      return settings.loras;
    }
    return shotDefaults?.loras ?? [];
  }, [settings.loras, shotDefaults?.loras]);

  return {
    showAdvanced,
    setShowAdvanced,
    isLoraModalOpen,
    setIsLoraModalOpen,
    generationMode,
    builtinPreset,
    featuredPresetIds,
    effectiveLoras,
  };
}
