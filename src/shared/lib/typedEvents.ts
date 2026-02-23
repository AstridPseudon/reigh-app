/**
 * Typed Custom Event Bus
 * ======================
 *
 * Provides type-safe helpers for dispatching and listening to custom DOM events
 * used for cross-component communication.
 *
 * All custom event types are declared in AppCustomEvents so dispatch/listen
 * sites are type-checked against a single source of truth.
 */

import { useEffect } from 'react';

/** Registry of all custom events and their detail shapes. */
export interface AppCustomEvents {
  // --- UI / navigation ---
  openSettings: { tab?: string };
  selectShotForAddition: { shotId: string; shotName: string };
  'app:scrollToTop': { behavior?: ScrollBehavior };
  mobilePaneOpen: { side: string | null };
  openGenerationsPane: void;
  openGenerationModal: void;
  closeGenerationModal: void;

  // --- Generation / gallery ---
  'generation-star-updated': { generationId: string; shotId: string; starred: boolean };
  'generation-settings-changed': void;
  'videogallery-cache-updated': { projectId: string; updatedUrls: string[] };
  mobileSelectionActive: boolean;

  // --- Shot lifecycle ---
  'shot-pending-create': { imageCount: number };
  'shot-pending-create-clear': void;
  'shot-pending-upload': { shotId: string; expectedCount: number };

  // --- Timeline ---
  'timeline:duplicate-complete': { shotId: string; newItemId: string };
  'timeline:pending-add': { frame: number; shotId?: string };

  // --- Editor ---
  shotEditorRecovery: { shotId?: string; reason: string };

  // --- Persistence ---
  persistentStateChange: { key: string; value: unknown };

  // --- Realtime infrastructure ---
  'realtime:auth-heal': {
    source: string;
    reason: string;
    priority: string;
    coalescedSources: string[];
    coalescedReasons: string[];
    timestamp: number;
  };
  'realtime:generation-update-batch': {
    payloads: Array<{ generationId: string; upscaleCompleted?: boolean }>;
  };
  'realtime:variant-change-batch': {
    affectedGenerationIds: string[];
  };
}

// Helper: events whose detail is void can be dispatched without a second arg.
type VoidEvents = { [K in keyof AppCustomEvents]: AppCustomEvents[K] extends void ? K : never }[keyof AppCustomEvents];

/**
 * Dispatch a typed custom event on `window`.
 *
 * @example
 * dispatchAppEvent('openSettings', { tab: 'credits' });
 * dispatchAppEvent('openGenerationsPane');
 */
export function dispatchAppEvent<K extends VoidEvents>(type: K): void;
export function dispatchAppEvent<K extends keyof AppCustomEvents>(
  type: K,
  detail: AppCustomEvents[K],
): void;
export function dispatchAppEvent<K extends keyof AppCustomEvents>(
  type: K,
  detail?: AppCustomEvents[K],
): void {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

/**
 * React hook that subscribes to a typed custom event on `window`.
 * Automatically cleans up on unmount.
 *
 * @example
 * useAppEventListener('generation-star-updated', ({ generationId, starred }) => {
 *   console.log(generationId, starred);
 * });
 */
export function useAppEventListener<K extends keyof AppCustomEvents>(
  type: K,
  handler: (detail: AppCustomEvents[K]) => void,
): void {
  useEffect(() => {
    const listener = (event: Event) => {
      handler((event as CustomEvent<AppCustomEvents[K]>).detail);
    };

    window.addEventListener(type, listener);
    return () => window.removeEventListener(type, listener);
  }, [type, handler]);
}

/**
 * Non-React listener for use in classes / plain modules.
 * Returns an unsubscribe function.
 *
 * @example
 * const unsub = listenAppEvent('realtime:auth-heal', (detail) => { ... });
 * // later: unsub();
 */
export function listenAppEvent<K extends keyof AppCustomEvents>(
  type: K,
  handler: (detail: AppCustomEvents[K]) => void,
): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent<AppCustomEvents[K]>).detail);
  };
  window.addEventListener(type, listener);
  return () => window.removeEventListener(type, listener);
}
