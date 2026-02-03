/**
 * ImageGenerationForm - Re-exports from shared
 *
 * This component and all its sub-components have been moved to
 * shared/components/ImageGenerationForm/ because they're used by
 * shared/components/ImageGenerationModal and other shared components.
 *
 * Re-exported here for backwards compatibility with existing imports.
 */

// Main component
export { ImageGenerationForm, ImageGenerationForm as default } from '@/shared/components/ImageGenerationForm';

// Sub-components used elsewhere
export { PromptInputRow } from '@/shared/components/ImageGenerationForm';

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
} from '@/shared/components/ImageGenerationForm';

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
} from '@/shared/components/ImageGenerationForm';
export type {
  ImageGenerationFormContextValue,
  FormCoreState,
  FormPromptState,
  FormPromptHandlers,
  FormReferenceState,
  FormReferenceHandlers,
  FormLoraState,
  FormLoraHandlers,
} from '@/shared/components/ImageGenerationForm';

// State (for advanced usage)
export { useFormUIState } from '@/shared/components/ImageGenerationForm';
export type { FormUIActions, ImageGenerationFormUIState } from '@/shared/components/ImageGenerationForm';
