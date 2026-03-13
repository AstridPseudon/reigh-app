import type { GenerationRow } from '@/domains/generation/types';
import { uploadImageToStorage } from '@/shared/lib/media/imageUploader';
import { createImageInpaintTask } from '@/shared/lib/tasks/imageEditing/imageInpaint';
import { createMaskedEditTask } from '@/shared/lib/tasks/imageEditing/maskedEditTaskBuilder';
import type { MaskedEditTaskParams } from '@/shared/lib/tasks/imageEditing/maskedEditTaskBuilder';
import { buildMaskedEditTaskParams } from '@/shared/lib/tasks/imageEditing/buildMaskedEditTaskParams';
import { convertToHiresFixApiParams } from '../useGenerationEditSettings';
import { getMediaUrl } from '@/shared/lib/media/mediaTypeHelpers';
import type { StrokeOverlayHandle } from '../../components/StrokeOverlay';
import type { EditAdvancedSettings, QwenEditModel } from './types';

type TaskType = 'inpaint' | 'annotate';

interface TaskTypeConfig {
  fileNamePrefix: string;
  createTask: typeof createImageInpaintTask | typeof createAnnotatedImageEditTask;
}

const TASK_CONFIGS: Record<TaskType, TaskTypeConfig> = {
  inpaint: {
    fileNamePrefix: 'inpaint_mask',
    createTask: createImageInpaintTask,
  },
  annotate: {
    fileNamePrefix: 'annotated_edit_mask',
    createTask: createAnnotatedImageEditTask,
  },
};

interface CreateInpaintingTaskWorkflowParams {
  taskType: TaskType;
  media: GenerationRow;
  selectedProjectId: string;
  shotId?: string;
  toolTypeOverride?: string;
  loras?: Array<{ url: string; strength: number }>;
  activeVariantId?: string | null;
  activeVariantLocation?: string | null;
  createAsGeneration?: boolean;
  advancedSettings?: EditAdvancedSettings;
  qwenEditModel?: QwenEditModel;
  inpaintPrompt: string;
  inpaintNumGenerations: number;
  actualGenerationId: string;
  strokeOverlay: StrokeOverlayHandle;
}

function createAnnotatedImageEditTask(params: MaskedEditTaskParams): Promise<string> {
  return createMaskedEditTask({
    taskType: 'annotated_image_edit',
    context: 'createAnnotatedImageEditTask',
    batchOperationName: 'AnnotatedImageEdit',
  }, params);
}

export async function createInpaintingTaskWorkflow({
  taskType,
  media,
  selectedProjectId,
  shotId,
  toolTypeOverride,
  loras,
  activeVariantId,
  activeVariantLocation,
  createAsGeneration,
  advancedSettings,
  qwenEditModel,
  inpaintPrompt,
  inpaintNumGenerations,
  actualGenerationId,
  strokeOverlay,
}: CreateInpaintingTaskWorkflowParams): Promise<string> {
  const config = TASK_CONFIGS[taskType];
  const maskImageData = strokeOverlay.exportMask({ pixelRatio: 1.5 });

  if (!maskImageData) {
    throw new Error('Failed to export mask from overlay');
  }

  const maskBlob = await fetch(maskImageData).then((res) => res.blob());
  const maskFile = new File(
    [maskBlob],
    `${config.fileNamePrefix}_${media.id}_${Date.now()}.png`,
    { type: 'image/png' },
  );
  const maskUrl = await uploadImageToStorage(maskFile);

  const mediaUrl = getMediaUrl(media) || media.imageUrl;
  const sourceUrl = activeVariantLocation || mediaUrl;
  if (!sourceUrl) {
    throw new Error('Missing source media URL');
  }

  return config.createTask(
    buildMaskedEditTaskParams({
      projectId: selectedProjectId,
      imageUrl: sourceUrl,
      maskUrl,
      prompt: inpaintPrompt,
      numGenerations: inpaintNumGenerations,
      generationId: actualGenerationId,
      shotId,
      toolType: toolTypeOverride,
      loras,
      createAsGeneration,
      sourceVariantId: activeVariantId || undefined,
      hiresFix: convertToHiresFixApiParams(advancedSettings),
      qwenEditModel,
    }),
  );
}
