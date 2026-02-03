/**
 * LightboxProviders
 *
 * Consolidates the context provider wrapping for ImageLightbox and VideoLightbox.
 * Both orchestrators compute their state values, then pass them here for consistent
 * provider composition.
 *
 * This eliminates duplicate provider nesting code and ensures consistent setup.
 */

import React from 'react';
import { LightboxStateProvider, type LightboxStateValue } from '../contexts/LightboxStateContext';

interface LightboxProvidersProps {
  /** The computed LightboxStateContext value from useLightboxStateValue */
  stateValue: LightboxStateValue;
  children: React.ReactNode;
}

/**
 * Wraps children with the necessary lightbox context providers.
 *
 * Usage:
 * ```tsx
 * const stateValue = useLightboxStateValue({...});
 * return (
 *   <LightboxProviders stateValue={stateValue}>
 *     <LightboxShell>...</LightboxShell>
 *   </LightboxProviders>
 * );
 * ```
 */
export function LightboxProviders({
  stateValue,
  children,
}: LightboxProvidersProps) {
  return (
    <LightboxStateProvider value={stateValue}>
      {children}
    </LightboxStateProvider>
  );
}
