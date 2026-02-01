/**
 * Centralized cache invalidation hooks.
 *
 * All cache invalidation should go through these hooks to ensure:
 * - Consistent patterns across the codebase
 * - Debug logging via debugConfig
 * - Proper scoping of invalidations
 *
 * Usage:
 *   import { useInvalidateGenerations, useInvalidateShots } from '@/shared/hooks/invalidation';
 */

export * from './useGenerationInvalidation';
export * from './useShotInvalidation';
export * from './useTaskInvalidation';
export * from './useSettingsInvalidation';
