/**
 * MediaLightbox Contexts
 *
 * Centralized context providers for shared lightbox state.
 */

// LightboxStateContext - Comprehensive shared state context with domain hooks
export {
  LightboxStateProvider,
  useLightboxState,
  useLightboxCore,
  useLightboxMedia,
  useLightboxVariants,
  useLightboxNavigation,
  useLightboxEdit,
  // Safe versions for components that may render outside provider
  useLightboxCoreSafe,
  useLightboxMediaSafe,
  useLightboxVariantsSafe,
  useLightboxNavigationSafe,
  useLightboxEditSafe,
} from './LightboxStateContext';

export type {
  LightboxStateValue,
  LightboxCoreState,
  LightboxMediaState,
  LightboxVariantState,
  LightboxNavigationState,
  LightboxEditState,
  LightboxStateProviderProps,
} from './LightboxStateContext';

// ImageEditContext - Image-specific edit state (inpaint, annotate, reposition, img2img)
export {
  ImageEditProvider,
  useImageEdit,
  useImageEditSafe,
  useIsImageLightbox,
} from './ImageEditContext';

export type {
  ImageEditState,
  ImageEditMode,
  ImageEditProviderProps,
} from './ImageEditContext';

// VideoEditContext - Video-specific edit state (trim, replace, regenerate, enhance)
export {
  VideoEditProvider,
  useVideoEdit,
  useVideoEditSafe,
  useIsVideoLightbox,
} from './VideoEditContext';

export type {
  VideoEditState,
  VideoEditSubMode,
  TrimState,
  EnhanceSettings,
  VideoEditProviderProps,
} from './VideoEditContext';

// EditFormContext - Form-specific state for edit panels (prompts, generation status)
export {
  EditFormProvider,
  useEditForm,
  useEditFormSafe,
  useHasEditForm,
} from './EditFormContext';

export type {
  EditFormState,
  LoraMode,
  EditFormProviderProps,
} from './EditFormContext';
