import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/components/ui/runtime/sonner';
import type { Shot } from '@/domains/generation/types';
import type { ActiveLora } from '@/domains/lora/types/lora';
import type { LoraModel } from '@/domains/lora/components/LoraSelectorModal';
import { useProject } from '@/shared/contexts/ProjectContext';
import { useShotNavigation } from '@/shared/hooks/shots/useShotNavigation';
import { useShotSettings } from '../../hooks/settings/useShotSettings';
import { useToolSettings } from '@/shared/hooks/settings/useToolSettings';
import { SETTINGS_IDS } from '@/shared/lib/settingsIds';
import { DEFAULT_STEERABLE_MOTION_SETTINGS } from '@/shared/types/steerableMotion';
import { DEFAULT_PHASE_CONFIG } from '@/tools/travel-between-images/settings';
import { usePublicLoras } from '@/shared/hooks/useResources';
import { useShotImages } from '@/shared/hooks/shots/useShotImages';
import { isPositioned, isVideoGeneration } from '@/shared/lib/typeGuards';
import { findClosestAspectRatio } from '@/shared/lib/media/aspectRatios';
import { useEnqueueGenerationsInvalidation } from '@/shared/hooks/invalidation/useGenerationInvalidation';
import type { StructureVideoConfigWithMetadata } from '@/shared/lib/tasks/travelBetweenImages';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { buildBasicModeGenerationRequest as buildBasicModePhaseConfig } from '../ShotEditor/services/generateVideo/modelPhase';
import { generateVideo } from '../ShotEditor/services/generateVideoService';
import {
  BUILTIN_DEFAULT_I2V_ID,
  BUILTIN_DEFAULT_VACE_ID,
  FEATURED_PRESET_IDS,
} from '../MotionControl.constants';

const knownPresetIds = [
  BUILTIN_DEFAULT_I2V_ID,
  BUILTIN_DEFAULT_VACE_ID,
  ...FEATURED_PRESET_IDS,
];

const clearAllEnhancedPrompts = async () => {};

type VideoGenerationModalControllerProps = {
  isOpen: boolean;
  onClose: () => void;
  shot: Shot;
};

type ProjectContext = ReturnType<typeof useProject>;
type ShotSettingsState = ReturnType<typeof useShotSettings>;
type ShotSettings = ShotSettingsState['settings'];
type UpdateVideoSettingField = ShotSettingsState['updateField'];
type ShotImage = NonNullable<ReturnType<typeof useShotImages>['data']>[number];
type AvailableLora = NonNullable<ReturnType<typeof usePublicLoras>['data']>[number];

function resolveEffectiveAspectRatio(
  projectAspectRatio: string,
  positionedImages: Array<{ metadata?: Record<string, unknown> | null }>,
): string {
  if (positionedImages.length === 0) {
    return projectAspectRatio;
  }

  const firstImage = positionedImages[0];
  const metadata = firstImage.metadata || {};
  const width = typeof metadata.width === 'number' ? metadata.width : null;
  const height = typeof metadata.height === 'number' ? metadata.height : null;
  if (!width || !height) {
    return projectAspectRatio;
  }

  return findClosestAspectRatio(width / height);
}

function mapSelectedLorasToActiveLoras(
  settingsLoras: Array<{
    id: string;
    name: string;
    path: string;
    strength: number;
    previewImageUrl?: string;
    trigger_word?: string;
  }> | undefined,
): ActiveLora[] {
  return (settingsLoras || []).map((lora) => ({
    id: lora.id,
    name: lora.name,
    path: lora.path,
    strength: lora.strength,
    previewImageUrl: lora.previewImageUrl,
    trigger_word: lora.trigger_word,
  }));
}

function useVideoUiSettings(isOpen: boolean, shotId: string) {
  const { settings: shotUISettings, update: updateShotUISettings } = useToolSettings<{
    acceleratedMode?: boolean;
    randomSeed?: boolean;
  }>(SETTINGS_IDS.TRAVEL_UI_STATE, {
    shotId: isOpen ? shotId : undefined,
    enabled: isOpen && Boolean(shotId),
  });

  const accelerated = shotUISettings?.acceleratedMode ?? false;
  const randomSeed = shotUISettings?.randomSeed ?? false;

  const setAccelerated = useCallback(
    (value: boolean) => {
      updateShotUISettings('shot', { acceleratedMode: value });
    },
    [updateShotUISettings],
  );

  const setRandomSeed = useCallback(
    (value: boolean) => {
      updateShotUISettings('shot', { randomSeed: value });
    },
    [updateShotUISettings],
  );

  return {
    accelerated,
    randomSeed,
    setAccelerated,
    setRandomSeed,
  };
}

function useVideoGenerationData({
  isOpen,
  shot,
  selectedProjectId,
  projects,
}: {
  isOpen: boolean;
  shot: Shot;
  selectedProjectId: ProjectContext['selectedProjectId'];
  projects: ProjectContext['projects'];
}) {
  const { settings, status, updateField } = useShotSettings(
    isOpen ? shot.id : null,
    selectedProjectId,
  );

  const { data: availableLoras } = usePublicLoras();
  const { data: shotGenerations, isLoading: generationsLoading } = useShotImages(
    isOpen ? shot.id : null,
    { disableRefetch: false },
  );

  const positionedImages = useMemo(() => {
    if (!shotGenerations) {
      return [] as ShotImage[];
    }

    return shotGenerations
      .filter((generation) => !isVideoGeneration(generation) && isPositioned(generation))
      .sort((first, second) => (first.timeline_frame ?? 0) - (second.timeline_frame ?? 0));
  }, [shotGenerations]);

  const currentProject = projects.find((project) => project.id === selectedProjectId);
  const projectAspectRatio = currentProject?.aspectRatio || '16:9';

  const effectiveAspectRatio = useMemo(
    () => resolveEffectiveAspectRatio(projectAspectRatio, positionedImages),
    [positionedImages, projectAspectRatio],
  );

  const selectedLoras = useMemo(
    () => mapSelectedLorasToActiveLoras(settings.loras),
    [settings.loras],
  );

  const validPresetId = useMemo(() => {
    const presetId = settings.selectedPhasePresetId;
    if (!presetId) {
      return undefined;
    }
    return knownPresetIds.includes(presetId) ? presetId : undefined;
  }, [settings.selectedPhasePresetId]);

  const isLoading =
    (status !== 'ready' && status !== 'saving' && status !== 'error') || generationsLoading;

  return {
    availableLoras,
    effectiveAspectRatio,
    isLoading,
    positionedImages,
    selectedLoras,
    settings,
    status,
    updateField,
    validPresetId,
  };
}

function useVideoGenerationLoras({
  availableLoras,
  selectedLoras,
  settings,
  updateField,
}: {
  availableLoras: AvailableLora[] | undefined;
  selectedLoras: ActiveLora[];
  settings: ShotSettings;
  updateField: UpdateVideoSettingField;
}) {
  const [isLoraModalOpen, setIsLoraModalOpen] = useState(false);

  const handleAddLora = useCallback(
    (lora: LoraModel) => {
      const newLora = {
        id: (lora['Model ID'] || '') as string,
        name: (lora.Name || '') as string,
        path: (lora.link || '') as string,
        strength: 1,
        previewImageUrl: lora['Preview Image URL'] as string | undefined,
        trigger_word: lora['Trigger Word'] as string | undefined,
      };

      const currentLoras = settings.loras || [];
      if (!currentLoras.some((existingLora) => existingLora.id === newLora.id)) {
        updateField('loras', [...currentLoras, newLora]);
      }
      setIsLoraModalOpen(false);
    },
    [settings.loras, updateField],
  );

  const handleRemoveLora = useCallback(
    (loraId: string) => {
      updateField(
        'loras',
        (settings.loras || []).filter((lora) => lora.id !== loraId),
      );
    },
    [settings.loras, updateField],
  );

  const handleLoraStrengthChange = useCallback(
    (loraId: string, strength: number) => {
      updateField(
        'loras',
        (settings.loras || []).map((lora) =>
          lora.id === loraId ? { ...lora, strength } : lora,
        ),
      );
    },
    [settings.loras, updateField],
  );

  const handleAddTriggerWord = useCallback(
    (word: string) => {
      const currentPrompt = settings.prompt || '';
      if (!currentPrompt.includes(word)) {
        const newPrompt = currentPrompt ? `${currentPrompt}, ${word}` : word;
        updateField('prompt', newPrompt);
      }
    },
    [settings.prompt, updateField],
  );

  const selectedLorasForModal = useMemo(() => {
    const catalog = availableLoras || [];
    return selectedLoras.flatMap((selectedLora) => {
      const fullLora = catalog.find((model) => model['Model ID'] === selectedLora.id);
      if (!fullLora) {
        return [];
      }
      return [{ ...fullLora, strength: selectedLora.strength }];
    });
  }, [availableLoras, selectedLoras]);

  const openLoraModal = useCallback(() => {
    setIsLoraModalOpen(true);
  }, []);

  const closeLoraModal = useCallback(() => {
    setIsLoraModalOpen(false);
  }, []);

  return {
    closeLoraModal,
    handleAddLora,
    handleAddTriggerWord,
    handleLoraStrengthChange,
    handleRemoveLora,
    isLoraModalOpen,
    openLoraModal,
    selectedLorasForModal,
  };
}

function useVideoGenerationUiState(onClose: () => void) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [justQueued, setJustQueued] = useState(false);
  const justQueuedTimeoutRef = useRef<number | null>(null);

  const queueAndScheduleClose = useCallback(() => {
    setJustQueued(true);

    if (justQueuedTimeoutRef.current) {
      clearTimeout(justQueuedTimeoutRef.current);
    }

    justQueuedTimeoutRef.current = window.setTimeout(() => {
      setJustQueued(false);
      justQueuedTimeoutRef.current = null;
      onClose();
    }, 1000);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (justQueuedTimeoutRef.current) {
        clearTimeout(justQueuedTimeoutRef.current);
      }
    };
  }, []);

  return {
    isGenerating,
    justQueued,
    queueAndScheduleClose,
    setIsGenerating,
  };
}

function useVideoGenerationNavigation({
  isLoraModalOpen,
  onClose,
  shot,
}: {
  isLoraModalOpen: boolean;
  onClose: () => void;
  shot: Shot;
}) {
  const { navigateToShot } = useShotNavigation();

  const handleNavigateToShot = useCallback(() => {
    onClose();
    navigateToShot(shot);
  }, [navigateToShot, onClose, shot]);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isLoraModalOpen) {
        onClose();
      }
    },
    [isLoraModalOpen, onClose],
  );

  return {
    handleDialogOpenChange,
    handleNavigateToShot,
  };
}

function useVideoGenerationExecution({
  effectiveAspectRatio,
  invalidateGenerations,
  onGenerationQueued,
  positionedImages,
  queryClient,
  randomSeed,
  selectedLoras,
  selectedProjectId,
  setIsGenerating,
  settings,
  shot,
  updateField,
}: {
  effectiveAspectRatio: string;
  invalidateGenerations: ReturnType<typeof useEnqueueGenerationsInvalidation>;
  onGenerationQueued: () => void;
  positionedImages: ShotImage[];
  queryClient: ReturnType<typeof useQueryClient>;
  randomSeed: boolean;
  selectedLoras: ActiveLora[];
  selectedProjectId: ProjectContext['selectedProjectId'];
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  settings: ShotSettings;
  shot: Shot;
  updateField: UpdateVideoSettingField;
}) {
  return useCallback(async () => {
    if (!selectedProjectId || !shot.id) {
      toast.error('No project or shot selected.');
      return;
    }

    if (positionedImages.length < 1) {
      toast.error('At least 1 positioned image is required.');
      return;
    }

    setIsGenerating(true);
    try {
      updateField('generationMode', 'batch');

      const userLoras = selectedLoras.map((lora) => ({
        path: lora.path,
        strength: lora.strength,
      }));
      const { phaseConfig: basicPhaseConfig } = buildBasicModePhaseConfig(
        settings.amountOfMotion || 50,
        userLoras,
      );

      const motionMode = settings.motionMode || 'basic';
      const advancedMode = motionMode === 'advanced';
      const finalPhaseConfig = advancedMode
        ? settings.phaseConfig || DEFAULT_PHASE_CONFIG
        : basicPhaseConfig;

      const structureVideos: StructureVideoConfigWithMetadata[] = settings.structureVideo?.path
        ? [
            {
              path: settings.structureVideo.path,
              start_frame: 0,
              end_frame: settings.batchVideoFrames || 61,
              treatment: settings.structureVideo.treatment || 'adjust',
              motion_strength: settings.structureVideo.motionStrength ?? 1,
              structure_type: settings.structureVideo.structureType || 'uni3c',
              metadata: settings.structureVideo.metadata ?? null,
            },
          ]
        : [];

      const mergedSteerableSettings = {
        ...DEFAULT_STEERABLE_MOTION_SETTINGS,
        ...(settings.steerableMotionSettings || {}),
      };

      const result = await generateVideo({
        projectId: selectedProjectId,
        selectedShotId: shot.id,
        selectedShot: shot,
        queryClient,
        effectiveAspectRatio,
        generationMode: 'batch',
        promptConfig: {
          base_prompt: settings.prompt || '',
          enhance_prompt: settings.enhancePrompt,
          text_before_prompts: settings.textBeforePrompts,
          text_after_prompts: settings.textAfterPrompts,
          default_negative_prompt: mergedSteerableSettings.negative_prompt,
        },
        motionConfig: {
          amount_of_motion: settings.amountOfMotion || 50,
          motion_mode: motionMode,
          advanced_mode: advancedMode,
          phase_config: finalPhaseConfig,
          selected_phase_preset_id: settings.selectedPhasePresetId ?? undefined,
        },
        modelConfig: {
          seed: mergedSteerableSettings.seed,
          random_seed: randomSeed,
          turbo_mode: settings.turboMode || false,
          debug: mergedSteerableSettings.debug || false,
          generation_type_mode: settings.generationTypeMode || 'i2v',
        },
        structureVideos,
        batchVideoFrames: settings.batchVideoFrames || 61,
        selectedLoras: selectedLoras.map((lora) => ({
          id: lora.id,
          path: lora.path,
          strength: lora.strength,
          name: lora.name,
        })),
        variantNameParam: '',
        clearAllEnhancedPrompts,
      });

      if (result.ok) {
        onGenerationQueued();

        invalidateGenerations(shot.id, {
          reason: 'video-generation-modal-success',
          scope: 'all',
          includeProjectUnified: true,
          projectId: selectedProjectId ?? undefined,
        });
      } else {
        toast.error(result.message || 'Failed to generate video');
      }
    } catch (error) {
      normalizeAndPresentError(error, {
        context: 'VideoGenerationModal',
        toastTitle: 'Failed to generate video',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [
    selectedProjectId,
    shot,
    positionedImages,
    setIsGenerating,
    updateField,
    selectedLoras,
    settings,
    queryClient,
    effectiveAspectRatio,
    randomSeed,
    onGenerationQueued,
    invalidateGenerations,
  ]);
}

export function useVideoGenerationModalController({
  isOpen,
  onClose,
  shot,
}: VideoGenerationModalControllerProps) {
  const { selectedProjectId, projects } = useProject();
  const queryClient = useQueryClient();
  const invalidateGenerations = useEnqueueGenerationsInvalidation();

  const uiState = useVideoGenerationUiState(onClose);
  const uiSettings = useVideoUiSettings(isOpen, shot.id);
  const generationData = useVideoGenerationData({
    isOpen,
    shot,
    selectedProjectId,
    projects,
  });
  const loraController = useVideoGenerationLoras({
    availableLoras: generationData.availableLoras,
    selectedLoras: generationData.selectedLoras,
    settings: generationData.settings,
    updateField: generationData.updateField,
  });
  const navigation = useVideoGenerationNavigation({
    isLoraModalOpen: loraController.isLoraModalOpen,
    onClose,
    shot,
  });

  const handleGenerate = useVideoGenerationExecution({
    effectiveAspectRatio: generationData.effectiveAspectRatio,
    invalidateGenerations,
    onGenerationQueued: uiState.queueAndScheduleClose,
    positionedImages: generationData.positionedImages,
    queryClient,
    randomSeed: uiSettings.randomSeed,
    selectedLoras: generationData.selectedLoras,
    selectedProjectId,
    setIsGenerating: uiState.setIsGenerating,
    settings: generationData.settings,
    shot,
    updateField: generationData.updateField,
  });

  const isDisabled =
    uiState.isGenerating || generationData.isLoading || generationData.positionedImages.length < 1;

  return {
    projects,
    selectedProjectId,
    settings: generationData.settings,
    status: generationData.status,
    updateField: generationData.updateField,
    availableLoras: generationData.availableLoras,
    positionedImages: generationData.positionedImages,
    isLoading: generationData.isLoading,
    isGenerating: uiState.isGenerating,
    justQueued: uiState.justQueued,
    isDisabled,
    accelerated: uiSettings.accelerated,
    setAccelerated: uiSettings.setAccelerated,
    randomSeed: uiSettings.randomSeed,
    setRandomSeed: uiSettings.setRandomSeed,
    validPresetId: generationData.validPresetId,
    selectedLoras: generationData.selectedLoras,
    isLoraModalOpen: loraController.isLoraModalOpen,
    openLoraModal: loraController.openLoraModal,
    closeLoraModal: loraController.closeLoraModal,
    handleAddLora: loraController.handleAddLora,
    handleRemoveLora: loraController.handleRemoveLora,
    handleLoraStrengthChange: loraController.handleLoraStrengthChange,
    handleAddTriggerWord: loraController.handleAddTriggerWord,
    selectedLorasForModal: loraController.selectedLorasForModal,
    handleGenerate,
    handleNavigateToShot: navigation.handleNavigateToShot,
    handleDialogOpenChange: navigation.handleDialogOpenChange,
  };
}
