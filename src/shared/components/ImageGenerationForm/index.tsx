/**
 * ImageGenerationForm barrel
 *
 * Re-exports the main component and related types/components.
 * Main component logic is in ImageGenerationForm.tsx.
 */

// Main component
export { ImageGenerationForm } from './ImageGenerationForm';
export { ImageGenerationForm as default } from './ImageGenerationForm';

// Sub-components used elsewhere
export { PromptInputRow } from './components/PromptInputRow';

// Types
export type {
  PromptInputRowProps,
  PromptEntry,
  ImageGenerationFormHandles,
  GenerationMode,
  PromptMode,
  ReferenceMode,
  HiresFixConfig,
  GenerationSource,
  TextToImageModel,
} from './types';

// Context (for sections that need to pull from context)
export {
  ImageGenerationFormProvider,
  useImageGenerationFormContext,
  useFormUIContext,
  useFormCoreContext,
  useFormPromptsContext,
  useFormReferencesContext,
  useFormLorasContext,
  useContextValue,
} from './ImageGenerationFormContext';
export type {
  ImageGenerationFormContextValue,
  FormCoreState,
  FormPromptState,
  FormPromptHandlers,
  FormReferenceState,
  FormReferenceHandlers,
  FormLoraState,
  FormLoraHandlers,
} from './ImageGenerationFormContext';

// State (for advanced usage)
export { useFormUIState } from './state';
export type { FormUIActions, ImageGenerationFormUIState } from './state';
