/**
 * Progressive Loading Settings
 *
 * Configuration for progressive image loading behavior.
 * Settings are currently baked-in (not runtime configurable).
 */

const SETTINGS = {
  enableProgressiveImages: true,
  crossfadeMs: 180,
};

/**
 * Check if progressive image loading is enabled
 */
export const isProgressiveLoadingEnabled = (): boolean => SETTINGS.enableProgressiveImages;
