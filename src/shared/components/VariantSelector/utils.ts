/**
 * VariantSelector Utilities
 *
 * Shared helper functions used by VariantSelector and its sub-components.
 */

import { Scissors, Sparkles, Film } from 'lucide-react';
import { VARIANT_TYPE } from '@/shared/constants/variantTypes';
import type { GenerationVariant } from '@/shared/hooks/useVariants';

/** Get icon component for a variant type */
export const getVariantIcon = (variantType: string | null) => {
  switch (variantType) {
    case 'trimmed':
      return Scissors;
    case 'upscaled':
      return Sparkles;
    case 'magic_edit':
      return Sparkles;
    case 'original':
    default:
      return Film;
  }
};

/** Get display label for a variant */
export const getVariantLabel = (variant: GenerationVariant): string => {
  if (variant.variant_type === 'trimmed') {
    const params = variant.params;
    const trimmedDuration = params?.trimmed_duration as number | undefined;
    if (trimmedDuration) {
      return `Trimmed (${trimmedDuration.toFixed(1)}s)`;
    }
    return 'Trimmed';
  }
  if (variant.variant_type === 'upscaled') {
    return 'Upscaled';
  }
  if (variant.variant_type === VARIANT_TYPE.ORIGINAL) {
    return 'Original';
  }
  if (variant.variant_type === 'magic_edit') {
    return 'Magic Edit';
  }
  return variant.variant_type || 'Variant';
};

/**
 * Check if variant is "new" (hasn't been viewed yet).
 * For currently active variant, always return false for instant feedback.
 */
export const isNewVariant = (variant: GenerationVariant, activeVariantId: string | null): boolean => {
  if (variant.id === activeVariantId) return false;
  return variant.viewed_at === null;
};

/** Get human-readable time ago string */
export const getTimeAgo = (createdAt: string): string => {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffMs = now - created;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
};

/**
 * Check if a variant has settings that can be loaded into any form.
 * - Travel segment variants: have generative settings (prompt, model, loras)
 * - Video enhance variants: have processing settings (interpolation, upscale)
 * - Trimmed/clip_join: no loadable settings
 */
export const hasLoadableSettings = (variant: GenerationVariant): boolean => {
  const nonLoadableTypes = ['trimmed', 'clip_join', 'join_final_stitch'];
  if (variant.variant_type && nonLoadableTypes.includes(variant.variant_type)) {
    return false;
  }

  const params = variant.params;
  if (!params) return false;

  const taskType = (params.task_type || params.created_from) as string | undefined;
  if (taskType === 'video_enhance') {
    return true;
  }

  const hasPrompt = !!params.prompt;
  const hasOrchestratorDetails = !!params.orchestrator_details;

  return hasPrompt || hasOrchestratorDetails;
};

export type RelationshipFilter = 'all' | 'parents' | 'children';
