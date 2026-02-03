/**
 * ImageGenerationForm state types
 *
 * Defines the UI state shape and action types for the reducer.
 * Form settings (persisted values) remain as useState with usePersistentToolState.
 */

// ============================================================================
// UI State (managed by reducer)
// ============================================================================

export interface ImageGenerationFormUIState {
  // Modal states
  isPromptModalOpen: boolean;
  openPromptModalWithAIExpanded: boolean;
  isCreateShotModalOpen: boolean;
  // Note: LORA modal is managed by loraManager, not this state

  // Active prompt tracking
  directFormActivePromptId: string | null;

  // Session tracking
  hasVisitedImageGeneration: boolean;
}

// ============================================================================
// Action Types
// ============================================================================

export type ImageGenerationFormUIAction =
  | { type: 'SET_PROMPT_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_PROMPT_MODAL_WITH_AI_EXPANDED'; payload: boolean }
  | { type: 'SET_CREATE_SHOT_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_ACTIVE_PROMPT_ID'; payload: string | null }
  | { type: 'SET_HAS_VISITED'; payload: boolean }
  | { type: 'OPEN_PROMPT_MODAL'; payload: { withAI?: boolean } }
  | { type: 'CLOSE_PROMPT_MODAL' };

// ============================================================================
// Initial State Factory
// ============================================================================

export const createInitialUIState = (): ImageGenerationFormUIState => {
  // Check session storage for visit tracking
  let hasVisited = false;
  try {
    hasVisited = typeof window !== 'undefined' &&
      window.sessionStorage.getItem('hasVisitedImageGeneration') === 'true';
  } catch {
    // Ignore sessionStorage errors
  }

  return {
    isPromptModalOpen: false,
    openPromptModalWithAIExpanded: false,
    isCreateShotModalOpen: false,
    directFormActivePromptId: null,
    hasVisitedImageGeneration: hasVisited,
  };
};
