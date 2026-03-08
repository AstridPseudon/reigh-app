import { useCallback, useEffect, useReducer } from 'react';
import { toast } from '@/shared/components/ui/runtime/sonner';
import type { PhaseConfig } from '@/shared/types/phaseConfig';
import { DEFAULT_PHASE_CONFIG } from '@/shared/types/phaseConfig';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { usePresetSampleFiles } from '../hooks/usePresetSampleFiles';
import type { AddNewTabProps } from '../components/types';
import { formReducer, createInitialFormState } from './presetFormReducer';
import { submitPreset } from './submitPreset';

export function useAddNewPresetTabController({
  createResource,
  updateResource,
  onSwitchToBrowse,
  currentPhaseConfig,
  editingPreset,
  onClearEdit,
  currentSettings,
  isOverwriting = false,
  generationTypeMode: initialGenerationTypeMode = 'i2v',
  defaultIsPublic,
}: AddNewTabProps) {
  const isEditMode = Boolean(editingPreset);

  const [state, dispatch] = useReducer(
    formReducer,
    { editingPreset, isOverwriting, currentPhaseConfig, currentSettings, initialGenerationTypeMode, defaultIsPublic },
    (args) => createInitialFormState(
      args.editingPreset, args.isOverwriting, args.currentPhaseConfig,
      args.currentSettings, args.initialGenerationTypeMode, args.defaultIsPublic,
    ),
  );

  const { fields: addForm, editablePhaseConfig, generationTypeMode, isSubmitting } = state;
  const sampleFilesHook = usePresetSampleFiles();

  // --- Hydration: single effect replaces 3 overlapping effects ---
  useEffect(() => {
    if (editingPreset && editingPreset.metadata) {
      dispatch({
        type: 'HYDRATE_FROM_PRESET',
        editingPreset,
        isOverwriting,
        currentSettings,
        currentPhaseConfig,
        initialGenerationTypeMode,
      });
      sampleFilesHook.resetSampleFiles();
      if (isOverwriting && currentSettings?.lastGeneratedVideoUrl) {
        sampleFilesHook.setInitialVideo(currentSettings.lastGeneratedVideoUrl);
      } else if (!isOverwriting) {
        sampleFilesHook.setInitialVideo(null);
      }
    } else if (currentSettings) {
      dispatch({ type: 'HYDRATE_FROM_SETTINGS', currentSettings, currentPhaseConfig });
      if (currentSettings.lastGeneratedVideoUrl) {
        sampleFilesHook.setInitialVideo(currentSettings.lastGeneratedVideoUrl);
      }
    } else if (currentPhaseConfig) {
      dispatch({ type: 'SET_PHASE_CONFIG', config: currentPhaseConfig });
    } else {
      dispatch({ type: 'SET_PHASE_CONFIG', config: DEFAULT_PHASE_CONFIG });
    }
  }, [editingPreset, isOverwriting, currentSettings, currentPhaseConfig, initialGenerationTypeMode, sampleFilesHook]);

  // --- Callbacks ---
  const updatePhaseConfig = useCallback(
    <K extends keyof PhaseConfig>(field: K, value: PhaseConfig[K]) => {
      dispatch({ type: 'UPDATE_PHASE_CONFIG_FIELD', field, value });
    },
    [],
  );

  const updatePhase = useCallback((phaseIdx: number, updates: Partial<PhaseConfig['phases'][0]>) => {
    dispatch({ type: 'UPDATE_PHASE', phaseIdx, updates });
  }, []);

  const updatePhaseLora = useCallback((phaseIdx: number, loraIdx: number, updates: Partial<{ url: string; multiplier: string }>) => {
    dispatch({ type: 'UPDATE_PHASE_LORA', phaseIdx, loraIdx, updates });
  }, []);

  const addLoraToPhase = useCallback((phaseIdx: number, url: string = '', multiplier: string = '1.0') => {
    dispatch({ type: 'ADD_LORA_TO_PHASE', phaseIdx, url, multiplier });
  }, []);

  const removeLoraFromPhase = useCallback((phaseIdx: number, loraIdx: number) => {
    dispatch({ type: 'REMOVE_LORA_FROM_PHASE', phaseIdx, loraIdx });
  }, []);

  const resetForm = useCallback(() => {
    dispatch({ type: 'RESET_FORM', defaultIsPublic, phaseConfig: currentPhaseConfig || DEFAULT_PHASE_CONFIG });
    sampleFilesHook.resetSampleFiles();
  }, [currentPhaseConfig, defaultIsPublic, sampleFilesHook]);

  const handleCancelEdit = useCallback(() => {
    onClearEdit();
    resetForm();
  }, [onClearEdit, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (!addForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!editablePhaseConfig) {
      toast.error('No phase config available to save');
      return;
    }
    dispatch({ type: 'SET_SUBMISSION_STATE', isSubmitting: true });
    try {
      await submitPreset({
        fields: addForm,
        editablePhaseConfig,
        generationTypeMode,
        sampleFiles: {
          sampleFiles: sampleFilesHook.sampleFiles,
          deletedExistingSampleUrls: sampleFilesHook.deletedExistingSampleUrls,
          mainGenerationIndex: sampleFilesHook.mainGenerationIndex,
          initialVideoSample: sampleFilesHook.initialVideoSample,
          initialVideoDeleted: sampleFilesHook.initialVideoDeleted,
        },
        isEditMode,
        isOverwriting,
        editingPreset,
        currentSettings,
        createResource,
        updateResource,
        onClearEdit,
      });
      resetForm();
      onSwitchToBrowse();
    } catch (error) {
      normalizeAndPresentError(error, { context: 'PhaseConfigSelectorModal' });
    } finally {
      dispatch({ type: 'SET_SUBMISSION_STATE', isSubmitting: false });
    }
  }, [
    addForm, editablePhaseConfig, sampleFilesHook, isEditMode, isOverwriting,
    editingPreset, currentSettings, generationTypeMode, updateResource,
    onClearEdit, createResource, resetForm, onSwitchToBrowse,
  ]);

  return {
    isEditMode,
    addForm,
    editablePhaseConfig,
    generationTypeMode,
    isSubmitting,
    sampleFilesHook,
    handleFormChange: useCallback((field: string, value: string | boolean | number) => {
      dispatch({ type: 'SET_FORM_FIELD', field, value });
    }, []),
    updatePhaseConfig,
    updatePhase,
    updatePhaseLora,
    addLoraToPhase,
    removeLoraFromPhase,
    setGenerationTypeMode: (mode: 'i2v' | 'vace') => dispatch({ type: 'SET_GENERATION_TYPE_MODE', mode }),
    resetPhaseConfigToDefault: () => dispatch({ type: 'SET_PHASE_CONFIG', config: DEFAULT_PHASE_CONFIG }),
    setEditablePhaseConfig: (config: React.SetStateAction<PhaseConfig>) => {
      const nextConfig = typeof config === 'function' ? config(editablePhaseConfig) : config;
      dispatch({ type: 'SET_PHASE_CONFIG', config: nextConfig });
    },
    handleCancelEdit,
    handleSubmit,
  };
}
