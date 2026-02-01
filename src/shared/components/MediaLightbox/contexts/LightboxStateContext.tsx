/**
 * LightboxStateContext
 *
 * Provides shared state to deeply-nested lightbox components without prop drilling.
 * Organized into logical domains accessible via focused hooks:
 * - useLightboxCore() - onClose, readOnly, isMobile, selectedProjectId
 * - useLightboxMedia() - media, isVideo, effectiveUrls, dimensions
 * - useLightboxVariants() - variants, activeVariant, variant actions
 * - useLightboxNavigation() - navigation state and handlers
 * - useLightboxEdit() - edit mode state
 *
 * Components should prefer these hooks over prop drilling for commonly-used values.
 */

import React, { createContext, useContext, RefObject, useMemo } from 'react';
import type { GenerationRow } from '@/types/shots';

// ============================================================================
// Core State
// ============================================================================

interface LightboxCoreState {
  onClose: () => void;
  readOnly: boolean;
  isMobile: boolean;
  isTabletOrLarger: boolean;
  selectedProjectId: string | null;
  actualGenerationId: string | null;
}

// ============================================================================
// Media State
// ============================================================================

interface LightboxMediaState {
  media: GenerationRow;
  isVideo: boolean;
  effectiveMediaUrl: string;
  effectiveVideoUrl: string;
  effectiveImageDimensions: { width: number; height: number } | null;
  imageDimensions: { width: number; height: number } | null;
  setImageDimensions: (dims: { width: number; height: number }) => void;
}

// ============================================================================
// Variant State
// ============================================================================

interface LightboxVariantState {
  variants: any[];
  activeVariant: any;
  primaryVariant: any;
  isLoadingVariants: boolean;
  setActiveVariantId: (id: string) => void;
  setPrimaryVariant: (id: string) => void;
  deleteVariant: (id: string) => void;
  // Promotion
  promoteSuccess: boolean;
  isPromoting: boolean;
  handlePromoteToGeneration: (variantId: string) => Promise<void>;
  // Make main variant
  isMakingMainVariant: boolean;
  canMakeMainVariant: boolean;
  handleMakeMainVariant: () => Promise<void>;
  // Pending/unviewed counts (from existing LightboxVariantContext)
  pendingTaskCount: number;
  unviewedVariantCount: number;
  onMarkAllViewed: () => void;
  variantsSectionRef: RefObject<HTMLDivElement> | null;
}

// ============================================================================
// Navigation State
// ============================================================================

interface LightboxNavigationState {
  showNavigation: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  handleSlotNavNext: () => void;
  handleSlotNavPrev: () => void;
  swipeNavigation: {
    swipeHandlers: Record<string, any>;
    isSwiping: boolean;
    swipeOffset: number;
  };
}

// ============================================================================
// Edit State
// ============================================================================

interface LightboxEditState {
  isInpaintMode: boolean;
  isSpecialEditMode: boolean;
  isInVideoEditMode: boolean;
  editMode: string;
  setEditMode: (mode: string) => void;
  setIsInpaintMode: (value: boolean) => void;
}

// ============================================================================
// Combined Context Value
// ============================================================================

interface LightboxStateValue {
  core: LightboxCoreState;
  media: LightboxMediaState;
  variants: LightboxVariantState;
  navigation: LightboxNavigationState;
  edit: LightboxEditState;
}

const LightboxStateContext = createContext<LightboxStateValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export interface LightboxStateProviderProps {
  children: React.ReactNode;
  value: LightboxStateValue;
}

export const LightboxStateProvider: React.FC<LightboxStateProviderProps> = ({
  children,
  value,
}) => {
  return (
    <LightboxStateContext.Provider value={value}>
      {children}
    </LightboxStateContext.Provider>
  );
};

// ============================================================================
// Consumer Hooks
// ============================================================================

/**
 * Access the full lightbox state context.
 * Prefer the domain-specific hooks (useLightboxCore, useLightboxMedia, etc.)
 * for better code clarity.
 */
export function useLightboxState(): LightboxStateValue {
  const context = useContext(LightboxStateContext);
  if (!context) {
    throw new Error('useLightboxState must be used within a LightboxStateProvider');
  }
  return context;
}

/**
 * Access core lightbox state: onClose, readOnly, device info, project.
 */
export function useLightboxCore(): LightboxCoreState {
  const { core } = useLightboxState();
  return core;
}

/**
 * Access media state: current media, URLs, dimensions.
 */
export function useLightboxMedia(): LightboxMediaState {
  const { media } = useLightboxState();
  return media;
}

/**
 * Access variant state: variants list, active/primary variants, actions.
 */
export function useLightboxVariants(): LightboxVariantState {
  const { variants } = useLightboxState();
  return variants;
}

/**
 * Access navigation state: has next/previous, handlers.
 */
export function useLightboxNavigation(): LightboxNavigationState {
  const { navigation } = useLightboxState();
  return navigation;
}

/**
 * Access edit state: edit mode, inpaint mode, etc.
 */
export function useLightboxEdit(): LightboxEditState {
  const { edit } = useLightboxState();
  return edit;
}

// ============================================================================
// Safe Hooks (for use outside provider - returns defaults)
// ============================================================================

const EMPTY_CORE: LightboxCoreState = {
  onClose: () => {},
  readOnly: true,
  isMobile: false,
  isTabletOrLarger: true,
  selectedProjectId: null,
  actualGenerationId: null,
};

const EMPTY_MEDIA: LightboxMediaState = {
  media: {} as GenerationRow,
  isVideo: false,
  effectiveMediaUrl: '',
  effectiveVideoUrl: '',
  effectiveImageDimensions: null,
  imageDimensions: null,
  setImageDimensions: () => {},
};

const EMPTY_VARIANTS: LightboxVariantState = {
  variants: [],
  activeVariant: null,
  primaryVariant: null,
  isLoadingVariants: false,
  setActiveVariantId: () => {},
  setPrimaryVariant: () => {},
  deleteVariant: () => {},
  promoteSuccess: false,
  isPromoting: false,
  handlePromoteToGeneration: async () => {},
  isMakingMainVariant: false,
  canMakeMainVariant: false,
  handleMakeMainVariant: async () => {},
  pendingTaskCount: 0,
  unviewedVariantCount: 0,
  onMarkAllViewed: () => {},
  variantsSectionRef: null,
};

const EMPTY_NAVIGATION: LightboxNavigationState = {
  showNavigation: false,
  hasNext: false,
  hasPrevious: false,
  handleSlotNavNext: () => {},
  handleSlotNavPrev: () => {},
  swipeNavigation: {
    swipeHandlers: {},
    isSwiping: false,
    swipeOffset: 0,
  },
};

const EMPTY_EDIT: LightboxEditState = {
  isInpaintMode: false,
  isSpecialEditMode: false,
  isInVideoEditMode: false,
  editMode: 'text',
  setEditMode: () => {},
  setIsInpaintMode: () => {},
};

/**
 * Safe version of useLightboxCore that returns defaults when used outside provider.
 * Use this in components that may render outside the lightbox context.
 */
export function useLightboxCoreSafe(): LightboxCoreState {
  const context = useContext(LightboxStateContext);
  return context?.core ?? EMPTY_CORE;
}

/**
 * Safe version of useLightboxMedia that returns defaults when used outside provider.
 */
export function useLightboxMediaSafe(): LightboxMediaState {
  const context = useContext(LightboxStateContext);
  return context?.media ?? EMPTY_MEDIA;
}

/**
 * Safe version of useLightboxVariants that returns defaults when used outside provider.
 */
export function useLightboxVariantsSafe(): LightboxVariantState {
  const context = useContext(LightboxStateContext);
  return context?.variants ?? EMPTY_VARIANTS;
}

/**
 * Safe version of useLightboxNavigation that returns defaults when used outside provider.
 */
export function useLightboxNavigationSafe(): LightboxNavigationState {
  const context = useContext(LightboxStateContext);
  return context?.navigation ?? EMPTY_NAVIGATION;
}

/**
 * Safe version of useLightboxEdit that returns defaults when used outside provider.
 */
export function useLightboxEditSafe(): LightboxEditState {
  const context = useContext(LightboxStateContext);
  return context?.edit ?? EMPTY_EDIT;
}

// ============================================================================
// Export Types
// ============================================================================

export type {
  LightboxStateValue,
  LightboxCoreState,
  LightboxMediaState,
  LightboxVariantState,
  LightboxNavigationState,
  LightboxEditState,
};

export default LightboxStateContext;
