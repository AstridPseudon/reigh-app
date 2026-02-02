/**
 * ImageGenerationForm hooks barrel
 *
 * Component-local hooks for the large ImageGenerationForm component.
 * These are co-located with the component per refactoring patterns doc.
 */

// Reference management - handles reference image CRUD and settings
export { useReferenceManagement } from './useReferenceManagement';
export type { UseReferenceManagementProps, UseReferenceManagementReturn } from './useReferenceManagement';

// Generation source - handles model selection and generation mode
export { useGenerationSource } from './useGenerationSource';
export type { UseGenerationSourceProps, UseGenerationSourceReturn } from './useGenerationSource';

// Prompt management - handles prompt CRUD and shot-specific prompts
export { usePromptManagement } from './usePromptManagement';
export type { UsePromptManagementProps, UsePromptManagementReturn } from './usePromptManagement';

// Form submission - handles building task params and submitting
export { useFormSubmission } from './useFormSubmission';
export type { UseFormSubmissionProps, UseFormSubmissionReturn } from './useFormSubmission';

// Legacy migrations - one-time data format migrations and cleanup
export { useLegacyMigrations } from './useLegacyMigrations';
export type { UseLegacyMigrationsProps } from './useLegacyMigrations';

// Reference selection - computes displayed reference with fallback caching
export { useReferenceSelection } from './useReferenceSelection';
export type { UseReferenceSelectionProps, UseReferenceSelectionReturn } from './useReferenceSelection';

// LORA handlers - wraps loraManager with project persistence
export { useLoraHandlers } from './useLoraHandlers';
export type { UseLoraHandlersProps, UseLoraHandlersReturn } from './useLoraHandlers';

// Utilities
export { buildBatchTaskParams } from './buildBatchTaskParams';
export type { BuildBatchTaskParamsInput } from './buildBatchTaskParams';
