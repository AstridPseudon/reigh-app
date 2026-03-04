/**
 * AdvancedSettingsSection Component
 *
 * The collapsible "Advanced Settings" area containing:
 * - Before/After prompt text fields
 * - Negative prompt
 * - Motion controls (MotionPresetSelector + LoRA selector)
 * - Structure video section (delegated to StructureVideoSection)
 * - LoRA selector modal
 */

import React, { useCallback } from 'react';
import { useSaveFieldAsDefault } from '../hooks';
import { Button } from '@/shared/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible';
import { ChevronLeft } from 'lucide-react';
import { stripModeFromPhaseConfig } from '../segmentSettingsUtils';
import { LoraSelectorModal } from '@/shared/components/LoraSelectorModal';
import { usePublicLoras } from '@/shared/hooks/useResources';
import type { LoraModel } from '@/shared/types/lora';
import { MotionPresetSection } from './MotionPresetSection';
import { NegativePromptField } from './NegativePromptField';
import { PromptFieldsSection } from './PromptFieldsSection';
import { StructureVideoSection } from './StructureVideoSection';
import type { PhaseConfig } from '@/shared/types/phaseConfig';
import type { useStructureVideoUpload } from '../hooks';
import type { SegmentSettings, SegmentSettingsFormProps } from '../types';
import { useAdvancedSettingsState } from '../hooks/useAdvancedSettingsState';

interface AdvancedSettingsSectionProps {
  // Settings
  settings: SegmentSettings;
  onChange: (updates: Partial<SegmentSettings>) => void;
  modelName?: string;
  queryKeyPrefix: string;
  edgeExtendAmount: 4 | 6;

  // Defaults
  shotDefaults?: SegmentSettingsFormProps['shotDefaults'];
  hasOverride?: SegmentSettingsFormProps['hasOverride'];
  onSaveFieldAsDefault?: SegmentSettingsFormProps['onSaveFieldAsDefault'];

  // Structure video
  structureVideoType?: SegmentSettingsFormProps['structureVideoType'];
  structureVideoUrl?: SegmentSettingsFormProps['structureVideoUrl'];
  structureVideoFrameRange?: SegmentSettingsFormProps['structureVideoFrameRange'];
  structureVideoDefaults?: SegmentSettingsFormProps['structureVideoDefaults'];
  isTimelineMode?: boolean;
  onAddSegmentStructureVideo?: SegmentSettingsFormProps['onAddSegmentStructureVideo'];
  onRemoveSegmentStructureVideo?: SegmentSettingsFormProps['onRemoveSegmentStructureVideo'];

  // Video upload hook return
  videoUpload: ReturnType<typeof useStructureVideoUpload>;

  // Drag state for video
  isDraggingVideo: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
  settings,
  onChange,
  modelName,
  queryKeyPrefix,
  edgeExtendAmount,
  shotDefaults,
  hasOverride,
  onSaveFieldAsDefault,
  structureVideoType,
  structureVideoUrl,
  structureVideoFrameRange,
  structureVideoDefaults,
  isTimelineMode,
  onAddSegmentStructureVideo,
  onRemoveSegmentStructureVideo,
  videoUpload,
  isDraggingVideo,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
}) => {
  const {
    showAdvanced,
    setShowAdvanced,
    isLoraModalOpen,
    setIsLoraModalOpen,
    generationMode,
    builtinPreset,
    featuredPresetIds,
    effectiveLoras,
  } = useAdvancedSettingsState({
    modelName,
    settings,
    shotDefaults,
  });
  const { savingField, handleSaveFieldAsDefault } = useSaveFieldAsDefault({
    onSaveFieldAsDefault,
    onChange,
  });

  // Fetch available LoRAs
  const { data: availableLoras = [] } = usePublicLoras();

  // Handlers
  const handleMotionModeChange = useCallback((mode: 'basic' | 'advanced') => {
    onChange({
      motionMode: mode,
      phaseConfig: mode === 'basic' && !settings.selectedPhasePresetId
        ? undefined
        : (settings.phaseConfig ?? shotDefaults?.phaseConfig),
    });
  }, [onChange, settings.phaseConfig, settings.selectedPhasePresetId, shotDefaults?.phaseConfig]);

  const handlePhaseConfigChange = useCallback((config: PhaseConfig) => {
    onChange({
      phaseConfig: stripModeFromPhaseConfig(config),
    });
  }, [onChange]);

  const handlePhasePresetSelect = useCallback((presetId: string, config: PhaseConfig) => {
    onChange({
      selectedPhasePresetId: presetId,
      phaseConfig: stripModeFromPhaseConfig(config),
    });
  }, [onChange]);

  const handlePhasePresetRemove = useCallback(() => {
    onChange({
      selectedPhasePresetId: null,
      ...(settings.motionMode !== 'advanced' && { phaseConfig: undefined }),
    });
  }, [onChange, settings.motionMode]);

  const handleRandomSeedChange = useCallback((value: boolean) => {
    onChange({ randomSeed: value });
  }, [onChange]);

  const handleAddLoraClick = useCallback(() => {
    setIsLoraModalOpen(true);
  }, []);

  const handleLoraSelect = useCallback((lora: LoraModel) => {
    const loraId = lora['Model ID'] || (lora.id as string);
    const loraPath = lora['Model Files']?.[0]?.url || (lora['Model File'] as string | undefined);
    const loraName = lora.Name || (lora.name as string | undefined) || loraId;

    if (!loraPath) return;
    const currentLoras = effectiveLoras;
    if (currentLoras.some(l => l.id === loraId || l.path === loraPath)) return;

    onChange({
      loras: [...currentLoras, {
        id: loraId,
        name: loraName,
        path: loraPath,
        strength: 1.0,
      }],
    });
  }, [effectiveLoras, onChange]);

  const handleRemoveLora = useCallback((loraId: string) => {
    const currentLoras = effectiveLoras;
    onChange({
      loras: currentLoras.filter(l => l.id !== loraId && l.path !== loraId),
    });
  }, [effectiveLoras, onChange]);

  const handleLoraStrengthChange = useCallback((loraId: string, strength: number) => {
    const currentLoras = effectiveLoras;
    onChange({
      loras: currentLoras.map(l =>
        (l.id === loraId || l.path === loraId) ? { ...l, strength } : l
      ),
    });
  }, [effectiveLoras, onChange]);

  // handleSaveFieldAsDefault and savingField provided by useSaveFieldAsDefault hook above

  // Computed values for motion default controls
  const isUsingMotionModeDefault = settings.motionMode === undefined && !!shotDefaults?.motionMode;
  const isUsingPhaseConfigDefault = settings.phaseConfig === undefined && !!shotDefaults?.phaseConfig;
  const isUsingLorasDefault = settings.loras === undefined && (shotDefaults?.loras?.length ?? 0) > 0;
  const isUsingMotionDefaults = isUsingMotionModeDefault && isUsingPhaseConfigDefault;

  return (
    <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`w-full justify-between h-9 text-xs font-medium ${
            showAdvanced
              ? 'bg-muted text-foreground hover:bg-muted rounded-b-none'
              : 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary'
          }`}
        >
          <span>Advanced Settings</span>
          <ChevronLeft className={`w-3 h-3 transition-transform ${showAdvanced ? '-rotate-90' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className={edgeExtendAmount === 6 ? '-mx-6' : '-mx-4'}>
        <div className={`space-y-3 bg-muted/30 border-y border-border/50 ${edgeExtendAmount === 6 ? 'px-6 py-3' : 'px-4 py-3'}`}>
          <PromptFieldsSection
            settings={settings}
            onChange={onChange}
            shotDefaults={shotDefaults}
            hasOverride={hasOverride}
            onSaveFieldAsDefault={onSaveFieldAsDefault}
            handleSaveFieldAsDefault={handleSaveFieldAsDefault}
            savingField={savingField}
          />

          <NegativePromptField
            settings={settings}
            onChange={onChange}
            shotDefaults={shotDefaults}
            hasOverride={hasOverride}
            onSaveFieldAsDefault={onSaveFieldAsDefault}
            handleSaveFieldAsDefault={handleSaveFieldAsDefault}
            savingField={savingField}
          />

          <MotionPresetSection
            builtinPreset={builtinPreset}
            featuredPresetIds={featuredPresetIds}
            generationMode={generationMode}
            settings={settings}
            onChange={onChange}
            shotDefaults={shotDefaults}
            queryKeyPrefix={queryKeyPrefix}
            availableLoras={availableLoras}
            effectiveLoras={effectiveLoras}
            onMotionModeChange={handleMotionModeChange}
            onPhaseConfigChange={handlePhaseConfigChange}
            onPhasePresetSelect={handlePhasePresetSelect}
            onPhasePresetRemove={handlePhasePresetRemove}
            onRandomSeedChange={handleRandomSeedChange}
            onAddLoraClick={handleAddLoraClick}
            onRemoveLora={handleRemoveLora}
            onLoraStrengthChange={handleLoraStrengthChange}
            onSaveFieldAsDefault={onSaveFieldAsDefault}
            handleSaveFieldAsDefault={handleSaveFieldAsDefault}
            savingField={savingField}
            isUsingMotionDefaults={isUsingMotionDefaults}
            isUsingLorasDefault={isUsingLorasDefault}
          />

          {/* Structure Video Section */}
          <StructureVideoSection
            structureVideoType={structureVideoType}
            structureVideoUrl={structureVideoUrl}
            structureVideoFrameRange={structureVideoFrameRange}
            structureVideoDefaults={structureVideoDefaults}
            settings={settings}
            onChange={onChange}
            isTimelineMode={isTimelineMode}
            onAddSegmentStructureVideo={onAddSegmentStructureVideo as ((video: unknown) => void) | undefined}
            onRemoveSegmentStructureVideo={onRemoveSegmentStructureVideo}
            videoUpload={videoUpload}
            isDraggingVideo={isDraggingVideo}
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onSaveFieldAsDefault={onSaveFieldAsDefault}
            handleSaveFieldAsDefault={handleSaveFieldAsDefault}
            savingField={savingField}
          />
        </div>

        {/* LoRA Selector Modal */}
        <LoraSelectorModal
          isOpen={isLoraModalOpen}
          onClose={() => setIsLoraModalOpen(false)}
          loras={availableLoras}
          onAddLora={handleLoraSelect}
          onRemoveLora={handleRemoveLora}
          onUpdateLoraStrength={handleLoraStrengthChange}
          selectedLoras={(effectiveLoras).map(lora => {
            const fullLora = availableLoras.find(l => l.id === lora.id || l.path === lora.path);
            return {
              ...fullLora,
              "Model ID": lora.id,
              Name: lora.name,
              strength: lora.strength,
            } as LoraModel & { strength: number };
          })}
          lora_type="Wan I2V"
        />
      </CollapsibleContent>
    </Collapsible>
  );
};
