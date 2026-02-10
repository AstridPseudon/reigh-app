/**
 * useGenerationSource - Manages generation source and model selection
 *
 * Handles:
 * - Generation source toggle (by-reference vs just-text)
 * - Text model selection
 * - LORA category swapping when changing modes
 * - LORA initialization from per-category storage
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { handleError } from '@/shared/lib/errorHandler';
import type { ActiveLora } from '@/shared/components/ActiveLoRAsDisplay';
import {
  GenerationSource,
  TextToImageModel,
  LoraCategory,
  ProjectImageSettings,
  getLoraCategoryForModel,
  getHiresFixDefaultsForModel,
  HiresFixConfig,
} from '../types';

// ============================================================================
// Types
// ============================================================================

interface UseGenerationSourceProps {
  projectImageSettings: ProjectImageSettings | undefined;
  isLoadingProjectSettings: boolean;
  updateProjectImageSettings: (scope: 'project' | 'shot', updates: Partial<ProjectImageSettings>) => Promise<void>;
  markAsInteracted: () => void;
  // LORA manager for category swapping
  loraManager: {
    selectedLoras: ActiveLora[];
    setSelectedLoras: (loras: ActiveLora[]) => void;
  };
  // Callback for hires fix defaults
  setHiresFixConfig: React.Dispatch<React.SetStateAction<HiresFixConfig | Partial<HiresFixConfig>>>;
}

interface UseGenerationSourceReturn {
  // State
  generationSource: GenerationSource;
  selectedTextModel: TextToImageModel;

  // Refs for stale closure prevention
  generationSourceRef: React.MutableRefObject<GenerationSource>;
  selectedTextModelRef: React.MutableRefObject<TextToImageModel>;

  // Handlers
  handleGenerationSourceChange: (source: GenerationSource) => Promise<void>;
  handleTextModelChange: (model: TextToImageModel) => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useGenerationSource(props: UseGenerationSourceProps): UseGenerationSourceReturn {
  const {
    projectImageSettings,
    isLoadingProjectSettings,
    updateProjectImageSettings,
    markAsInteracted,
    loraManager,
    setHiresFixConfig,
  } = props;

  // ============================================================================
  // State
  // ============================================================================

  const [generationSource, setGenerationSource] = useState<GenerationSource>('by-reference');
  const [selectedTextModel, setSelectedTextModel] = useState<TextToImageModel>('qwen-image');

  // Refs to track current values - prevents stale closure issues in callbacks
  const generationSourceRef = useRef<GenerationSource>(generationSource);
  const selectedTextModelRef = useRef<TextToImageModel>(selectedTextModel);

  useEffect(() => { generationSourceRef.current = generationSource; }, [generationSource]);
  useEffect(() => { selectedTextModelRef.current = selectedTextModel; }, [selectedTextModel]);

  // Track initialization
  const hasInitializedGenerationSource = useRef(false);
  const initializedTextModelRef = useRef<TextToImageModel | null>(null);

  // ============================================================================
  // Initialization from Project Settings
  // ============================================================================

  useEffect(() => {
    if (isLoadingProjectSettings) return;
    if (hasInitializedGenerationSource.current) return;
    if (!projectImageSettings) return;

    if (projectImageSettings.generationSource) {
      setGenerationSource(projectImageSettings.generationSource);
    }
    const textModel = projectImageSettings.selectedTextModel || 'qwen-image';
    if (projectImageSettings.selectedTextModel) {
      setSelectedTextModel(projectImageSettings.selectedTextModel);
    }
    initializedTextModelRef.current = textModel;
    hasInitializedGenerationSource.current = true;
  }, [projectImageSettings, isLoadingProjectSettings]);

  // Initialize LORAs from per-category storage (runs after generation source init)
  // Categories: 'qwen' (all Qwen models + by-reference) and 'z-image'
  const hasInitializedLoras = useRef(false);
  useEffect(() => {
    if (isLoadingProjectSettings) return;
    if (hasInitializedLoras.current) return;

    // Determine current category based on generation source and model
    const textModel = initializedTextModelRef.current || selectedTextModel;
    const currentSource = projectImageSettings?.generationSource || generationSource;
    // by-reference always uses 'qwen' category
    const category: LoraCategory = currentSource === 'by-reference' ? 'qwen' : getLoraCategoryForModel(textModel);

    // Try new category-based storage first, fall back to old per-model storage for migration
    let categoryLoras: ActiveLora[] = [];
    if (projectImageSettings?.selectedLorasByCategory) {
      categoryLoras = projectImageSettings.selectedLorasByCategory[category] ?? [];
    } else if (projectImageSettings?.selectedLorasByTextModel) {
      // Migration: use old per-model storage
      categoryLoras = projectImageSettings.selectedLorasByTextModel[textModel] ?? [];
    }

    if (categoryLoras.length > 0) {
      loraManager.setSelectedLoras(categoryLoras);
    }
    hasInitializedLoras.current = true;
  }, [projectImageSettings?.selectedLorasByCategory, projectImageSettings?.selectedLorasByTextModel, projectImageSettings?.generationSource, isLoadingProjectSettings, loraManager, selectedTextModel, generationSource]);

  // ============================================================================
  // Handler: Generation Source Change
  // ============================================================================

  const handleGenerationSourceChange = useCallback(async (source: GenerationSource) => {
    const previousSource = generationSource;
    setGenerationSource(source);
    markAsInteracted();

    // Apply model-specific hires fix defaults when switching modes
    const modelName = source === 'by-reference' ? 'qwen-image' : selectedTextModel;
    setHiresFixConfig(getHiresFixDefaultsForModel(modelName));

    // Determine categories for LORA swapping
    const previousCategory: LoraCategory = previousSource === 'by-reference' ? 'qwen' : getLoraCategoryForModel(selectedTextModel);
    const newCategory: LoraCategory = source === 'by-reference' ? 'qwen' : getLoraCategoryForModel(selectedTextModel);

    // Only swap LORAs if changing categories
    if (previousCategory !== newCategory) {
      const currentLorasByCategory = projectImageSettings?.selectedLorasByCategory ?? {
        'qwen': [],
        'z-image': [],
      };

      // Save current LORAs to the previous category's slot
      const updatedLorasByCategory = {
        ...currentLorasByCategory,
        [previousCategory]: loraManager.selectedLoras,
      };

      // Load LORAs for the new category
      const newCategoryLoras = currentLorasByCategory[newCategory] ?? [];
      loraManager.setSelectedLoras(newCategoryLoras);

      try {
        await updateProjectImageSettings('project', {
          generationSource: source,
          selectedLorasByCategory: updatedLorasByCategory,
        });
      } catch (error) {
        handleError(error, { context: 'useGenerationSource.handleGenerationSourceChange', showToast: false });
      }
    } else {
      try {
        await updateProjectImageSettings('project', { generationSource: source });
      } catch (error) {
        handleError(error, { context: 'useGenerationSource.handleGenerationSourceChange', showToast: false });
      }
    }
  }, [updateProjectImageSettings, markAsInteracted, selectedTextModel, generationSource, projectImageSettings?.selectedLorasByCategory, loraManager, setHiresFixConfig]);

  // ============================================================================
  // Handler: Text Model Change
  // ============================================================================

  const handleTextModelChange = useCallback(async (model: TextToImageModel) => {
    const previousModel = selectedTextModel;
    const previousCategory = getLoraCategoryForModel(previousModel);
    const newCategory = getLoraCategoryForModel(model);

    setSelectedTextModel(model);
    markAsInteracted();

    // Apply model-specific hires fix defaults
    setHiresFixConfig(getHiresFixDefaultsForModel(model));

    // Only swap LORAs if changing categories (qwen ↔ z-image)
    if (previousCategory !== newCategory) {
      const currentLorasByCategory = projectImageSettings?.selectedLorasByCategory ?? {
        'qwen': [],
        'z-image': [],
      };

      // Save current LORAs to the previous category's slot
      const updatedLorasByCategory = {
        ...currentLorasByCategory,
        [previousCategory]: loraManager.selectedLoras,
      };

      // Load LORAs for the new category
      const newCategoryLoras = currentLorasByCategory[newCategory] ?? [];
      loraManager.setSelectedLoras(newCategoryLoras);

      try {
        await updateProjectImageSettings('project', {
          selectedTextModel: model,
          selectedLorasByCategory: updatedLorasByCategory,
        });
      } catch (error) {
        handleError(error, { context: 'useGenerationSource.handleTextModelChange', showToast: false });
      }
    } else {
      try {
        await updateProjectImageSettings('project', { selectedTextModel: model });
      } catch (error) {
        handleError(error, { context: 'useGenerationSource.handleTextModelChange', showToast: false });
      }
    }
  }, [updateProjectImageSettings, markAsInteracted, selectedTextModel, projectImageSettings?.selectedLorasByCategory, loraManager, setHiresFixConfig, generationSource]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    generationSource,
    selectedTextModel,

    // Refs
    generationSourceRef,
    selectedTextModelRef,

    // Handlers
    handleGenerationSourceChange,
    handleTextModelChange,
  };
}
