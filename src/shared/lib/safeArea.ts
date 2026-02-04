/**
 * Safe area utilities for handling mobile device notches and system UI.
 */

/**
 * Calculate safe area insets for positioning UI elements.
 * Returns CSS calc() values that account for device safe areas.
 */
export function safeAreaCalc(base: string, inset: 'top' | 'bottom' | 'left' | 'right'): string {
  const envVar = `safe-area-inset-${inset}`;
  return `calc(${base} + env(${envVar}, 0px))`;
}
