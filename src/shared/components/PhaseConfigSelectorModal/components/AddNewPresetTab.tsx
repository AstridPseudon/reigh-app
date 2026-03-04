import React from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter as ItemCardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Pencil } from 'lucide-react';
import { BasicInfoSection } from './sections/BasicInfoSection';
import { BaseGenerationSettingsSection } from './sections/BaseGenerationSettingsSection';
import { PhaseConfigSection } from './sections/PhaseConfigSection';
import { SampleGenerationsSection } from './sections/SampleGenerationsSection';
import { useAddNewPresetTabController } from '../hooks/useAddNewPresetTabController';
import type { AddNewTabProps } from './AddNewPresetTab.types';

export const AddNewPresetTab: React.FC<AddNewTabProps> = (props) => {
  const {
    isEditMode,
    addForm,
    editablePhaseConfig,
    generationTypeMode,
    isSubmitting,
    sampleFilesHook,
    handleFormChange,
    updatePhaseConfig,
    updatePhase,
    updatePhaseLora,
    addLoraToPhase,
    removeLoraFromPhase,
    setGenerationTypeMode,
    resetPhaseConfigToDefault,
    setEditablePhaseConfig,
    handleCancelEdit,
    handleSubmit,
  } = useAddNewPresetTabController(props);

  const {
    editingPreset,
    isOverwriting = false,
    availableLoras = [],
  } = props;

  return (
    <div className="space-y-4">
      {isEditMode && (
        <div
          className={`flex items-center justify-between p-3 border rounded-lg ${
            isOverwriting
              ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'
              : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Pencil className={`h-4 w-4 ${isOverwriting ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`} />
            <span className={`text-sm font-medium preserve-case ${isOverwriting ? 'text-orange-900 dark:text-orange-100' : 'text-blue-900 dark:text-blue-100'}`}>
              {isOverwriting
                ? `Overwriting: ${editingPreset?.metadata.name}`
                : `Editing: ${editingPreset?.metadata.name}`}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
            Cancel Edit
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {isEditMode
              ? (isOverwriting ? 'Overwrite Preset' : 'Edit Phase Config Preset')
              : 'Create New Phase Config Preset'}
          </CardTitle>
          <CardDescription>
            {isEditMode
              ? (isOverwriting
                ? 'Update this preset with your current configuration.'
                : 'Update your phase configuration preset.')
              : 'Save your current phase configuration for reuse.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <BasicInfoSection
            name={addForm.name}
            description={addForm.description}
            createdByIsYou={addForm.created_by_is_you}
            createdByUsername={addForm.created_by_username}
            isPublic={addForm.is_public}
            onNameChange={(value) => handleFormChange('name', value)}
            onDescriptionChange={(value) => handleFormChange('description', value)}
            onCreatedByIsYouChange={(value) => handleFormChange('created_by_is_you', value)}
            onCreatedByUsernameChange={(value) => handleFormChange('created_by_username', value)}
            onIsPublicChange={(value) => handleFormChange('is_public', value)}
          />

          <BaseGenerationSettingsSection
            basePrompt={addForm.basePrompt}
            negativePrompt={addForm.negativePrompt}
            textBeforePrompts={addForm.textBeforePrompts}
            textAfterPrompts={addForm.textAfterPrompts}
            enhancePrompt={addForm.enhancePrompt}
            durationFrames={addForm.durationFrames}
            onBasePromptChange={(value) => handleFormChange('basePrompt', value)}
            onNegativePromptChange={(value) => handleFormChange('negativePrompt', value)}
            onTextBeforePromptsChange={(value) => handleFormChange('textBeforePrompts', value)}
            onTextAfterPromptsChange={(value) => handleFormChange('textAfterPrompts', value)}
            onEnhancePromptChange={(value) => handleFormChange('enhancePrompt', value)}
            onDurationFramesChange={(value) => handleFormChange('durationFrames', value)}
          />

          <PhaseConfigSection
            editablePhaseConfig={editablePhaseConfig}
            generationTypeMode={generationTypeMode}
            availableLoras={availableLoras}
            onGenerationTypeModeChange={setGenerationTypeMode}
            onResetToDefault={resetPhaseConfigToDefault}
            updatePhaseConfig={updatePhaseConfig}
            updatePhase={updatePhase}
            addLoraToPhase={addLoraToPhase}
            removeLoraFromPhase={removeLoraFromPhase}
            updatePhaseLora={updatePhaseLora}
            setEditablePhaseConfig={setEditablePhaseConfig}
          />

          <SampleGenerationsSection
            editState={{
              isEditMode,
              isOverwriting,
              editingPreset,
              deletedExistingSampleUrls: sampleFilesHook.deletedExistingSampleUrls,
              onDeleteExistingSample: sampleFilesHook.onDeleteExistingSample,
            }}
            initialVideo={{
              initialVideoSample: sampleFilesHook.initialVideoSample,
              initialVideoDeleted: sampleFilesHook.initialVideoDeleted,
              onDeleteInitialVideo: sampleFilesHook.onDeleteInitialVideo,
            }}
            upload={{
              sampleFiles: sampleFilesHook.sampleFiles,
              previewUrls: sampleFilesHook.previewUrls,
              mainGenerationIndex: sampleFilesHook.mainGenerationIndex,
              fileInputKey: sampleFilesHook.fileInputKey,
              onFilesChange: sampleFilesHook.onFilesChange,
              onMainGenerationIndexChange: sampleFilesHook.setMainGenerationIndex,
              onDeleteFile: sampleFilesHook.handleDeleteFile,
            }}
          />
        </CardContent>

        <ItemCardFooter>
          <Button
            variant="retro"
            size="retro-sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !addForm.name.trim()}
          >
            {isSubmitting
              ? (isEditMode ? 'Saving Changes...' : 'Creating Preset...')
              : (isEditMode ? (isOverwriting ? 'Overwrite Preset' : 'Save Changes') : 'Create Preset')}
          </Button>
        </ItemCardFooter>
      </Card>
    </div>
  );
};
