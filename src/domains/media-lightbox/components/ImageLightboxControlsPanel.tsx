import React from 'react';
import type { GenerationRow } from '@/domains/generation/types';
import type {
  LightboxFeatureFlags,
} from '../types';
import { EditModePanel } from './EditModePanel';
import { InfoPanel } from './InfoPanel';
import type { ImageLightboxEnvironment } from '../hooks/useImageLightboxEnvironment';
import type { ImageLightboxEditModel } from '../hooks/useImageLightboxEditing';

interface ImageLightboxControlsPanelProps {
  media: GenerationRow;
  features?: LightboxFeatureFlags;
  env: ImageLightboxEnvironment;
  editModel: ImageLightboxEditModel;
  showPanel: boolean;
  panelVariant: 'desktop' | 'mobile';
  panelTaskId: string | null;
}

export const ImageLightboxControlsPanel = React.memo(function ImageLightboxControlsPanel({
  media,
  features,
  env,
  editModel,
  showPanel,
  panelVariant,
  panelTaskId,
}: ImageLightboxControlsPanelProps) {
  if (!showPanel) {
    return null;
  }

  const showImageEditTools = features?.showImageEditTools ?? true;
  const { editOrchestrator, adjustedTaskDetailsData } = editModel;

  if (editOrchestrator.isSpecialEditMode) {
    return (
      <EditModePanel
        variant={panelVariant}
        taskId={panelTaskId}
        currentMediaId={media.id}
        actions={{
          handleUnifiedGenerate: editOrchestrator.handleUnifiedGenerate,
          handleGenerateAnnotatedEdit: editOrchestrator.handleGenerateAnnotatedEdit,
          handleGenerateReposition: editOrchestrator.handleGenerateReposition,
          handleSaveAsVariant: editOrchestrator.handleSaveAsVariant,
          handleGenerateImg2Img: editOrchestrator.handleGenerateImg2Img,
        }}
        upscale={{
          isCloudMode: env.isCloudMode,
          handleUpscale: async () => {
            await env.upscaleHook.handleUpscale({ scaleFactor: 2, noiseScale: 0.1 });
          },
          isUpscaling: env.upscaleHook.isUpscaling,
          upscaleSuccess: env.upscaleHook.upscaleSuccess,
        }}
        lora={{
          img2imgLoraManager: editOrchestrator.img2imgLoraManager,
          editLoraManager: env.editLoraManager,
          availableLoras: env.availableLoras,
        }}
        advanced={{
          advancedSettings: env.editSettingsPersistence.advancedSettings,
          setAdvancedSettings: env.editSettingsPersistence.setAdvancedSettings,
        }}
        isLocalGeneration={env.isLocalGeneration}
      />
    );
  }

  return (
    <InfoPanel
      variant={panelVariant}
      showImageEditTools={showImageEditTools}
      taskPanel={{
        taskDetailsData: adjustedTaskDetailsData,
        replaceImages: env.replaceImages,
        onReplaceImagesChange: env.setReplaceImages,
      }}
      taskId={panelTaskId}
    />
  );
});
