/**
 * MediaLightbox Contexts
 *
 * Centralized context providers for shared lightbox state.
 */

// LightboxVariantContext - Original variant-specific context (kept for backwards compat)
export {
  LightboxVariantProvider,
  useLightboxVariantContext,
} from './LightboxVariantContext';

// LightboxStateContext - Comprehensive shared state context
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
