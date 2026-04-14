import React from 'react';
import { RepositionButtons } from './RepositionButtons';
import {
  AdvancedSettingsSection,
  GenerationOptionsSection,
  LegacyLoraSection,
  ModelAndLoraSection,
  PromptSection,
  type SharedEditPanelProps,
} from './sharedSections';

interface RepositionPanelProps extends SharedEditPanelProps {
  handleSaveAsVariant: () => void;
  handleGenerateReposition: () => void;
}

export const RepositionPanel: React.FC<RepositionPanelProps> = ({
  state,
  isCloudMode,
  editLoraManager,
  availableLoras,
  advancedSettings,
  setAdvancedSettings,
  isLocalGeneration,
  handleSaveAsVariant,
  handleGenerateReposition,
}) => (
  <>
    <PromptSection state={state} mode="reposition" />
    <ModelAndLoraSection
      state={state}
      isCloudMode={isCloudMode}
      editLoraManager={editLoraManager}
      availableLoras={availableLoras}
    />
    <LegacyLoraSection state={state} hasManagedLoras={Boolean(editLoraManager)} />
    <AdvancedSettingsSection
      state={state}
      settings={advancedSettings}
      onSettingsChange={setAdvancedSettings}
      isLocalGeneration={isLocalGeneration}
    />
    <GenerationOptionsSection state={state} />
    <RepositionButtons
      isMobile={state.isMobile}
      hasTransformChanges={state.hasTransformChanges}
      handleSaveAsVariant={handleSaveAsVariant}
      isSavingAsVariant={state.isSavingAsVariant}
      saveAsVariantSuccess={state.saveAsVariantSuccess}
      handleGenerateReposition={handleGenerateReposition}
      isGeneratingReposition={state.isGeneratingReposition}
      repositionGenerateSuccess={state.repositionGenerateSuccess}
    />
  </>
);
