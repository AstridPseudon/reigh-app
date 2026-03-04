import type { RefObject } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { GenerationRow, Shot } from '@/domains/generation/types';
import type { DerivedItem } from '@/domains/generation/hooks/useDerivedItems';
import type { GenerationVariant } from '@/shared/hooks/useVariants';
import type { ShotOption, QuickCreateSuccess, LightboxDeleteHandler } from '../../types';
import type { SourceVariantData } from '../useSourceGeneration';
import type { useSwipeNavigation } from '../useSwipeNavigation';

/** Core media and project context */
export interface SharedLightboxCoreProps {
  media: GenerationRow;
  isVideo: boolean;
  selectedProjectId: string | null;
  isMobile: boolean;
  isFormOnlyMode: boolean;
  onClose: () => void;
  readOnly?: boolean;
  variantFetchGenerationId: string | null;
  initialVariantId?: string;
}

/** Navigation state and handlers */
export interface SharedLightboxNavigationProps {
  showNavigation?: boolean;
  hasNext?: boolean;
  hasPrevious?: boolean;
  handleSlotNavNext: () => void;
  handleSlotNavPrev: () => void;
  swipeDisabled: boolean;
}

/** Shot management callbacks and optimistic state */
export interface SharedLightboxShotProps {
  shotId?: string;
  selectedShotId?: string;
  allShots?: ShotOption[];
  onShotChange?: (shotId: string) => void;
  onAddToShot?: (targetShotId: string, generationId: string, imageUrl?: string, thumbUrl?: string) => Promise<boolean>;
  onAddToShotWithoutPosition?: (targetShotId: string, generationId: string, imageUrl?: string, thumbUrl?: string) => Promise<boolean>;
  onNavigateToShot?: (shot: Shot, options?: { isNewlyCreated?: boolean }) => void;
  onShowTick?: (imageId: string) => void;
  onShowSecondaryTick?: (imageId: string) => void;
  onOptimisticPositioned?: (mediaId: string, shotId: string) => void;
  onOptimisticUnpositioned?: (mediaId: string, shotId: string) => void;
  optimisticPositionedIds?: Set<string>;
  optimisticUnpositionedIds?: Set<string>;
  positionedInSelectedShot?: boolean;
  associatedWithoutPositionInSelectedShot?: boolean;
}

/** Layout mode inputs (drives panel/edit mode visibility) */
export interface SharedLightboxLayoutProps {
  showTaskDetails?: boolean;
  isSpecialEditMode: boolean;
  isInpaintMode: boolean;
  isMagicEditMode: boolean;
}

/** Button group inputs (download, delete, star, upscale, edit mode) */
export interface SharedLightboxButtonGroupProps {
  isCloudMode: boolean;
  showDownload?: boolean;
  isDownloading: boolean;
  setIsDownloading: (v: boolean) => void;
  onDelete?: LightboxDeleteHandler;
  isDeleting?: string | null;
  isUpscaling: boolean;
  handleUpscale: () => void;
}

/** Effective media inputs (for computing display URLs/dimensions) */
export interface SharedLightboxMediaProps {
  effectiveImageUrl: string;
  imageDimensions: { width: number; height: number };
  projectAspectRatio?: string;
}

export interface UseSharedLightboxStateInput {
  core: SharedLightboxCoreProps;
  navigation: SharedLightboxNavigationProps;
  shots: SharedLightboxShotProps;
  layout: SharedLightboxLayoutProps;
  actions: SharedLightboxButtonGroupProps;
  media: SharedLightboxMediaProps;
  starred?: boolean;
  onOpenExternalGeneration?: (generationId: string, derivedContext?: string[]) => Promise<void>;
}

export type SharedVariantsInput = Pick<UseSharedLightboxStateInput, 'core'>;
export type SharedNavigationInput = Pick<UseSharedLightboxStateInput, 'core' | 'navigation'>;
export type SharedShotActionsInput = Pick<UseSharedLightboxStateInput, 'core' | 'shots'>;
export type SharedInteractionInput = Pick<
  UseSharedLightboxStateInput,
  'core' | 'shots' | 'starred' | 'onOpenExternalGeneration'
>;
export type SharedPresentationInput = Pick<
  UseSharedLightboxStateInput,
  'core' | 'navigation' | 'layout' | 'actions' | 'media'
>;

export interface LightboxButtonGroupProps {
  topRight: {
    showDownload: boolean;
    handleDownload?: () => Promise<void>;
    isDownloading: boolean;
    onDelete?: LightboxDeleteHandler;
    handleDelete?: () => Promise<void>;
    isDeleting?: string | null;
    onClose: () => void;
  };
  bottomLeft: {
    isUpscaling: boolean;
    handleUpscale: () => Promise<void>;
    localStarred: boolean;
    handleToggleStar: () => void;
    toggleStarPending: boolean;
  };
  bottomRight: {
    isAddingToReferences: boolean;
    addToReferencesSuccess: boolean;
    handleAddToReferences: () => Promise<void>;
    handleAddToJoin?: () => void;
    isAddingToJoin?: boolean;
    addToJoinSuccess?: boolean;
    onGoToJoin?: () => void;
  };
}

export interface UseSharedLightboxStateReturn {
  // Variants
  variants: {
    list: GenerationVariant[];
    primaryVariant: GenerationVariant | null;
    activeVariant: GenerationVariant | null;
    isLoading: boolean;
    setActiveVariantId: (id: string) => void;
    refetch: () => void;
    setPrimaryVariant: (id: string) => Promise<void>;
    deleteVariant: (id: string) => Promise<void>;
    isViewingNonPrimaryVariant: boolean;
    // Promotion
    promoteSuccess: boolean;
    isPromoting: boolean;
    handlePromoteToGeneration: (variantId: string) => Promise<void>;
    handleAddVariantAsNewGenerationToShot: (
      shotId: string,
      variantId: string,
      currentTimelineFrame?: number,
    ) => Promise<boolean>;
  };

  // Download ref (for race condition fix)
  intendedActiveVariantIdRef: RefObject<string | null>;

  // Navigation
  navigation: {
    safeClose: () => void;
    activateClickShield: () => void;
    swipeNavigation: ReturnType<typeof useSwipeNavigation>;
  };

  // Star
  star: {
    localStarred: boolean;
    setLocalStarred: (v: boolean) => void;
    toggleStarMutation: UseMutationResult<void, Error, { id: string; starred: boolean; shotId?: string }>;
    handleToggleStar: () => void;
  };

  // References & Join
  references: {
    isAddingToReferences: boolean;
    addToReferencesSuccess: boolean;
    handleAddToReferences: () => Promise<void>;
    isAddingToJoin: boolean;
    addToJoinSuccess: boolean;
    handleAddToJoin: () => void;
    handleGoToJoin: () => void;
  };

  // Lineage
  lineage: {
    derivedItems: DerivedItem[];
    derivedGenerations: GenerationRow[];
    derivedPage: number;
    derivedTotalPages: number;
    paginatedDerived: DerivedItem[];
    setDerivedPage: (page: number) => void;
  };

  // Shot management
  shots: {
    // Positioning
    isAlreadyPositionedInSelectedShot: boolean;
    isAlreadyAssociatedWithoutPosition: boolean;
    handleAddToShot: () => Promise<void>;
    handleAddToShotWithoutPosition: () => Promise<void>;
    // Creation
    isCreatingShot: boolean;
    quickCreateSuccess: QuickCreateSuccess;
    handleQuickCreateAndAdd: () => Promise<void>;
    handleQuickCreateSuccess: () => void;
  };

  // Source generation (for child generations)
  sourceGeneration: {
    data: GenerationRow | null;
    primaryVariant: SourceVariantData | null;
  };

  // Make main variant
  makeMainVariant: {
    canMake: boolean;
    canMakeFromChild: boolean;
    canMakeFromVariant: boolean;
    isMaking: boolean;
    handle: () => Promise<void>;
  };

  // Effective media (computed URLs/dimensions)
  effectiveMedia: {
    videoUrl: string | undefined;
    mediaUrl: string | undefined;
    imageDimensions: { width: number; height: number };
  };

  // Layout mode
  layout: {
    isTabletOrLarger: boolean;
    isTouchLikeDevice: boolean;
    shouldShowSidePanel: boolean;
    isUnifiedEditMode: boolean;
    isPortraitMode: boolean;
  };

  // Button group props (pre-built)
  buttonGroupProps: LightboxButtonGroupProps;
}

export interface SharedVariantsStateResult {
  section: UseSharedLightboxStateReturn['variants'];
  intendedActiveVariantIdRef: RefObject<string | null>;
  activeVariant: GenerationVariant | null;
  primaryVariant: GenerationVariant | null;
  isViewingNonPrimaryVariant: boolean;
  setPrimaryVariant: (id: string) => Promise<void>;
  refetchVariants: () => void;
}

export interface SharedLightboxInteractionState {
  star: UseSharedLightboxStateReturn['star'];
  references: UseSharedLightboxStateReturn['references'];
  lineage: UseSharedLightboxStateReturn['lineage'];
  shots: UseSharedLightboxStateReturn['shots'];
  sourceGeneration: UseSharedLightboxStateReturn['sourceGeneration'];
  makeMainVariant: UseSharedLightboxStateReturn['makeMainVariant'];
}

export interface SharedLightboxPresentationState {
  variants: UseSharedLightboxStateReturn['variants'];
  intendedActiveVariantIdRef: UseSharedLightboxStateReturn['intendedActiveVariantIdRef'];
  navigation: UseSharedLightboxStateReturn['navigation'];
  effectiveMedia: UseSharedLightboxStateReturn['effectiveMedia'];
  layout: UseSharedLightboxStateReturn['layout'];
  buttonGroupProps: UseSharedLightboxStateReturn['buttonGroupProps'];
}
