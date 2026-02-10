/**
 * ImageEditContext
 *
 * Single context for all image edit state in the lightbox.
 * Only provided by ImageLightbox, not VideoLightbox.
 *
 * The state is composed from domain sub-interfaces:
 *   EditModeState         – which edit mode is active, entry/exit handlers
 *   BrushToolState        – inpaint brush, erase, undo/clear, panel position
 *   AnnotationToolState   – shape annotations
 *   CanvasInteractionState – stroke overlay callbacks & refs
 *   RepositionState       – image transform + interaction handlers
 *   DisplayRefsState      – container ref, flip, saving
 *   EditFormState         – prompts, strengths, LoRA, model, advanced settings
 *   GenerationStatusState – loading/success feedback for all edit modes
 *
 * Components consume via useImageEditSafe() and destructure what they need.
 */

import React, { createContext, useContext } from 'react';
import type { BrushStroke, AnnotationMode } from '../hooks/inpainting/types';
import type { ImageTransform } from '../hooks/useRepositionMode';
import type { StrokeOverlayHandle } from '../components/StrokeOverlay';
import type {
  LoraMode,
  QwenEditModel,
  EditAdvancedSettings,
} from '../hooks/editSettingsTypes';
import { DEFAULT_ADVANCED_SETTINGS } from '../hooks/editSettingsTypes';

export type { LoraMode };

// ============================================================================
// Sub-Interfaces
// ============================================================================

type ImageEditMode = 'inpaint' | 'annotate' | 'reposition' | 'img2img' | 'text' | 'upscale' | null;

/** Which edit mode is active, plus entry/exit handlers */
interface EditModeState {
  isInpaintMode: boolean;
  isMagicEditMode: boolean;
  isSpecialEditMode: boolean;
  editMode: ImageEditMode;
  setIsInpaintMode: (value: boolean) => void;
  setIsMagicEditMode: (value: boolean) => void;
  setEditMode: (mode: ImageEditMode) => void;
  handleEnterInpaintMode: () => void;
  handleExitInpaintMode: () => void;
  handleEnterMagicEditMode: () => void;
  handleExitMagicEditMode: () => void;
}

/** Inpaint brush tool: size, erase mode, strokes, undo/clear, panel position */
interface BrushToolState {
  brushSize: number;
  setBrushSize: (size: number) => void;
  isEraseMode: boolean;
  setIsEraseMode: (value: boolean) => void;
  brushStrokes: BrushStroke[];
  handleUndo: () => void;
  handleClearMask: () => void;
  inpaintPanelPosition: 'left' | 'right';
  setInpaintPanelPosition: (pos: 'left' | 'right') => void;
}

/** Shape annotation tool */
interface AnnotationToolState {
  isAnnotateMode: boolean;
  setIsAnnotateMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  annotationMode: AnnotationMode;
  setAnnotationMode: (mode: AnnotationMode | ((prev: AnnotationMode) => AnnotationMode)) => void;
  selectedShapeId: string | null;
}

/** Canvas overlay callbacks and refs (stroke/annotation interaction) */
interface CanvasInteractionState {
  onStrokeComplete: (stroke: BrushStroke) => void;
  onStrokesChange: (strokes: BrushStroke[]) => void;
  onSelectionChange: (shapeId: string | null) => void;
  onTextModeHint: () => void;
  strokeOverlayRef: React.RefObject<StrokeOverlayHandle>;
  getDeleteButtonPosition: () => { x: number; y: number } | null;
  handleToggleFreeForm: () => void;
  handleDeleteSelected: () => void;
}

/** Image reposition/transform state + interaction handlers */
interface RepositionState {
  repositionTransform: ImageTransform | null;
  hasTransformChanges: boolean;
  isRepositionDragging: boolean;
  repositionDragHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
  } | null;
  getTransformStyle: () => string;
  setScale: (value: number) => void;
  setRotation: (value: number) => void;
  toggleFlipH: () => void;
  toggleFlipV: () => void;
  resetTransform: () => void;
}

/** Display refs and visual state */
interface DisplayRefsState {
  imageContainerRef: React.RefObject<HTMLDivElement>;
  isFlippedHorizontally: boolean;
  isSaving: boolean;
}

/** Prompts, strengths, LoRA, model selection, advanced settings */
interface EditFormState {
  inpaintPrompt: string;
  setInpaintPrompt: (value: string) => void;
  inpaintNumGenerations: number;
  setInpaintNumGenerations: (value: number) => void;
  img2imgPrompt: string;
  setImg2imgPrompt: (value: string) => void;
  img2imgStrength: number;
  setImg2imgStrength: (value: number) => void;
  enablePromptExpansion: boolean;
  setEnablePromptExpansion: (value: boolean) => void;
  loraMode: LoraMode;
  setLoraMode: (mode: LoraMode) => void;
  customLoraUrl: string;
  setCustomLoraUrl: (url: string) => void;
  createAsGeneration: boolean;
  setCreateAsGeneration: (value: boolean) => void;
  qwenEditModel: QwenEditModel;
  setQwenEditModel: (model: QwenEditModel) => void;
  advancedSettings: EditAdvancedSettings;
  setAdvancedSettings: (settings: EditAdvancedSettings) => void;
}

/** Loading/success flags for all edit modes */
interface GenerationStatusState {
  isGeneratingInpaint: boolean;
  inpaintGenerateSuccess: boolean;
  isGeneratingImg2Img: boolean;
  img2imgGenerateSuccess: boolean;
  isGeneratingReposition: boolean;
  repositionGenerateSuccess: boolean;
  isSavingAsVariant: boolean;
  saveAsVariantSuccess: boolean;
  isCreatingMagicEditTasks: boolean;
  magicEditTasksCreated: boolean;
}

// ============================================================================
// Composed Type
// ============================================================================

/**
 * Full image edit state, composed from domain sub-interfaces.
 * Consumers destructure the fields they need — the flat shape makes this natural.
 */
export type ImageEditState =
  EditModeState &
  BrushToolState &
  AnnotationToolState &
  CanvasInteractionState &
  RepositionState &
  DisplayRefsState &
  EditFormState &
  GenerationStatusState;

// ============================================================================
// Defaults (one per sub-interface, composed into EMPTY_IMAGE_EDIT)
// ============================================================================

const DEFAULT_MODE: EditModeState = {
  isInpaintMode: false,
  isMagicEditMode: false,
  isSpecialEditMode: false,
  editMode: null,
  setIsInpaintMode: () => {},
  setIsMagicEditMode: () => {},
  setEditMode: () => {},
  handleEnterInpaintMode: () => {},
  handleExitInpaintMode: () => {},
  handleEnterMagicEditMode: () => {},
  handleExitMagicEditMode: () => {},
};

const DEFAULT_BRUSH: BrushToolState = {
  brushSize: 20,
  setBrushSize: () => {},
  isEraseMode: false,
  setIsEraseMode: () => {},
  brushStrokes: [],
  handleUndo: () => {},
  handleClearMask: () => {},
  inpaintPanelPosition: 'right',
  setInpaintPanelPosition: () => {},
};

const DEFAULT_ANNOTATION: AnnotationToolState = {
  isAnnotateMode: false,
  setIsAnnotateMode: () => {},
  annotationMode: null,
  setAnnotationMode: () => {},
  selectedShapeId: null,
};

const EMPTY_CANVAS_INTERACTION: CanvasInteractionState = {
  onStrokeComplete: () => {},
  onStrokesChange: () => {},
  onSelectionChange: () => {},
  onTextModeHint: () => {},
  strokeOverlayRef: { current: null } as React.RefObject<StrokeOverlayHandle>,
  getDeleteButtonPosition: () => null,
  handleToggleFreeForm: () => {},
  handleDeleteSelected: () => {},
};

const DEFAULT_REPOSITION: RepositionState = {
  repositionTransform: null,
  hasTransformChanges: false,
  isRepositionDragging: false,
  repositionDragHandlers: null,
  getTransformStyle: () => '',
  setScale: () => {},
  setRotation: () => {},
  toggleFlipH: () => {},
  toggleFlipV: () => {},
  resetTransform: () => {},
};

const EMPTY_DISPLAY_REFS: DisplayRefsState = {
  imageContainerRef: { current: null } as React.RefObject<HTMLDivElement>,
  isFlippedHorizontally: false,
  isSaving: false,
};

const DEFAULT_FORM: EditFormState = {
  inpaintPrompt: '',
  setInpaintPrompt: () => {},
  inpaintNumGenerations: 1,
  setInpaintNumGenerations: () => {},
  img2imgPrompt: '',
  setImg2imgPrompt: () => {},
  img2imgStrength: 0.6,
  setImg2imgStrength: () => {},
  enablePromptExpansion: false,
  setEnablePromptExpansion: () => {},
  loraMode: 'none',
  setLoraMode: () => {},
  customLoraUrl: '',
  setCustomLoraUrl: () => {},
  createAsGeneration: false,
  setCreateAsGeneration: () => {},
  qwenEditModel: 'qwen-edit-2511',
  setQwenEditModel: () => {},
  advancedSettings: DEFAULT_ADVANCED_SETTINGS,
  setAdvancedSettings: () => {},
};

const DEFAULT_STATUS: GenerationStatusState = {
  isGeneratingInpaint: false,
  inpaintGenerateSuccess: false,
  isGeneratingImg2Img: false,
  img2imgGenerateSuccess: false,
  isGeneratingReposition: false,
  repositionGenerateSuccess: false,
  isSavingAsVariant: false,
  saveAsVariantSuccess: false,
  isCreatingMagicEditTasks: false,
  magicEditTasksCreated: false,
};

const EMPTY_IMAGE_EDIT: ImageEditState = {
  ...DEFAULT_MODE,
  ...DEFAULT_BRUSH,
  ...DEFAULT_ANNOTATION,
  ...EMPTY_CANVAS_INTERACTION,
  ...DEFAULT_REPOSITION,
  ...EMPTY_DISPLAY_REFS,
  ...DEFAULT_FORM,
  ...DEFAULT_STATUS,
};

// ============================================================================
// Context + Provider
// ============================================================================

const ImageEditContext = createContext<ImageEditState | null>(null);

interface ImageEditProviderProps {
  children: React.ReactNode;
  value: ImageEditState;
}

export const ImageEditProvider: React.FC<ImageEditProviderProps> = ({
  children,
  value,
}) => {
  return (
    <ImageEditContext.Provider value={value}>
      {children}
    </ImageEditContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Returns image edit state, or safe defaults when used outside ImageEditProvider.
 * Consumers destructure just the fields they need.
 */
export function useImageEditSafe(): ImageEditState {
  const context = useContext(ImageEditContext);
  return context ?? EMPTY_IMAGE_EDIT;
}
