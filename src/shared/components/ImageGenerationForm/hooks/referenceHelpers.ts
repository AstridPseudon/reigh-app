/**
 * Reference Helpers
 *
 * Shared helper functions for reference management hooks.
 */

import type { StyleReferenceMetadata } from '@/shared/hooks/useResources';
import type { HydratedReferenceImage } from '../types';

/**
 * Build full StyleReferenceMetadata from a HydratedReferenceImage.
 * Centralises the mapping so new metadata fields only need updating in one place.
 */
export function buildResourceMetadata(
  ref: HydratedReferenceImage,
  overrides: Partial<StyleReferenceMetadata> = {},
): StyleReferenceMetadata {
  return {
    name: ref.name,
    styleReferenceImage: ref.styleReferenceImage,
    styleReferenceImageOriginal: ref.styleReferenceImageOriginal,
    thumbnailUrl: ref.thumbnailUrl,
    styleReferenceStrength: ref.styleReferenceStrength,
    subjectStrength: ref.subjectStrength,
    subjectDescription: ref.subjectDescription,
    inThisScene: ref.inThisScene,
    inThisSceneStrength: ref.inThisSceneStrength,
    referenceMode: ref.referenceMode,
    styleBoostTerms: ref.styleBoostTerms,
    created_by: { is_you: true },
    is_public: ref.isPublic,
    createdAt: ref.createdAt,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}
