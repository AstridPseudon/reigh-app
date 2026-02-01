/**
 * Handles task generation for inpainting and annotated edits.
 * Exports mask from Konva, uploads to storage, and creates tasks.
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { GenerationRow } from '@/types/shots';
import { uploadImageToStorage } from '@/shared/lib/imageUploader';
import { createImageInpaintTask } from '@/shared/lib/tasks/imageInpaint';
import { createAnnotatedImageEditTask } from '@/shared/lib/tasks/annotatedImageEdit';
import type { StrokeOverlayHandle } from '../../components/StrokeOverlay';
import type { BrushStroke, EditAdvancedSettings, QwenEditModel } from './types';

// Import the converter function
import { convertToHiresFixApiParams } from '../useGenerationEditSettings';

interface UseTaskGenerationProps {
  media: GenerationRow;
  selectedProjectId: string | null;
  shotId?: string;
  toolTypeOverride?: string;
  isVideo: boolean;
  loras?: Array<{ url: string; strength: number }>;
  activeVariantId?: string | null;
  activeVariantLocation?: string | null;
  createAsGeneration?: boolean;
  advancedSettings?: EditAdvancedSettings;
  qwenEditModel?: QwenEditModel;
  // State
  inpaintStrokes: BrushStroke[];
  annotationStrokes: BrushStroke[];
  inpaintPrompt: string;
  inpaintNumGenerations: number;
  // Refs
  strokeOverlayRef: React.RefObject<StrokeOverlayHandle>;
  // Callbacks
  handleExitInpaintMode: () => void;
  setIsGeneratingInpaint: (isGenerating: boolean) => void;
  setInpaintGenerateSuccess: (success: boolean) => void;
}

export function useTaskGeneration({
  media,
  selectedProjectId,
  shotId,
  toolTypeOverride,
  isVideo,
  loras,
  activeVariantId,
  activeVariantLocation,
  createAsGeneration,
  advancedSettings,
  qwenEditModel,
  inpaintStrokes,
  annotationStrokes,
  inpaintPrompt,
  inpaintNumGenerations,
  strokeOverlayRef,
  handleExitInpaintMode,
  setIsGeneratingInpaint,
  setInpaintGenerateSuccess,
}: UseTaskGenerationProps) {
  // Get actual generation ID (may differ from media.id for shot_generations)
  const actualGenerationId = (media as any).generation_id || media.id;

  /**
   * Generate inpaint task using Konva's native export
   */
  const handleGenerateInpaint = useCallback(async () => {
    console.log('[Inpaint] handleGenerateInpaint called', {
      selectedProjectId: selectedProjectId?.substring(0, 8),
      inpaintStrokesLength: inpaintStrokes.length,
      hasStrokeOverlayRef: !!strokeOverlayRef.current,
    });

    // Validation
    if (!selectedProjectId || isVideo) {
      toast.error('Cannot generate inpaint');
      return;
    }

    if (inpaintStrokes.length === 0) {
      toast.error('Please paint on the image first');
      return;
    }

    if (!inpaintPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    if (!strokeOverlayRef.current) {
      toast.error('Paint overlay not ready');
      return;
    }

    setIsGeneratingInpaint(true);
    try {
      // Export mask directly from Konva
      const maskImageData = strokeOverlayRef.current.exportMask({ pixelRatio: 1.5 });

      if (!maskImageData) {
        throw new Error('Failed to export mask from overlay');
      }

      console.log('[Inpaint] Mask exported from Konva');

      // Upload mask to storage
      const maskFile = await fetch(maskImageData)
        .then(res => res.blob())
        .then(blob => new File([blob], `inpaint_mask_${media.id}_${Date.now()}.png`, { type: 'image/png' }));

      const maskUrl = await uploadImageToStorage(maskFile);
      console.log('[Inpaint] Mask uploaded:', maskUrl);

      // Get source image URL
      const mediaUrl = (media as any).url || media.location || media.imageUrl;
      const sourceUrl = activeVariantLocation || mediaUrl;

      console.log('[Inpaint] Creating task', {
        generation_id: actualGenerationId.substring(0, 8),
        prompt: inpaintPrompt.substring(0, 30),
      });

      await createImageInpaintTask({
        project_id: selectedProjectId,
        image_url: sourceUrl,
        mask_url: maskUrl,
        prompt: inpaintPrompt,
        num_generations: inpaintNumGenerations,
        generation_id: actualGenerationId,
        shot_id: shotId,
        tool_type: toolTypeOverride,
        loras: loras,
        create_as_generation: createAsGeneration,
        source_variant_id: activeVariantId || undefined,
        hires_fix: convertToHiresFixApiParams(advancedSettings),
        qwen_edit_model: qwenEditModel,
      });

      console.log('[Inpaint] Task created successfully');

      // Show success state
      setInpaintGenerateSuccess(true);

      // Wait 1 second to show success, then exit
      setTimeout(() => {
        setInpaintGenerateSuccess(false);
        handleExitInpaintMode();
      }, 1000);

    } catch (error) {
      console.error('[Inpaint] Error creating inpaint task:', error);
      toast.error('Failed to create inpaint task');
    } finally {
      setIsGeneratingInpaint(false);
    }
  }, [
    selectedProjectId, isVideo, inpaintStrokes, inpaintPrompt, inpaintNumGenerations,
    media, handleExitInpaintMode, shotId, toolTypeOverride, loras,
    activeVariantLocation, activeVariantId, createAsGeneration, advancedSettings,
    qwenEditModel, strokeOverlayRef, actualGenerationId,
    setIsGeneratingInpaint, setInpaintGenerateSuccess
  ]);

  /**
   * Generate annotated edit task using Konva's native export
   */
  const handleGenerateAnnotatedEdit = useCallback(async () => {
    console.log('[AnnotateEdit] handleGenerateAnnotatedEdit called', {
      selectedProjectId: selectedProjectId?.substring(0, 8),
      annotationStrokesLength: annotationStrokes.length,
      hasStrokeOverlayRef: !!strokeOverlayRef.current,
    });

    // Validation
    if (!selectedProjectId || isVideo) {
      toast.error('Cannot generate annotated edit');
      return;
    }

    if (annotationStrokes.length === 0) {
      toast.error('Please draw an annotation rectangle');
      return;
    }

    if (!inpaintPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    if (!strokeOverlayRef.current) {
      toast.error('Annotation overlay not ready');
      return;
    }

    setIsGeneratingInpaint(true);
    try {
      // Export mask directly from Konva
      const maskImageData = strokeOverlayRef.current.exportMask({ pixelRatio: 1.5 });

      if (!maskImageData) {
        throw new Error('Failed to export mask from overlay');
      }

      console.log('[AnnotateEdit] Mask exported from Konva');

      // Upload mask to storage
      const maskFile = await fetch(maskImageData)
        .then(res => res.blob())
        .then(blob => new File([blob], `annotated_edit_mask_${media.id}_${Date.now()}.png`, { type: 'image/png' }));

      const maskUrl = await uploadImageToStorage(maskFile);
      console.log('[AnnotateEdit] Mask uploaded:', maskUrl);

      // Get source image URL
      const mediaUrl = (media as any).url || media.location || media.imageUrl;
      const sourceUrl = activeVariantLocation || mediaUrl;

      console.log('[AnnotateEdit] Creating task', {
        generation_id: actualGenerationId.substring(0, 8),
        prompt: inpaintPrompt.substring(0, 30),
      });

      await createAnnotatedImageEditTask({
        project_id: selectedProjectId,
        image_url: sourceUrl,
        mask_url: maskUrl,
        prompt: inpaintPrompt,
        num_generations: inpaintNumGenerations,
        generation_id: actualGenerationId,
        shot_id: shotId,
        tool_type: toolTypeOverride,
        loras: loras,
        create_as_generation: createAsGeneration,
        source_variant_id: activeVariantId || undefined,
        hires_fix: convertToHiresFixApiParams(advancedSettings),
        qwen_edit_model: qwenEditModel,
      });

      console.log('[AnnotateEdit] Task created successfully');

      // Show success state
      setInpaintGenerateSuccess(true);

      // Wait 1 second to show success, then exit
      setTimeout(() => {
        setInpaintGenerateSuccess(false);
        handleExitInpaintMode();
      }, 1000);

    } catch (error) {
      console.error('[AnnotateEdit] Error creating annotated edit task:', error);
      toast.error('Failed to create annotated edit task');
    } finally {
      setIsGeneratingInpaint(false);
    }
  }, [
    selectedProjectId, isVideo, annotationStrokes, inpaintPrompt, inpaintNumGenerations,
    media, handleExitInpaintMode, shotId, toolTypeOverride, loras,
    activeVariantLocation, activeVariantId, createAsGeneration, advancedSettings,
    qwenEditModel, strokeOverlayRef, actualGenerationId,
    setIsGeneratingInpaint, setInpaintGenerateSuccess
  ]);

  return {
    handleGenerateInpaint,
    handleGenerateAnnotatedEdit,
  };
}
