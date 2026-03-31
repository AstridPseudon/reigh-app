import { useCallback } from 'react';
import { stripModeFromPhaseConfig } from '../segmentSettingsUtils';
import type { PhaseConfig } from '@/shared/types/phaseConfig';
import type { LoraModel } from '@/domains/lora/types/lora';
import type { SegmentSettings, SegmentSettingsFormProps } from '../types';
import { coerceSelectedModel, getModelSpec, MODEL_DEFAULTS } from '@/tools/travel-between-images/settings';
import type { SelectedModel } from '@/tools/travel-between-images/settings';

interface UseAdvancedSettingsHandlersParams {
  onChange: (updates: Partial<SegmentSettings>) => void;
  settings: SegmentSettings;
  shotDefaults?: SegmentSettingsFormProps['shotDefaults'];
  effectiveLoras: NonNullable<SegmentSettings['loras']>;
  openLoraModal: () => void;
}

export function useAdvancedSettingsHandlers({
  onChange,
  settings,
  shotDefaults,
  effectiveLoras,
  openLoraModal,
}: UseAdvancedSettingsHandlersParams) {
  const handleMotionModeChange = useCallback(
    (mode: 'basic' | 'advanced') => {
      onChange({
        motionMode: mode,
        phaseConfig:
          mode === 'basic' && !settings.selectedPhasePresetId
            ? undefined
            : (settings.phaseConfig ?? shotDefaults?.phaseConfig),
      });
    },
    [onChange, settings.phaseConfig, settings.selectedPhasePresetId, shotDefaults?.phaseConfig]
  );

  const handlePhaseConfigChange = useCallback(
    (config: PhaseConfig) => {
      onChange({
        phaseConfig: stripModeFromPhaseConfig(config),
      });
    },
    [onChange]
  );

  const handlePhasePresetSelect = useCallback(
    (presetId: string, config: PhaseConfig) => {
      onChange({
        selectedPhasePresetId: presetId,
        phaseConfig: stripModeFromPhaseConfig(config),
      });
    },
    [onChange]
  );

  const handlePhasePresetRemove = useCallback(() => {
    onChange({
      selectedPhasePresetId: null,
      ...(settings.motionMode !== 'advanced' && { phaseConfig: undefined }),
    });
  }, [onChange, settings.motionMode]);

  const handleRandomSeedChange = useCallback(
    (value: boolean) => {
      onChange({ randomSeed: value });
    },
    [onChange]
  );

  const handleAddLoraClick = useCallback(() => {
    openLoraModal();
  }, [openLoraModal]);

  const handleLoraSelect = useCallback(
    (lora: LoraModel) => {
      const loraId = lora['Model ID'] || (lora.id as string);
      const loraPath =
        lora['Model Files']?.[0]?.url ||
        (lora['Model File'] as string | undefined);
      const loraName = lora.Name || (lora.name as string | undefined) || loraId;

      if (!loraPath) return;
      if (effectiveLoras.some((existing) => existing.id === loraId || existing.path === loraPath)) {
        return;
      }

      onChange({
        loras: [
          ...effectiveLoras,
          {
            id: loraId,
            name: loraName,
            path: loraPath,
            strength: 1.0,
          },
        ],
      });
    },
    [effectiveLoras, onChange]
  );

  const handleRemoveLora = useCallback(
    (loraId: string) => {
      onChange({
        loras: effectiveLoras.filter(
          (existing) => existing.id !== loraId && existing.path !== loraId
        ),
      });
    },
    [effectiveLoras, onChange]
  );

  const handleLoraStrengthChange = useCallback(
    (loraId: string, strength: number) => {
      onChange({
        loras: effectiveLoras.map((existing) =>
          existing.id === loraId || existing.path === loraId
            ? { ...existing, strength }
            : existing
        ),
      });
    },
    [effectiveLoras, onChange]
  );

  // Clear model-dependent settings (LoRAs, phaseConfig, motionMode,
  // inferenceSteps, guidanceScale) when switching models on the segment form.
  // Mirrors the batch form's useLoraSync + VideoTravelSettingsProvider behavior.
  const effectiveSelectedModel = coerceSelectedModel(
    settings.selectedModel ?? shotDefaults?.selectedModel,
  );

  const handleModelChange = useCallback(
    (nextModel: SelectedModel) => {
      const currentSpec = getModelSpec(effectiveSelectedModel);
      const nextSpec = getModelSpec(nextModel);
      const nextDefaults = MODEL_DEFAULTS[nextModel];

      const updates: Partial<SegmentSettings> = {
        selectedModel: nextModel,
        inferenceSteps: nextDefaults.steps,
        guidanceScale: nextDefaults.guidanceScale,
      };

      // Clear LoRAs when switching between model families (incompatible weights)
      if (currentSpec.loraFamily !== nextSpec.loraFamily) {
        updates.loras = [];
      }

      // Clear phase config when switching to a model that doesn't support it
      if (currentSpec.supportsPhaseConfig && !nextSpec.supportsPhaseConfig) {
        updates.phaseConfig = undefined;
        updates.selectedPhasePresetId = null;
        updates.motionMode = 'basic';
      }

      onChange(updates);
    },
    [effectiveSelectedModel, onChange],
  );

  return {
    handleMotionModeChange,
    handlePhaseConfigChange,
    handlePhasePresetSelect,
    handlePhasePresetRemove,
    handleRandomSeedChange,
    handleAddLoraClick,
    handleLoraSelect,
    handleRemoveLora,
    handleLoraStrengthChange,
    handleModelChange,
  };
}
