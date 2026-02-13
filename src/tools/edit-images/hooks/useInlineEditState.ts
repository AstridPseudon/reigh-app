import {
  useRef,
  useState,
  useEffect,
} from 'react';
import { GenerationRow } from '@/types/shots';
import { isVideoAny } from '@/shared/lib/typeGuards';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useProject } from '@/shared/contexts/ProjectContext';
import { useUserUIState } from '@/shared/hooks/useUserUIState';
import { usePublicLoras } from '@/shared/hooks/useResources';
import { TOOL_IDS } from '@/shared/lib/toolConstants';

import {
  useUpscale,
  useInpainting,
  useEditModeLoRAs,
  useSourceGeneration,
  useMagicEditMode,
  useStarToggle,
  useRepositionMode,
  useImg2ImgMode,
  useEditSettingsPersistence,
  useEditSettingsSync,
} from '@/shared/components/MediaLightbox/hooks';

import { downloadMedia } from '@/shared/components/MediaLightbox/utils';
import { useVariants } from '@/shared/hooks/useVariants';
import { useImageEditValue } from './useImageEditValue';

// ============================================================================
// useInlineEditState — all hook orchestration + persistence sync + memo
// ============================================================================

export function useInlineEditState(
  media: GenerationRow,
  _onClose: () => void,
  onNavigateToGeneration?: (generationId: string) => Promise<void>,
) {
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();
  const { selectedProjectId } = useProject();
  const { value: generationMethods } = useUserUIState('generationMethods', { onComputer: true, inCloud: true });
  const isCloudMode = generationMethods.inCloud;

  // Uses canonical isVideoAny from typeGuards
  const isVideo = isVideoAny(media);

  const upscaleHook = useUpscale({ media, selectedProjectId, isVideo });
  const {
    effectiveImageUrl,
    isUpscaling,
    handleUpscale,
  } = upscaleHook;

  // Image dimensions state (needed by inpainting hook)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Create as variant toggle - when true, creates variant; when false, creates new generation
  // Default to false (createAsGeneration=false means variant mode is ON)
  const [createAsGeneration, setCreateAsGeneration] = useState(false);

  const { isInSceneBoostEnabled, setIsInSceneBoostEnabled, loraMode, setLoraMode, customLoraUrl, setCustomLoraUrl, editModeLoRAs } = useEditModeLoRAs();

  // Variants hook - moved early so activeVariantId is available for other hooks
  // Detect if this is a shot_generation record (has shotImageEntryId or shot_generation_id matching media.id)
  const isShotGenerationRecord = media.shotImageEntryId === media.id ||
                                  media.shot_generation_id === media.id;
  const actualGenerationId = media.generation_id ||
                              (!isShotGenerationRecord ? media.id : null);

  // Edit settings persistence - for img2img strength, enablePromptExpansion, and editMode
  const editSettingsPersistence = useEditSettingsPersistence({
    generationId: actualGenerationId,
    projectId: selectedProjectId,
  });
  const {
    editMode: persistedEditMode,
    setEditMode: setPersistedEditMode,
    img2imgStrength: persistedImg2imgStrength,
    img2imgEnablePromptExpansion: persistedImg2imgEnablePromptExpansion,
    img2imgPrompt: persistedImg2imgPrompt,
    img2imgPromptHasBeenSet: persistedImg2imgPromptHasBeenSet,
    setImg2imgStrength: setPersistedImg2imgStrength,
    setImg2imgEnablePromptExpansion: setPersistedImg2imgEnablePromptExpansion,
    setImg2imgPrompt: setPersistedImg2imgPrompt,
    prompt: persistedPrompt,
    setPrompt: setPersistedPrompt,
    numGenerations,
    setNumGenerations,
    isReady: isEditSettingsReady,
    hasPersistedSettings,
  } = editSettingsPersistence;
  const {
    activeVariant,
    setActiveVariantId,
    refetch: refetchVariants,
  } = useVariants({
    generationId: actualGenerationId,
    enabled: true,
  });

  const inpaintingHook = useInpainting({
    media,
    selectedProjectId,
    isVideo,
    displayCanvasRef,
    maskCanvasRef,
    imageContainerRef,
    imageDimensions,
    handleExitInpaintMode: () => {},
    loras: editModeLoRAs,
    toolTypeOverride: TOOL_IDS.EDIT_IMAGES,
    activeVariantId: activeVariant?.id, // Store strokes per-variant, not per-generation
    createAsGeneration, // If true, create a new generation instead of a variant
  });
  const {
    isInpaintMode,
    brushStrokes,
    isEraseMode,
    inpaintPrompt,
    inpaintNumGenerations,
    brushSize,
    isGeneratingInpaint,
    inpaintGenerateSuccess,
    isAnnotateMode,
    editMode,
    annotationMode,
    selectedShapeId,
    isDrawing,
    currentStroke,
    setIsInpaintMode,
    setIsEraseMode,
    setInpaintPrompt,
    setInpaintNumGenerations,
    setBrushSize,
    setIsAnnotateMode,
    setEditMode,
    setAnnotationMode,
    handleKonvaPointerDown,
    handleKonvaPointerMove,
    handleKonvaPointerUp,
    handleShapeClick,
    handleUndo,
    handleClearMask,
    handleEnterInpaintMode,
    handleGenerateInpaint,
    handleGenerateAnnotatedEdit,
    handleDeleteSelected,
    handleToggleFreeForm,
    getDeleteButtonPosition,
    strokeOverlayRef,
    onStrokeComplete,
    onStrokesChange,
    onSelectionChange,
    onTextModeHint,
  } = inpaintingHook;

  const magicEditHook = useMagicEditMode({
    media,
    selectedProjectId,
    isVideo,
    isInpaintMode,
    setIsInpaintMode,
    handleEnterInpaintMode,
    handleGenerateInpaint,
    brushStrokes,
    inpaintPrompt,
    setInpaintPrompt,
    inpaintNumGenerations,
    setInpaintNumGenerations,
    editModeLoRAs,
    sourceUrlForTasks: effectiveImageUrl,
    imageDimensions,
    isInSceneBoostEnabled,
    setIsInSceneBoostEnabled,
    toolTypeOverride: TOOL_IDS.EDIT_IMAGES,
    createAsGeneration, // If true, create a new generation instead of a variant
    // qwenEditModel not passed - uses default 'qwen-edit'
  });
  const {
    isCreatingMagicEditTasks,
    magicEditTasksCreated,
    inpaintPanelPosition,
    setInpaintPanelPosition,
    handleEnterMagicEditMode,
    handleExitMagicEditMode,
    handleUnifiedGenerate,
    isSpecialEditMode
  } = magicEditHook;

  const repositionHook = useRepositionMode({
    media,
    selectedProjectId,
    imageDimensions,
    imageContainerRef,
    loras: editModeLoRAs,
    inpaintPrompt,
    inpaintNumGenerations,
    handleExitInpaintMode: handleExitMagicEditMode,
    toolTypeOverride: TOOL_IDS.EDIT_IMAGES,
    onVariantCreated: setActiveVariantId,
    refetchVariants,
    createAsGeneration, // If true, create a new generation instead of a variant
  });
  const {
    transform: repositionTransform,
    hasTransformChanges,
    isGeneratingReposition,
    repositionGenerateSuccess,
    isSavingAsVariant,
    saveAsVariantSuccess,
    setScale,
    setRotation,
    toggleFlipH,
    toggleFlipV,
    resetTransform,
    handleGenerateReposition,
    handleSaveAsVariant,
    getTransformStyle,
    isDragging: isRepositionDragging,
    dragHandlers: repositionDragHandlers,
  } = repositionHook;

  // Fetch available LoRAs for img2img mode
  const { data: availableLoras } = usePublicLoras();

  // Img2Img mode hook - uses persisted settings

  const img2imgHook = useImg2ImgMode({
    media,
    selectedProjectId,
    isVideo,
    sourceUrlForTasks: effectiveImageUrl,
    toolTypeOverride: TOOL_IDS.EDIT_IMAGES,
    createAsGeneration,
    availableLoras,
    // Pass persisted values
    img2imgStrength: persistedImg2imgStrength,
    setImg2imgStrength: setPersistedImg2imgStrength,
    enablePromptExpansion: persistedImg2imgEnablePromptExpansion,
    setEnablePromptExpansion: setPersistedImg2imgEnablePromptExpansion,
    // Img2Img prompt is persisted separately to avoid cross-mode races
    img2imgPrompt: persistedImg2imgPrompt,
    setImg2imgPrompt: setPersistedImg2imgPrompt,
    img2imgPromptHasBeenSet: persistedImg2imgPromptHasBeenSet,
    // Number of generations (shared with other edit modes)
    numGenerations,
  });
  const {
    img2imgPrompt,
    img2imgStrength,
    enablePromptExpansion,
    isGeneratingImg2Img,
    img2imgGenerateSuccess,
    setImg2imgPrompt,
    setImg2imgStrength,
    setEnablePromptExpansion,
    handleGenerateImg2Img,
    loraManager: img2imgLoraManager,
  } = img2imgHook;

  // ========================================
  // Persistence sync (bidirectional: persistence <-> inpainting UI state)
  // ========================================

  useEditSettingsSync({
    actualGenerationId,
    isEditSettingsReady,
    hasPersistedSettings,
    persistedEditMode,
    persistedNumGenerations: numGenerations,
    persistedPrompt,
    editMode,
    inpaintNumGenerations,
    inpaintPrompt,
    setEditMode,
    setInpaintNumGenerations,
    setInpaintPrompt,
    setPersistedEditMode,
    setPersistedNumGenerations: setNumGenerations,
    setPersistedPrompt,
  });

  const { sourceGenerationData } = useSourceGeneration({
    media,
    onOpenExternalGeneration: onNavigateToGeneration ?
      async (id) => onNavigateToGeneration(id) : undefined
  });

  const starToggleHook = useStarToggle({ media });
  const { localStarred, toggleStarMutation, handleToggleStar } = starToggleHook;

  const handleDownload = async () => {
    await downloadMedia(effectiveImageUrl, media.id, isVideo, media.contentType);
  };

  useEffect(() => {
    if (!isSpecialEditMode) {
       handleEnterMagicEditMode();
    }
  }, [isSpecialEditMode, handleEnterMagicEditMode]);

  // ========================================
  // Build unified ImageEditState value (mode + form + generation status)
  // ========================================

  const imageEditValue = useImageEditValue({
    // Mode state
    isInpaintMode,
    isSpecialEditMode,
    editMode,

    // Mode setters
    setIsInpaintMode,
    setEditMode,

    // Mode entry/exit handlers
    handleEnterInpaintMode,
    handleExitMagicEditMode,
    handleEnterMagicEditMode,

    // Brush/Inpaint state
    brushSize,
    setBrushSize,
    isEraseMode,
    setIsEraseMode,
    brushStrokes,

    // Annotation state
    isAnnotateMode,
    setIsAnnotateMode,
    annotationMode,
    setAnnotationMode,
    selectedShapeId,

    // Canvas interaction
    onStrokeComplete,
    onStrokesChange,
    onSelectionChange,
    onTextModeHint,
    strokeOverlayRef,
    getDeleteButtonPosition,
    handleToggleFreeForm,
    handleDeleteSelected,

    // Undo/Clear
    handleUndo,
    handleClearMask,

    // Reposition state
    repositionTransform,
    hasTransformChanges,
    isRepositionDragging,
    repositionDragHandlers,
    getTransformStyle,
    setScale,
    setRotation,
    toggleFlipH,
    toggleFlipV,
    resetTransform,

    // Display refs
    imageContainerRef,

    // Panel UI state
    inpaintPanelPosition,
    setInpaintPanelPosition,

    // Inpaint form
    inpaintPrompt,
    setInpaintPrompt,
    inpaintNumGenerations,
    setInpaintNumGenerations,

    // Img2Img form
    img2imgPrompt,
    setImg2imgPrompt,
    img2imgStrength,
    setImg2imgStrength,
    enablePromptExpansion,
    setEnablePromptExpansion,

    // LoRA mode
    loraMode,
    setLoraMode,
    customLoraUrl,
    setCustomLoraUrl,

    // Generation options
    createAsGeneration,
    setCreateAsGeneration,

    // Generation status
    isGeneratingInpaint,
    inpaintGenerateSuccess,
    isGeneratingImg2Img,
    img2imgGenerateSuccess,
    isGeneratingReposition,
    repositionGenerateSuccess,
    isSavingAsVariant,
    saveAsVariantSuccess,
    isCreatingMagicEditTasks,
    magicEditTasksCreated,
  });

  return {
    // Layout / env
    isMobile,
    selectedProjectId,
    isCloudMode,
    isVideo,

    // Refs
    imageContainerRef,

    // Display state
    effectiveImageUrl,
    imageDimensions,
    setImageDimensions,

    // Upscale
    isUpscaling,
    handleUpscale,

    // Inpainting canvas state
    isInpaintMode,
    editMode,
    brushStrokes,
    currentStroke,
    isDrawing,
    isEraseMode,
    brushSize,
    annotationMode,
    selectedShapeId,
    isAnnotateMode,
    handleKonvaPointerDown,
    handleKonvaPointerMove,
    handleKonvaPointerUp,
    handleShapeClick,
    strokeOverlayRef,

    // Annotation actions
    getDeleteButtonPosition,
    handleToggleFreeForm,
    handleDeleteSelected,

    // Mode controls
    setIsInpaintMode,
    setEditMode,
    setBrushSize,
    setIsEraseMode,
    setAnnotationMode,
    isSpecialEditMode,
    handleEnterMagicEditMode,

    // Floating tool controls
    repositionTransform,
    setScale,
    setRotation,
    toggleFlipH,
    toggleFlipV,
    resetTransform,
    handleUndo,
    handleClearMask,
    inpaintPanelPosition,
    setInpaintPanelPosition,

    // Reposition transform style
    getTransformStyle,

    // Star toggle
    localStarred,
    toggleStarMutation,
    handleToggleStar,

    // Download
    handleDownload,

    // EditModePanel props
    sourceGenerationData,
    handleUnifiedGenerate,
    handleGenerateAnnotatedEdit,
    handleGenerateReposition,
    handleSaveAsVariant,
    handleGenerateImg2Img,
    img2imgLoraManager,
    availableLoras,
    imageEditValue,
  };
}
